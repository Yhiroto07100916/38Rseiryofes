declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userIds: string[] = [];
const sessionIds: string[] = [];
let newsId = "";
let mainUser: { id: string; sessionId: string };
let statsOnlyUser: { id: string; sessionId: string };
let unreadOnlyUser: { id: string; sessionId: string };

async function createUser(prefix: string, permissions: string[]) {
  const id = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  userIds.push(id);
  sessionIds.push(sessionId);

  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name, nickname) VALUES (?, ?, ?, NULL)",
  ).bind(id, `${prefix}-${id}`, prefix).run();

  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+1 day'))",
  ).bind(sessionId, id).run();

  for (const key of permissions) {
    await env.DB.prepare(
      "INSERT INTO user_permissions (user_id, permission_id, effect) " +
      "SELECT ?, id, 'allow' FROM permissions WHERE key = ?",
    ).bind(id, key).run();
  }

  return { id, sessionId };
}

function request(sessionId: string, path: string, method = "GET") {
  return SELF.fetch(`http://example.com${path}`, {
    method,
    headers: { Cookie: `session_id=${sessionId}` },
  });
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__));

  mainUser = await createUser("既読管理者", [
    "news.view",
    "news.read_stats.view",
    "news.unread_users.view",
  ]);
  const reader = await createUser("既読ユーザー", ["news.view"]);
  await createUser("未読ユーザー", ["news.view"]);
  statsOnlyUser = await createUser("既読数閲覧のみ", ["news.read_stats.view"]);
  unreadOnlyUser = await createUser("未読者閲覧のみ", ["news.unread_users.view"]);

  newsId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO news (id, title, detail, author, created_by) VALUES (?, ?, ?, ?, ?)",
  ).bind(newsId, "既読機能テスト", "本文", "テスト", mainUser.id).run();

  // 読者の既読状態はDBに直接作り、APIによる本人の既読記録と分けて検証する。
  await env.DB.prepare(
    "INSERT INTO news_read_receipts (news_id, user_id) VALUES (?, ?)",
  ).bind(newsId, reader.id).run();

});

afterAll(async () => {
  if (newsId) {
    await env.DB.prepare("DELETE FROM news WHERE id = ?").bind(newsId).run();
  }
  for (const sessionId of sessionIds) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }
  for (const userId of userIds) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  }
});

describe("News read tracking", () => {
  it("records a reader once when they open the news detail", async () => {
    const first = await request(mainUser.sessionId, `/api/news/${newsId}/read`, "POST");
    expect(first.status).toBe(200);
    const firstBody = await first.json() as { success: boolean; read_at: string };
    expect(firstBody.success).toBe(true);
    expect(firstBody.read_at).toBeTruthy();

    const second = await request(mainUser.sessionId, `/api/news/${newsId}/read`, "POST");
    expect(second.status).toBe(200);

    const receipts = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM news_read_receipts WHERE news_id = ? AND user_id = ?",
    ).bind(newsId, mainUser.id).first<{ count: number }>();
    expect(receipts?.count).toBe(1);
  });

  it("returns read and unread counts for users who can view news", async () => {
    const response = await request(mainUser.sessionId, `/api/news/${newsId}/read-stats`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      read_count: 2,
      unread_count: 1,
      total_count: 3,
    });
  });

  it("returns only users with news.view who have not read the news", async () => {
    const response = await request(mainUser.sessionId, `/api/news/${newsId}/unread-users`);
    expect(response.status).toBe(200);
    const body = await response.json() as {
      users: Array<{ name: string; student_number: string }>;
    };
    expect(body.users).toHaveLength(1);
    expect(body.users[0].name).toBe("未読ユーザー");
  });

  it("enforces read-count and unread-user permissions independently", async () => {
    const statsAllowed = await request(statsOnlyUser.sessionId, `/api/news/${newsId}/read-stats`);
    const statsDenied = await request(unreadOnlyUser.sessionId, `/api/news/${newsId}/read-stats`);
    const unreadAllowed = await request(unreadOnlyUser.sessionId, `/api/news/${newsId}/unread-users`);
    const unreadDenied = await request(statsOnlyUser.sessionId, `/api/news/${newsId}/unread-users`);

    expect(statsAllowed.status).toBe(200);
    expect(statsDenied.status).toBe(403);
    expect(unreadAllowed.status).toBe(200);
    expect(unreadDenied.status).toBe(403);
  });
});
