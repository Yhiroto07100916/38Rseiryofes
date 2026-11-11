declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

type Fixture = {
  userId: string;
  sessionId: string;
  folderIds: string[];
  fileIds: string[];
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
    `).bind(userId, key).run()
  }
}

async function createFixture(): Promise<Fixture> {
  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const fixture: Fixture = {
    userId,
    sessionId,
    folderIds: [],
    fileIds: [],
    cookie: `session_id=${sessionId}`,
  };
  fixtures.push(fixture);

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `).bind(userId, `folder-test-${userId}`, "フォルダテストユーザー").run();

  await grantPermissions(userId, ["files.view", "files.folders.create"])

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+1 day'))
  `).bind(sessionId, userId).run();

  return fixture;
}

async function request(fixture: Fixture, path: string, init: RequestInit = {}) {
  return SELF.fetch(`http://example.com${path}`, {
    ...init,
    headers: {
      Cookie: fixture.cookie,
      ...(init.headers ?? {}),
    },
  });
}

async function createFolder(
  fixture: Fixture,
  name: string,
  parentId: string | null = null,
  category: string | null = "documents",
) {
  const response = await request(fixture, "/api/file-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent_id: parentId, category }),
  });
  expect(response.status).toBe(201);
  const result = await response.json() as { id: string };
  fixture.folderIds.push(result.id);
  return result.id;
}

afterEach(async () => {
  for (const fixture of fixtures.splice(0)) {
    for (const fileId of fixture.fileIds) {
      await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(fileId).run();
    }

    for (const folderId of [...fixture.folderIds].reverse()) {
      await env.DB.prepare("DELETE FROM file_folders WHERE id = ?").bind(folderId).run();
    }

    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(fixture.sessionId).run();
    await env.DB.prepare("DELETE FROM user_permissions WHERE user_id = ?").bind(fixture.userId).run();
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(fixture.userId).run();
  }
});

describe("File folder management", () => {
  it("creates nested folders and stores categories independently", async () => {
    const fixture = await createFixture();
    const parentId = await createFolder(fixture, "会計資料", null, "documents");
    const childId = await createFolder(fixture, "領収書", parentId, "receipts");

    const response = await request(fixture, `/api/file-folders?parent_id=${parentId}`);
    expect(response.status).toBe(200);

    const body = await response.json() as {
      folders: Array<{ id: string; name: string; category: string; category_name: string }>;
    };
    expect(body.folders).toHaveLength(1);
    expect(body.folders[0]).toMatchObject({
      id: childId,
      name: "領収書",
      category: "receipts",
      category_name: "会計・領収書",
    });
  });

  it("prevents moving a folder into its descendant", async () => {
    const fixture = await createFixture();
    const parentId = await createFolder(fixture, "親");
    const childId = await createFolder(fixture, "子", parentId);

    const response = await request(fixture, `/api/file-folders/${parentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: childId }),
    });

    expect(response.status).toBe(409);
  });

  it("moves a folder to another parent and updates its full path", async () => {
    const fixture = await createFixture();
    const firstParentId = await createFolder(fixture, "旧分類");
    const secondParentId = await createFolder(fixture, "新分類");
    const childId = await createFolder(fixture, "資料", firstParentId);

    const moveResponse = await request(fixture, `/api/file-folders/${childId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parent_id: secondParentId }),
    });
    expect(moveResponse.status).toBe(200);

    const treeResponse = await request(fixture, "/api/file-folders?all=true");
    const tree = await treeResponse.json() as {
      folders: Array<{ id: string; parent_id: string | null; path: string }>;
    };
    expect(tree.folders.find(folder => folder.id === childId)).toMatchObject({
      parent_id: secondParentId,
      path: "新分類 / 資料",
    });
  });

  it("does not delete a folder that contains another folder", async () => {
    const fixture = await createFixture();
    const parentId = await createFolder(fixture, "親");
    await createFolder(fixture, "子", parentId);

    const response = await request(fixture, `/api/file-folders/${parentId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "FOLDER_NOT_EMPTY" });
  });

  it("moves an uploaded file into a folder and filters files by folder", async () => {
    const fixture = await createFixture();
    const folderId = await createFolder(fixture, "台本", null, "scripts");
    const fileId = crypto.randomUUID();
    fixture.fileIds.push(fileId);

    await env.DB.prepare(`
      INSERT INTO files (
        id, object_key, original_name, content_type, size, category, uploaded_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      fileId,
      `folder-tests/${fileId}.txt`,
      "scene.txt",
      "text/plain",
      10,
      "documents",
      fixture.userId,
    ).run();

    const moveResponse = await request(fixture, `/api/files/${fileId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    });
    expect(moveResponse.status).toBe(200);

    const listResponse = await request(fixture, `/api/files?folder_id=${folderId}`);
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json() as { files: Array<{ id: string; folder_id: string }> };
    expect(list.files).toContainEqual(expect.objectContaining({ id: fileId, folder_id: folderId }));

    const rootResponse = await request(fixture, "/api/files?folder_id=root");
    const root = await rootResponse.json() as { files: Array<{ id: string }> };
    expect(root.files.some((file) => file.id === fileId)).toBe(false);
  });

  it("prevents another user from editing or deleting a folder", async () => {
    const owner = await createFixture();
    const other = await createFixture();
    const folderId = await createFolder(owner, "所有者限定");
    const editResponse = await request(other, `/api/file-folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "不正な変更" }),
    });
    expect(editResponse.status).toBe(403);
    const deleteResponse = await request(other, `/api/file-folders/${folderId}`, { method: "DELETE" });
    expect(deleteResponse.status).toBe(403);
  });
});
