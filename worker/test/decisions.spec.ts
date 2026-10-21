declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = crypto.randomUUID();
const sessionId = crypto.randomUUID();

async function grantPermissions(keys: string[]) {
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
  await applyD1Migrations(
    env.DB,
    JSON.parse(__D1_MIGRATIONS__),
  );

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `).bind(userId, `decision-test-${userId}`, "決定事項テストユーザー").run();

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+1 day'))
  `).bind(sessionId, userId).run();
});

afterAll(async () => {
  await env.DB.prepare(`
    DELETE FROM decision_history
    WHERE actor_id = ?
       OR original_decision_id IN (
         SELECT id FROM decisions WHERE created_by = ?
       )
  `).bind(userId, userId).run();

  await env.DB.prepare("DELETE FROM decisions WHERE created_by = ?")
    .bind(userId).run();

  await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
    .bind(sessionId).run();

  await env.DB.prepare("DELETE FROM user_permissions WHERE user_id = ?")
    .bind(userId).run();

  await env.DB.prepare("DELETE FROM users WHERE id = ?")
    .bind(userId).run();
});

describe("Decision history", () => {
  it("requires authentication", async () => {
    const response = await SELF.fetch(
      "http://example.com/api/decisions",
    );

    expect(response.status).toBe(401);
  });

  it("records create and update history and preserves history after deletion", async () => {
    await grantPermissions([
      "decisions.view",
      "decisions.create",
      "decisions.edit",
      "decisions.delete",
    ]);

    const createResponse = await request("/api/decisions", "POST", {
      title: "履歴テスト",
      content: "作成時の内容",
      decided_at: "2026-10-21",
    });

    expect(createResponse.status).toBe(201);

    const createdBody = await createResponse.json() as {
      decision: { id: string };
    };
    const decisionId = createdBody.decision.id;

    const updateResponse = await request(
      `/api/decisions/${decisionId}`,
      "PATCH",
      { title: "更新後のタイトル" },
    );

    expect(updateResponse.status).toBe(200);

    const deleteResponse = await request(
      `/api/decisions/${decisionId}`,
      "DELETE",
    );

    expect(deleteResponse.status).toBe(200);

    const historyResponse = await request(
      `/api/decisions/${decisionId}/history`,
    );

    expect(historyResponse.status).toBe(200);

    const historyBody = await historyResponse.json() as {
      history: Array<{
        action: string;
        before_data: string | null;
        after_data: string | null;
      }>;
    };

    expect(historyBody.history.map((item) => item.action).sort())
      .toEqual(["created", "deleted", "updated"]);

    const rows = await env.DB.prepare(`
      SELECT decision_id, original_decision_id, action
      FROM decision_history
      WHERE original_decision_id = ?
    `).bind(decisionId).all<{
      decision_id: string | null;
      original_decision_id: string | null;
      action: string;
    }>();

    expect(rows.results).toHaveLength(3);
    expect(rows.results.every(
      (row) => row.original_decision_id === decisionId,
    )).toBe(true);
    expect(rows.results.every(
      (row) => row.decision_id === null,
    )).toBe(true);
  });

  it("forbids history access without decisions.view", async () => {
    const noViewUserId = crypto.randomUUID();
    const noViewSessionId = crypto.randomUUID();

    await env.DB.prepare(`
      INSERT INTO users (id, student_number, name, nickname)
      VALUES (?, ?, ?, NULL)
    `).bind(
      noViewUserId,
      `decision-test-${noViewUserId}`,
      "閲覧権限なしユーザー",
    ).run();

    await env.DB.prepare(`
      INSERT INTO sessions (id, user_id, expires_at)
      VALUES (?, ?, datetime('now', '+1 day'))
    `).bind(noViewSessionId, noViewUserId).run();

    try {
      const response = await SELF.fetch(
        "http://example.com/api/decisions/nonexistent/history",
        {
          headers: { Cookie: `session_id=${noViewSessionId}` },
        },
      );

      expect(response.status).toBe(403);
    } finally {
      await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
        .bind(noViewSessionId).run();
      await env.DB.prepare("DELETE FROM users WHERE id = ?")
        .bind(noViewUserId).run();
    }
  });
});
