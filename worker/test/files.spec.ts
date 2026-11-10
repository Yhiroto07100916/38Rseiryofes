declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { notifyFileLinked } from "../src/lib/file-notifications";

type Fixture = {
  userId: string;
  recipientUserId: string;
  sessionId: string;
  receiptId: string;
  taskId: string;
  decisionId: string;
  submissionId: string;
  recordId: string;
  fileIds: {
    receipt: string;
    task: string;
    decision: string;
    submission: string;
  };
  uploadedFileIds: string[];
  objectKeys: string[];
  cookie: string;
};

const fixtures: Fixture[] = [];

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__));
});

async function grantPermissions(userId: string, keys: string[]) {
  for (const key of keys) {
    await env.DB.prepare(`
      INSERT INTO user_permissions (user_id, permission_id, effect)
      SELECT ?, id, 'allow'
      FROM permissions
      WHERE key = ?
    `).bind(userId, key).run();
  }
}

async function createFixture(): Promise<Fixture> {
  const userId = crypto.randomUUID();
  const recipientUserId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  const fixture: Fixture = {
    userId,
    recipientUserId,
    sessionId,
    receiptId: crypto.randomUUID(),
    taskId: crypto.randomUUID(),
    decisionId: crypto.randomUUID(),
    submissionId: crypto.randomUUID(),
    recordId: crypto.randomUUID(),
    fileIds: {
      receipt: crypto.randomUUID(),
      task: crypto.randomUUID(),
      decision: crypto.randomUUID(),
      submission: crypto.randomUUID(),
    },
    uploadedFileIds: [],
    objectKeys: [],
    cookie: `session_id=${sessionId}`,
  };

  fixtures.push(fixture);

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `).bind(userId, `files-test-${userId}`, "ファイル権限テストユーザー").run();

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `).bind(recipientUserId, `files-recipient-${recipientUserId}`, "通知受信ユーザー").run();

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+1 day'))
  `).bind(sessionId, userId).run();

  await env.DB.prepare(`
    INSERT INTO receipts (id, purchased_at, store_name, created_by)
    VALUES (?, ?, ?, ?)
  `).bind(fixture.receiptId, "2026-11-07", "テスト店舗", userId).run();

  await env.DB.prepare(`
    INSERT INTO tasks (id, title, scope, created_by)
    VALUES (?, ?, 'class', ?)
  `).bind(fixture.taskId, "ファイル権限テストタスク", userId).run();

  await env.DB.prepare(`
    INSERT INTO decisions (id, title, content, decided_at, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    fixture.decisionId,
    "ファイル権限テスト決定事項",
    "テスト用の内容",
    "2026-11-07",
    userId,
  ).run();

  await env.DB.prepare(`
    INSERT INTO submissions (id, title, destination, created_by)
    VALUES (?, ?, ?, ?)
  `).bind(
    fixture.submissionId,
    "ファイル権限テスト提出物",
    "テスト担当者",
    userId,
  ).run();

  await env.DB.prepare(`
    INSERT INTO submission_records (
      id, submission_id, attempt_number, submitted_by
    )
    VALUES (?, ?, 1, ?)
  `).bind(fixture.recordId, fixture.submissionId, userId).run();

  const fileEntries = [
    ["receipt", fixture.fileIds.receipt],
    ["task", fixture.fileIds.task],
    ["decision", fixture.fileIds.decision],
    ["submission", fixture.fileIds.submission],
  ] as const;

  for (const [name, fileId] of fileEntries) {
    const objectKey = `files-access-test/${fileId}.txt`;
    fixture.objectKeys.push(objectKey);

    await env.DB.prepare(`
      INSERT INTO files (
        id, object_key, original_name, content_type,
        size, category, uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fileId,
      objectKey,
      `${name}-test.txt`,
      "text/plain",
      20,
      "document",
      userId,
    ).run();

    await env.FILES_BUCKET.put(objectKey, `${name} test content`, {
      httpMetadata: { contentType: "text/plain" },
    });
  }

  await env.DB.prepare(`
    INSERT INTO receipt_files (receipt_id, file_id)
    VALUES (?, ?)
  `).bind(fixture.receiptId, fixture.fileIds.receipt).run();

  await env.DB.prepare(`
    INSERT INTO task_files (task_id, file_id)
    VALUES (?, ?)
  `).bind(fixture.taskId, fixture.fileIds.task).run();

  await env.DB.prepare(`
    INSERT INTO decision_files (decision_id, file_id)
    VALUES (?, ?)
  `).bind(fixture.decisionId, fixture.fileIds.decision).run();

  await env.DB.prepare(`
    INSERT INTO submission_record_files (record_id, file_id)
    VALUES (?, ?)
  `).bind(fixture.recordId, fixture.fileIds.submission).run();

  return fixture;
}

async function request(
  fixture: Fixture,
  path: string,
) {
  return SELF.fetch(`http://example.com${path}`, {
    headers: { Cookie: fixture.cookie },
  });
}

async function listFiles(fixture: Fixture) {
  const response = await request(fixture, "/api/files");
  expect(response.status).toBe(200);

  return response.json() as Promise<{
    files: Array<{ id: string }>;
    count: number;
  }>;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    await env.DB.prepare("DELETE FROM submissions WHERE id = ?")
      .bind(fixture.submissionId).run();

    await env.DB.prepare("DELETE FROM receipts WHERE id = ?")
      .bind(fixture.receiptId).run();

    await env.DB.prepare("DELETE FROM tasks WHERE id = ?")
      .bind(fixture.taskId).run();

    await env.DB.prepare("DELETE FROM decisions WHERE id = ?")
      .bind(fixture.decisionId).run();

    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(fixture.sessionId).run();

    for (const fileId of [...Object.values(fixture.fileIds), ...fixture.uploadedFileIds]) {
      await env.DB.prepare("DELETE FROM files WHERE id = ?")
        .bind(fileId).run();
    }

    for (const objectKey of fixture.objectKeys) {
      await env.FILES_BUCKET.delete(objectKey);
    }

    for (const userId of [fixture.recipientUserId, fixture.userId]) {
      await env.DB.prepare(
        "DELETE FROM notifications WHERE recipient_user_id = ? OR actor_user_id = ?",
      ).bind(userId, userId).run();
      await env.DB.prepare("DELETE FROM notification_user_settings WHERE user_id = ?")
        .bind(userId).run();
      await env.DB.prepare("DELETE FROM notification_category_settings WHERE user_id = ?")
        .bind(userId).run();
      await env.DB.prepare("DELETE FROM push_subscriptions WHERE user_id = ?")
        .bind(userId).run();
      await env.DB.prepare("DELETE FROM user_roles WHERE user_id = ?")
        .bind(userId).run();
      await env.DB.prepare("DELETE FROM user_account_roles WHERE user_id = ?")
        .bind(userId).run();
      await env.DB.prepare("DELETE FROM user_permissions WHERE user_id = ?")
        .bind(userId).run();
      await env.DB.prepare("DELETE FROM users WHERE id = ?")
        .bind(userId).run();
    }
  }
});

describe("Files access permissions", () => {
  it("excludes linked files without their corresponding view permissions", async () => {
    const fixture = await createFixture();

    const result = await listFiles(fixture);
    const visibleIds = result.files.map((file) => file.id);

    expect(visibleIds).not.toContain(fixture.fileIds.receipt);
    expect(visibleIds).not.toContain(fixture.fileIds.task);
    expect(visibleIds).not.toContain(fixture.fileIds.decision);
    expect(visibleIds).not.toContain(fixture.fileIds.submission);
  });

  it("shows files only when the corresponding view permission is granted", async () => {
    const fixture = await createFixture();

    await grantPermissions(fixture.userId, ["accounting.view"]);

    let result = await listFiles(fixture);
    let visibleIds = result.files.map((file) => file.id);

    expect(visibleIds).toContain(fixture.fileIds.receipt);
    expect(visibleIds).not.toContain(fixture.fileIds.task);
    expect(visibleIds).not.toContain(fixture.fileIds.decision);
    expect(visibleIds).not.toContain(fixture.fileIds.submission);

    await grantPermissions(fixture.userId, ["tasks.view"]);

    result = await listFiles(fixture);
    visibleIds = result.files.map((file) => file.id);

    expect(visibleIds).toContain(fixture.fileIds.receipt);
    expect(visibleIds).toContain(fixture.fileIds.task);

    await grantPermissions(fixture.userId, ["decisions.view"]);

    result = await listFiles(fixture);
    visibleIds = result.files.map((file) => file.id);

    expect(visibleIds).toContain(fixture.fileIds.receipt);
    expect(visibleIds).toContain(fixture.fileIds.task);
    expect(visibleIds).toContain(fixture.fileIds.decision);

    expect(visibleIds).not.toContain(fixture.fileIds.submission);
    expect(result.count).toBe(result.files.length);
  });

  it("blocks generic downloads without the corresponding permission", async () => {
    const fixture = await createFixture();

    const receiptKey = fixture.objectKeys[0];
    const taskKey = fixture.objectKeys[1];
    const decisionKey = fixture.objectKeys[2];
    const submissionKey = fixture.objectKeys[3];

    expect((await request(fixture, `/api/files/${receiptKey}`)).status).toBe(403);
    expect((await request(fixture, `/api/files/${taskKey}`)).status).toBe(403);
    expect((await request(fixture, `/api/files/${decisionKey}`)).status).toBe(403);
    expect((await request(fixture, `/api/files/${submissionKey}`)).status).toBe(403);

    await grantPermissions(fixture.userId, [
      "accounting.view",
      "tasks.view",
      "decisions.view",
      "submissions.view",
    ]);

    for (const objectKey of [receiptKey, taskKey, decisionKey]) {
      const response = await request(fixture, `/api/files/${objectKey}`);

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }

    const submissionResponse = await request(
      fixture,
      `/api/files/${submissionKey}`,
    );
    expect(submissionResponse.status).toBe(403);
  });

  it("rejects file registration across different domains", async () => {
    const fixture = await createFixture();

    const attempts = [
      env.DB.prepare(`
        INSERT INTO task_files (task_id, file_id)
        VALUES (?, ?)
      `).bind(fixture.taskId, fixture.fileIds.receipt),

      env.DB.prepare(`
        INSERT INTO receipt_files (receipt_id, file_id)
        VALUES (?, ?)
      `).bind(fixture.receiptId, fixture.fileIds.task),

      env.DB.prepare(`
        INSERT INTO task_files (task_id, file_id)
        VALUES (?, ?)
      `).bind(fixture.taskId, fixture.fileIds.decision),

      env.DB.prepare(`
        INSERT INTO decision_files (decision_id, file_id)
        VALUES (?, ?)
      `).bind(fixture.decisionId, fixture.fileIds.submission),

      env.DB.prepare(`
        INSERT OR IGNORE INTO receipt_files (receipt_id, file_id)
        VALUES (?, ?)
      `).bind(fixture.receiptId, fixture.fileIds.task),
    ];

    for (const statement of attempts) {
      await expect(statement.run()).rejects.toThrow("FILE_LINK_CONFLICT");
    }

    const counts = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM receipt_files WHERE file_id = ?) AS receipt_count,
        (SELECT COUNT(*) FROM task_files WHERE file_id = ?) AS task_count,
        (SELECT COUNT(*) FROM decision_files WHERE file_id = ?) AS decision_count,
        (SELECT COUNT(*) FROM submission_record_files WHERE file_id = ?) AS submission_count
    `).bind(
      fixture.fileIds.receipt,
      fixture.fileIds.task,
      fixture.fileIds.decision,
      fixture.fileIds.submission,
    ).first<{
      receipt_count: number;
      task_count: number;
      decision_count: number;
      submission_count: number;
    }>();

    expect(counts).toEqual({
      receipt_count: 1,
      task_count: 1,
      decision_count: 1,
      submission_count: 1,
    });
  });

  it("rolls back earlier batch statements when a file link conflicts", async () => {
    const fixture = await createFixture();

    const before = await env.DB.prepare(
      "SELECT title FROM tasks WHERE id = ?",
    )
      .bind(fixture.taskId)
      .first<{ title: string }>();

    expect(before).not.toBeNull();

    await expect(
      env.DB.batch([
        env.DB.prepare(
          "UPDATE tasks SET title = title || ' changed' WHERE id = ?",
        ).bind(fixture.taskId),
        env.DB.prepare(`
          INSERT OR IGNORE INTO receipt_files (receipt_id, file_id)
          VALUES (?, ?)
        `).bind(fixture.receiptId, fixture.fileIds.task),
      ]),
    ).rejects.toThrow("FILE_LINK_CONFLICT");

    const after = await env.DB.prepare(
      "SELECT title FROM tasks WHERE id = ?",
    )
      .bind(fixture.taskId)
      .first<{ title: string }>();

    expect(after?.title).toBe(before?.title);

    const link = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM receipt_files WHERE file_id = ?",
    )
      .bind(fixture.fileIds.task)
      .first<{ count: number }>();

    expect(link?.count).toBe(0);
  });

  it("applies permission filters before the result limit", async () => {
    const fixture = await createFixture();

    await grantPermissions(fixture.userId, ["accounting.view"]);

    const response = await request(
      fixture,
      "/api/files?category=document&limit=1",
    );

    expect(response.status).toBe(200);

    const body = await response.json() as {
      files: Array<{ id: string }>;
      count: number;
    };

    expect(body.files).toHaveLength(1);
    expect(body.files[0].id).toBe(fixture.fileIds.receipt);
    expect(body.count).toBe(1);
  });
  it("creates upload notifications only when the uploader opts in", async () => {
    const fixture = await createFixture();
    const category = await env.DB.prepare(
      "SELECT slug FROM file_categories WHERE is_active = 1 LIMIT 1",
    ).first<{ slug: string }>();
    expect(category).not.toBeNull();

    const formData = new FormData();
    formData.set("file", new File(["notification test"], "notify.txt", { type: "text/plain" }));
    formData.set("category", category!.slug);
    formData.set("notify", "true");

    const response = await SELF.fetch("http://example.com/api/files", {
      method: "POST",
      headers: { Cookie: fixture.cookie },
      body: formData,
    });

    expect(response.status).toBe(201);
    const uploaded = await response.json() as { id: string; object_key: string };
    fixture.uploadedFileIds.push(uploaded.id);
    fixture.objectKeys.push(uploaded.object_key);

    await grantPermissions(fixture.recipientUserId, ["tasks.view"]);
    await env.DB.prepare(
      "INSERT INTO task_files (task_id, file_id) VALUES (?, ?)",
    ).bind(fixture.taskId, uploaded.id).run();
    await notifyFileLinked(env, uploaded.id, fixture.userId);

    const notification = await env.DB.prepare(`
      SELECT event_key, recipient_user_id, body, target_url
      FROM notifications
      WHERE entity_type = 'file' AND entity_id = ?
    `).bind(uploaded.id).first<{
      event_key: string;
      recipient_user_id: string;
      body: string;
      target_url: string;
    }>();

    expect(notification).toMatchObject({
      event_key: "files.uploaded",
      recipient_user_id: fixture.recipientUserId,
      body: "notify.txt",
      target_url: "/files?open=" + uploaded.id,
    });

    const actorNotification = await env.DB.prepare(
      "SELECT id FROM notifications WHERE entity_id = ? AND recipient_user_id = ?",
    ).bind(uploaded.id, fixture.userId).first();
    expect(actorNotification).toBeNull();

    const silentFormData = new FormData();
    silentFormData.set("file", new File(["silent upload"], "silent.txt", { type: "text/plain" }));
    silentFormData.set("category", category!.slug);

    const silentResponse = await SELF.fetch("http://example.com/api/files", {
      method: "POST",
      headers: { Cookie: fixture.cookie },
      body: silentFormData,
    });

    expect(silentResponse.status).toBe(201);
    const silentUpload = await silentResponse.json() as { id: string; object_key: string };
    fixture.uploadedFileIds.push(silentUpload.id);
    fixture.objectKeys.push(silentUpload.object_key);

    const silentNotification = await env.DB.prepare(
      "SELECT id FROM notifications WHERE entity_type = 'file' AND entity_id = ?",
    ).bind(silentUpload.id).first();
    expect(silentNotification).toBeNull();
  });

});
