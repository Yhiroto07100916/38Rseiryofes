declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env, SELF } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(async () => {
  const migrations = JSON.parse(__D1_MIGRATIONS__);
  await applyD1Migrations(env.DB, migrations);
});

async function createUser(label: string) {
  const userId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name)
    VALUES (?, ?, ?)
  `).bind(userId, `wishlist-${crypto.randomUUID()}`, label).run();

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+1 day'))
  `).bind(sessionId, userId).run();

  return { userId, cookie: `session_id=${sessionId}` };
}

async function grant(userId: string, keys: string[]) {
  for (const key of keys) {
    await env.DB.prepare(`
      INSERT INTO user_permissions (user_id, permission_id, effect)
      SELECT ?, id, 'allow' FROM permissions WHERE key = ?
    `).bind(userId, key).run();
  }
}

describe("Wishlist API permissions", () => {
  it("forces new submissions to purchase requested", async () => {
    const user = await createUser("提出者");
    await grant(user.userId, ["wishlist.view", "wishlist.create"]);

    const response = await SELF.fetch("http://example.com/api/wishlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: user.cookie,
      },
      body: JSON.stringify({ title: "養生テープ", status: "purchased" }),
    });

    expect(response.status).toBe(201);
    const created = await response.json() as { status: string };
    expect(created.status).toBe("requested");
  });

  it("requires wishlist.review to change the purchase status", async () => {
    const submitter = await createUser("提出者");
    const reviewer = await createUser("担当者");
    await grant(submitter.userId, ["wishlist.view", "wishlist.create"]);
    await grant(reviewer.userId, ["wishlist.view", "wishlist.review"]);

    const createResponse = await SELF.fetch("http://example.com/api/wishlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: submitter.cookie,
      },
      body: JSON.stringify({ title: "模造紙" }),
    });

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { id: string };

    const deniedResponse = await SELF.fetch(
      `http://example.com/api/wishlist/${created.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: submitter.cookie,
        },
        body: JSON.stringify({ status: "planned" }),
      },
    );
    expect(deniedResponse.status).toBe(403);

    const reviewResponse = await SELF.fetch(
      `http://example.com/api/wishlist/${created.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: reviewer.cookie,
        },
        body: JSON.stringify({ status: "planned" }),
      },
    );
    expect(reviewResponse.status).toBe(200);
    const updated = await reviewResponse.json() as { status: string };
    expect(updated.status).toBe("planned");
  });

  it("requires wishlist.view to list items", async () => {
    const user = await createUser("閲覧権限なし");

    const response = await SELF.fetch("http://example.com/api/wishlist", {
      headers: { Cookie: user.cookie },
    });

    expect(response.status).toBe(403);
  });

  it("allows creator to edit and delete their own item with own permissions", async () => {
    const user = await createUser("登録者");
    await grant(user.userId, [
      "wishlist.view",
      "wishlist.create",
      "wishlist.edit_own",
      "wishlist.delete_own",
    ]);

    const createResponse = await SELF.fetch("http://example.com/api/wishlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: user.cookie,
      },
      body: JSON.stringify({ title: "延長コード", quantity: 2 }),
    });

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { id: string };

    const updateResponse = await SELF.fetch(
      `http://example.com/api/wishlist/${created.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: user.cookie,
        },
        body: JSON.stringify({ title: "延長コード 3m" }),
      },
    );

    expect(updateResponse.status).toBe(200);

    const deleteResponse = await SELF.fetch(
      `http://example.com/api/wishlist/${created.id}`,
      {
        method: "DELETE",
        headers: { Cookie: user.cookie },
      },
    );

    expect(deleteResponse.status).toBe(200);
  });

  it("does not allow another user to edit an item with only own permissions", async () => {
    const owner = await createUser("所有者");
    const other = await createUser("別ユーザー");

    await grant(owner.userId, [
      "wishlist.view",
      "wishlist.create",
    ]);
    await grant(other.userId, [
      "wishlist.view",
      "wishlist.edit_own",
    ]);

    const createResponse = await SELF.fetch("http://example.com/api/wishlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: owner.cookie,
      },
      body: JSON.stringify({ title: "工具箱" }),
    });

    expect(createResponse.status).toBe(201);
    const created = await createResponse.json() as { id: string };

    const updateResponse = await SELF.fetch(
      `http://example.com/api/wishlist/${created.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: other.cookie,
        },
        body: JSON.stringify({ title: "不正な変更" }),
      },
    );

    expect(updateResponse.status).toBe(403);
  });
});
