declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

type Fixture = {
  userId: string;
  sessionId: string;
  fileId: string;
  submissionIds: string[];
  cookie: string;
};

const fixtures: Fixture[] = [];

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__));
});

async function createFixture(): Promise<Fixture> {
  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const fileId = crypto.randomUUID();

  const fixture: Fixture = {
    userId,
    sessionId,
    fileId,
    submissionIds: [],
    cookie: `session_id=${sessionId}`,
  };

  fixtures.push(fixture);

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `)
    .bind(userId, `submission-test-${userId}`, "提出物テストユーザー")
    .run();

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+1 day'))
  `)
    .bind(sessionId, userId)
    .run();

  await env.DB.prepare(`
    INSERT INTO files (
      id, object_key, original_name, content_type,
      size, category, uploaded_by
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      fileId,
      `submission-test/${fileId}`,
      "提出テスト.pdf",
      "application/pdf",
      1024,
      "document",
      userId,
    )
    .run();

  return fixture;
}

async function grantPermissions(
  userId: string,
  permissionKeys: string[],
) {
  for (const key of permissionKeys) {
    await env.DB.prepare(`
      INSERT INTO user_permissions (user_id, permission_id, effect)
      SELECT ?, id, 'allow'
      FROM permissions
      WHERE key = ?
    `)
      .bind(userId, key)
      .run();
  }
}

async function createSubmission(fixture: Fixture): Promise<string> {
  const response = await SELF.fetch(
    "http://example.com/api/submissions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: fixture.cookie,
      },
      body: JSON.stringify({
        title: "提出物APIテスト",
        description: "統合テスト用の提出物",
        destination: "テスト担当者",
      }),
    },
  );

  expect(response.status).toBe(201);

  const body = await response.json() as {
    id: string;
    status: string;
  };

  expect(body.status).toBe("preparing");
  fixture.submissionIds.push(body.id);

  return body.id;
}

async function changeStatus(
  fixture: Fixture,
  submissionId: string,
  action: string,
  note?: string,
) {
  return SELF.fetch(
    `http://example.com/api/submissions/${submissionId}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: fixture.cookie,
      },
      body: JSON.stringify({ action, note }),
    },
  );
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    for (const submissionId of fixture.submissionIds) {
      await env.DB.prepare("DELETE FROM submissions WHERE id = ?")
        .bind(submissionId)
        .run();
    }

    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(fixture.sessionId)
      .run();

    await env.DB.prepare("DELETE FROM files WHERE id = ?")
      .bind(fixture.fileId)
      .run();

    await env.DB.prepare("DELETE FROM user_permissions WHERE user_id = ?")
      .bind(fixture.userId)
      .run();

    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(fixture.userId)
      .run();
  }
});

describe("Submissions API", () => {
  it("lists assignable roles and saves the selected role when creating a submission", async () => {
    const fixture = await createFixture()
    await grantPermissions(fixture.userId, [
      "submissions.create",
      "submissions.view",
    ])

    const roleId = crypto.randomUUID()
    await env.DB.prepare(
      "INSERT INTO roles (id, name, description) VALUES (?, ?, ?)",
    )
      .bind(roleId, "広報係", "提出物担当")
      .run()

    const rolesResponse = await SELF.fetch(
      "http://example.com/api/submissions/roles",
      { headers: { Cookie: fixture.cookie } },
    )
    expect(rolesResponse.status).toBe(200)
    const rolesBody = await rolesResponse.json() as {
      roles: Array<{ id: string; name: string }>
    }
    expect(rolesBody.roles).toContainEqual({ id: roleId, name: "広報係" })

    const createResponse = await SELF.fetch(
      "http://example.com/api/submissions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: fixture.cookie,
        },
        body: JSON.stringify({
          title: "係指定テスト",
          destination: "先生",
          assigned_role_id: roleId,
        }),
      },
    )
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as { id: string }
    fixture.submissionIds.push(created.id)

    const detailResponse = await SELF.fetch(
      `http://example.com/api/submissions/${created.id}`,
      { headers: { Cookie: fixture.cookie } },
    )
    expect(detailResponse.status).toBe(200)
    const detailBody = await detailResponse.json() as {
      submission: { assigned_role_id: string; assigned_role_name: string }
    }
    expect(detailBody.submission.assigned_role_id).toBe(roleId)
    expect(detailBody.submission.assigned_role_name).toBe("広報係")
  })


  it("creates a submission and returns it in the list and detail", async () => {
    const fixture = await createFixture();

    await grantPermissions(fixture.userId, [
      "submissions.view",
      "submissions.create",
    ]);

    const submissionId = await createSubmission(fixture);

    const listResponse = await SELF.fetch(
      "http://example.com/api/submissions",
      {
        headers: { Cookie: fixture.cookie },
      },
    );

    expect(listResponse.status).toBe(200);

    const listBody = await listResponse.json() as {
      submissions: Array<{ id: string; title: string }>;
    };

    expect(
      listBody.submissions.some((item) => item.id === submissionId),
    ).toBe(true);

    const detailResponse = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}`,
      {
        headers: { Cookie: fixture.cookie },
      },
    );

    expect(detailResponse.status).toBe(200);

    const detailBody = await detailResponse.json() as {
      submission: { id: string; status: string };
      records: unknown[];
      history: Array<{ action: string }>;
    };

    expect(detailBody.submission.id).toBe(submissionId);
    expect(detailBody.submission.status).toBe("preparing");
    expect(detailBody.records).toHaveLength(0);
    expect(detailBody.history.some((item) => item.action === "created"))
      .toBe(true);
  });

  it("rejects operations without the required permission", async () => {
    const fixture = await createFixture();

    const listResponse = await SELF.fetch(
      "http://example.com/api/submissions",
      {
        headers: { Cookie: fixture.cookie },
      },
    );

    expect(listResponse.status).toBe(403);

    const createResponse = await SELF.fetch(
      "http://example.com/api/submissions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: fixture.cookie,
        },
        body: JSON.stringify({
          title: "権限なしテスト",
          destination: "テスト担当者",
        }),
      },
    );

    expect(createResponse.status).toBe(403);

    const count = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM submissions
      WHERE created_by = ?
    `)
      .bind(fixture.userId)
      .first<{ count: number }>();

    expect(count?.count).toBe(0);
  });

  it("rejects invalid submission data", async () => {
    const fixture = await createFixture();

    await grantPermissions(fixture.userId, ["submissions.create"]);

    const response = await SELF.fetch(
      "http://example.com/api/submissions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: fixture.cookie,
        },
        body: JSON.stringify({
          title: " ",
          destination: "テスト担当者",
        }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("does not create a record when an attached file is invalid", async () => {
    const fixture = await createFixture();

    await grantPermissions(fixture.userId, [
      "submissions.create",
      "submissions.edit",
      "submissions.submit",
    ]);

    const submissionId = await createSubmission(fixture);

    const readyResponse = await changeStatus(
      fixture,
      submissionId,
      "ready_to_submit",
    );

    expect(readyResponse.status).toBe(200);

    const response = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}/records`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: fixture.cookie,
        },
        body: JSON.stringify({
          note: "不正ファイルのテスト",
          file_ids: [crypto.randomUUID()],
        }),
      },
    );

    expect(response.status).toBe(400);

    const count = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM submission_records
      WHERE submission_id = ?
    `)
      .bind(submissionId)
      .first<{ count: number }>();

    const submission = await env.DB.prepare(`
      SELECT status FROM submissions WHERE id = ?
    `)
      .bind(submissionId)
      .first<{ status: string }>();

    expect(count?.count).toBe(0);
    expect(submission?.status).toBe("ready_to_submit");
  });

  it("prevents duplicate records when submissions are requested concurrently", async () => {
    const fixture = await createFixture();

    await grantPermissions(fixture.userId, [
      "submissions.create",
      "submissions.edit",
      "submissions.submit",
      "submissions.view",
    ]);

    const submissionId = await createSubmission(fixture);

    const readyResponse = await changeStatus(
      fixture,
      submissionId,
      "ready_to_submit",
    );

    expect(readyResponse.status).toBe(200);

    const submit = () =>
      SELF.fetch(
        `http://example.com/api/submissions/${submissionId}/records`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: fixture.cookie,
          },
          body: JSON.stringify({
            note: "同時提出テスト",
            file_ids: [fixture.fileId],
          }),
        },
      );

    const responses = await Promise.all([submit(), submit()]);
    const statuses = responses.map((response) => response.status).sort();

    expect(statuses).toEqual([201, 409]);

    const records = await env.DB.prepare(`
      SELECT id, attempt_number
      FROM submission_records
      WHERE submission_id = ?
    `)
      .bind(submissionId)
      .all<{ id: string; attempt_number: number }>();

    expect(records.results).toHaveLength(1);
    expect(records.results[0].attempt_number).toBe(1);

    const submission = await env.DB.prepare(`
      SELECT status, version
      FROM submissions
      WHERE id = ?
    `)
      .bind(submissionId)
      .first<{ status: string; version: number }>();

    expect(submission?.status).toBe("submitted");
    expect(submission?.version).toBe(2);

    const history = await env.DB.prepare(`
      SELECT action
      FROM submission_history
      WHERE submission_id = ?
        AND action = 'submitted'
    `)
      .bind(submissionId)
      .all<{ action: string }>();

    expect(history.results).toHaveLength(1);

    const fileLinks = await env.DB.prepare(`
      SELECT record_id
      FROM submission_record_files
      WHERE record_id = ?
    `)
      .bind(records.results[0].id)
      .all<{ record_id: string }>();

    expect(fileLinks.results).toHaveLength(1);
  });

  it("supports submission, review, resubmission, and completion", async () => {
    const fixture = await createFixture();

    await grantPermissions(fixture.userId, [
      "submissions.create",
      "submissions.view",
      "submissions.edit",
      "submissions.submit",
      "submissions.review",
    ]);

    const submissionId = await createSubmission(fixture);

    const readyResponse = await changeStatus(
      fixture,
      submissionId,
      "ready_to_submit",
    );

    expect(readyResponse.status).toBe(200);

    const firstRecordResponse = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}/records`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: fixture.cookie,
        },
        body: JSON.stringify({
          note: "初回提出",
          file_ids: [fixture.fileId],
        }),
      },
    );

    expect(firstRecordResponse.status).toBe(201);

    const firstRecord = await firstRecordResponse.json() as {
      id: string;
      attempt_number: number;
      status: string;
    };

    expect(firstRecord.attempt_number).toBe(1);
    expect(firstRecord.status).toBe("submitted");

    const reviewResponse = await changeStatus(
      fixture,
      submissionId,
      "start_review",
    );

    expect(reviewResponse.status).toBe(200);

    const requestChangesResponse = await changeStatus(
      fixture,
      submissionId,
      "request_changes",
      "ファイルを修正してください",
    );

    expect(requestChangesResponse.status).toBe(200);

    const secondRecordResponse = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}/records`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: fixture.cookie,
        },
        body: JSON.stringify({
          note: "修正後の再提出",
          file_ids: [],
        }),
      },
    );

    expect(secondRecordResponse.status).toBe(201);

    const secondRecord = await secondRecordResponse.json() as {
      id: string;
      attempt_number: number;
      status: string;
    };

    expect(secondRecord.attempt_number).toBe(2);
    expect(secondRecord.status).toBe("resubmitted");

    const completeResponse = await changeStatus(
      fixture,
      submissionId,
      "complete",
    );

    expect(completeResponse.status).toBe(200);

    const detailResponse = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}`,
      {
        headers: { Cookie: fixture.cookie },
      },
    );

    expect(detailResponse.status).toBe(200);

    const detailBody = await detailResponse.json() as {
      submission: { status: string };
      records: Array<{
        attempt_number: number;
        files: string;
      }>;
      history: Array<{ action: string }>;
    };

    expect(detailBody.submission.status).toBe("completed");
    expect(detailBody.records).toHaveLength(2);
    expect(detailBody.records.map((record) => record.attempt_number))
      .toEqual([2, 1]);

    const firstRecordDetail = detailBody.records.find(
      (record) => record.attempt_number === 1,
    );

    expect(firstRecordDetail).toBeDefined();

    const attachedFiles = JSON.parse(firstRecordDetail?.files ?? "[]") as
      Array<Record<string, unknown>>;

    expect(attachedFiles).toHaveLength(1);
    expect(attachedFiles[0]).toEqual({
      id: fixture.fileId,
      original_name: "提出テスト.pdf",
      content_type: "application/pdf",
      size: 1024,
    });
    expect(attachedFiles[0]).not.toHaveProperty("object_key");

    const actions = detailBody.history.map((item) => item.action);

    expect(actions).toContain("created");
    expect(actions).toContain("ready_to_submit");
    expect(actions).toContain("submitted");
    expect(actions).toContain("start_review");
    expect(actions).toContain("request_changes");
    expect(actions).toContain("resubmitted");
    expect(actions).toContain("complete");
  });

  it("rejects files uploaded by another user", async () => {
    const submitter = await createFixture()
    const otherUser = await createFixture()

    await grantPermissions(submitter.userId, [
      "submissions.create",
      "submissions.edit",
      "submissions.submit",
    ])

    const submissionId = await createSubmission(submitter)

    const readyResponse = await changeStatus(
      submitter,
      submissionId,
      "ready_to_submit",
    )

    expect(readyResponse.status).toBe(200)

    const response = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}/records`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: submitter.cookie,
        },
        body: JSON.stringify({
          note: "他人のファイルを添付するテスト",
          file_ids: [otherUser.fileId],
        }),
      },
    )

    expect(response.status).toBe(400)

    const count = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM submission_records
      WHERE submission_id = ?
    `)
      .bind(submissionId)
      .first<{ count: number }>()

    expect(count?.count).toBe(0)
  });

  it("allows classmates to view submissions and files without mutation permissions", async () => {
    const owner = await createFixture()
    const classmate = await createFixture()

    await grantPermissions(owner.userId, [
      "submissions.create",
      "submissions.edit",
      "submissions.submit",
      "submissions.view",
    ])

    const submissionId = await createSubmission(owner)

    const readyResponse = await changeStatus(
      owner,
      submissionId,
      "ready_to_submit",
    )

    expect(readyResponse.status).toBe(200)

    const objectKey = `submission-test/${owner.fileId}`
    await env.FILES_BUCKET.put(objectKey, "submission test file", {
      httpMetadata: {
        contentType: "application/pdf",
      },
    })

    const submitResponse = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}/records`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: owner.cookie,
        },
        body: JSON.stringify({
          note: "閲覧権限テスト",
          file_ids: [owner.fileId],
        }),
      },
    )

    expect(submitResponse.status).toBe(201)

    await grantPermissions(classmate.userId, [
      "submissions.view",
    ])

    const listResponse = await SELF.fetch(
      "http://example.com/api/submissions",
      {
        headers: {
          Cookie: classmate.cookie,
        },
      },
    )

    expect(listResponse.status).toBe(200)

    const listBody = await listResponse.json() as {
      submissions: Array<{ id: string }>
    }

    expect(
      listBody.submissions.some((item) => item.id === submissionId),
    ).toBe(true)

    const detailResponse = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}`,
      {
        headers: {
          Cookie: classmate.cookie,
        },
      },
    )

    expect(detailResponse.status).toBe(200)

    const downloadResponse = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}/files/${owner.fileId}`,
      {
        headers: {
          Cookie: classmate.cookie,
        },
      },
    )

    expect(downloadResponse.status).toBe(200)
    expect(await downloadResponse.text()).toBe("submission test file")

    const genericDownloadResponse = await SELF.fetch(
      `http://example.com/api/files/${objectKey}`,
      {
        headers: {
          Cookie: classmate.cookie,
        },
      },
    )

    expect(genericDownloadResponse.status).toBe(403)

    const createResponse = await SELF.fetch(
      "http://example.com/api/submissions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: classmate.cookie,
        },
        body: JSON.stringify({
          title: "閲覧者による作成",
          destination: "テスト",
        }),
      },
    )

    expect(createResponse.status).toBe(403)

    const editResponse = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: classmate.cookie,
        },
        body: JSON.stringify({
          title: "不正な変更",
        }),
      },
    )

    expect(editResponse.status).toBe(403)

    const statusResponse = await changeStatus(
      classmate,
      submissionId,
      "complete",
    )

    expect(statusResponse.status).toBe(403)

    const recordResponse = await SELF.fetch(
      `http://example.com/api/submissions/${submissionId}/records`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: classmate.cookie,
        },
        body: JSON.stringify({
          note: "閲覧者による提出",
          file_ids: [],
        }),
      },
    )

    expect(recordResponse.status).toBe(403)
  });

  it("rejects invalid status transitions", async () => {
    const fixture = await createFixture();

    await grantPermissions(fixture.userId, [
      "submissions.create",
      "submissions.edit",
      "submissions.review",
    ]);

    const submissionId = await createSubmission(fixture);

    const response = await changeStatus(
      fixture,
      submissionId,
      "start_review",
    );

    expect(response.status).toBe(409);

    const submission = await env.DB.prepare(`
      SELECT status FROM submissions WHERE id = ?
    `)
      .bind(submissionId)
      .first<{ status: string }>();

    expect(submission?.status).toBe("preparing");
  });
});
