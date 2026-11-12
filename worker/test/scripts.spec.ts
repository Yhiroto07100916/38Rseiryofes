declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const viewerId = crypto.randomUUID();
const viewerSessionId = crypto.randomUUID();
const editorId = crypto.randomUUID();
const editorSessionId = crypto.randomUUID();

async function grant(userId: string, keys: string[]) {
  for (const key of keys) {
    await env.DB.prepare(`
      INSERT INTO user_permissions (user_id, permission_id, effect)
      SELECT ?, id, 'allow'
      FROM permissions
      WHERE key = ?
    `).bind(userId, key).run();
  }
}

async function request(
  sessionId: string,
  path: string,
  method = "GET",
  body?: Record<string, unknown>,
) {
  return SELF.fetch(`http://example.com${path}`, {
    method,
    headers: {
      Cookie: `session_id=${sessionId}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__));

  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name) VALUES (?, ?, ?)",
  ).bind(viewerId, `script-viewer-${viewerId}`, "台本閲覧者").run();
  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name) VALUES (?, ?, ?)",
  ).bind(editorId, `script-editor-${editorId}`, "台本編集者").run();

  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))",
  ).bind(viewerSessionId, viewerId).run();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))",
  ).bind(editorSessionId, editorId).run();

  await grant(viewerId, ["script.view"]);
  await grant(editorId, ["script.view", "script.edit"]);
});

afterAll(async () => {
  await env.DB.prepare("DELETE FROM scripts WHERE created_by = ?")
    .bind(editorId).run();
  for (const sessionId of [viewerSessionId, editorSessionId]) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId).run();
  }
  for (const userId of [viewerId, editorId]) {
    await env.DB.prepare("DELETE FROM user_permissions WHERE user_id = ?")
      .bind(userId).run();
    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(userId).run();
  }
});

describe("Script view and edit permissions", () => {
  it("allows view-only users to read scripts but blocks mutations", async () => {
    const listResponse = await request(viewerSessionId, "/api/scripts");
    expect(listResponse.status).toBe(200);

    const createResponse = await request(viewerSessionId, "/api/scripts", "POST", {
      title: "閲覧者からの作成",
    });
    expect(createResponse.status).toBe(403);
  });

  it("allows users with both permissions to create and update scripts", async () => {
    const createResponse = await request(editorSessionId, "/api/scripts", "POST", {
      title: "権限テスト台本",
    });
    expect(createResponse.status).toBe(201);

    const created = await createResponse.json() as {
      script: { id: string };
    };

    const readResponse = await request(
      editorSessionId,
      `/api/scripts/${created.script.id}`,
    );
    expect(readResponse.status).toBe(200);

    const updateResponse = await request(
      editorSessionId,
      `/api/scripts/${created.script.id}`,
      "PATCH",
      { title: "更新済み権限テスト台本" },
    );
    expect(updateResponse.status).toBe(200);

    const viewerUpdateResponse = await request(
      viewerSessionId,
      `/api/scripts/${created.script.id}`,
      "PATCH",
      { title: "閲覧者による更新" },
    );
    expect(viewerUpdateResponse.status).toBe(403);
  });
});
