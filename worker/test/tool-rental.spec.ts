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
  `).bind(userId, `tool-rental-${crypto.randomUUID()}`, label).run();

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

async function createTool(userId: string, name: string, quantity: number) {
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO tool_rental_tools (id, name, category, total_quantity, created_by)
    VALUES (?, ?, 'test', ?, ?)
  `).bind(id, name, quantity, userId).run();
  return id;
}

describe("Tool rental API", () => {
  it("creates a tool only for managers", async () => {
    const manager = await createUser("管理者");
    await grant(manager.userId, ["tool_rental.manage", "tool_rental.view"]);

    const response = await SELF.fetch("http://example.com/api/tool-rental/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: JSON.stringify({ name: "ドライバー", category: "手工具", total_quantity: 3 }),
    });

    expect(response.status).toBe(201);
    const tool = await response.json() as { name: string; available_quantity: number };
    expect(tool.name).toBe("ドライバー");
    expect(tool.available_quantity).toBe(3);
  });

  it("rejects non-object JSON bodies without throwing", async () => {
    const manager = await createUser("入力検証担当");
    await grant(manager.userId, ["tool_rental.manage", "tool_rental.view"]);

    const response = await SELF.fetch("http://example.com/api/tool-rental/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: "null",
    });

    expect(response.status).toBe(400);
  });

  it("rejects boolean values where a positive integer is required", async () => {
    const manager = await createUser("数量検証担当");
    await grant(manager.userId, ["tool_rental.manage", "tool_rental.view"]);

    const response = await SELF.fetch("http://example.com/api/tool-rental/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: JSON.stringify({ name: "テスト工具", category: "test", total_quantity: true }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects checkout without permission", async () => {
    const user = await createUser("閲覧者");
    const toolId = await createTool(user.userId, "レンチ", 2);

    const response = await SELF.fetch("http://example.com/api/tool-rental/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: user.cookie },
      body: JSON.stringify({ tool_id: toolId, borrower_name: "借用者", quantity: 1 }),
    });

    expect(response.status).toBe(403);
  });

  it("prevents over-checkout even when requests happen together", async () => {
    const manager = await createUser("受付担当");
    await grant(manager.userId, ["tool_rental.view", "tool_rental.checkout"]);
    const toolId = await createTool(manager.userId, "ペンチ", 1);

    const makeRequest = () => SELF.fetch("http://example.com/api/tool-rental/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: JSON.stringify({ tool_id: toolId, borrower_name: "借用者", quantity: 1 }),
    });

    const responses = await Promise.all([makeRequest(), makeRequest()]);
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  });

  it("records a return only once", async () => {
    const manager = await createUser("返却担当");
    await grant(manager.userId, ["tool_rental.view", "tool_rental.checkout", "tool_rental.return"]);
    const toolId = await createTool(manager.userId, "六角レンチ", 2);

    const checkout = await SELF.fetch("http://example.com/api/tool-rental/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: JSON.stringify({ tool_id: toolId, borrower_name: "借用者", quantity: 1 }),
    });
    expect(checkout.status).toBe(201);
    const loan = await checkout.json() as { id: string };

    const returnRequest = () => SELF.fetch(`http://example.com/api/tool-rental/loans/${loan.id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: JSON.stringify({}),
    });

    const responses = await Promise.all([returnRequest(), returnRequest()]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => response.status === 409)).toHaveLength(1);
  });

  it("does not reduce inventory below the quantity currently checked out", async () => {
    const manager = await createUser("在庫管理担当");
    await grant(manager.userId, [
      "tool_rental.view",
      "tool_rental.manage",
      "tool_rental.checkout",
    ]);
    const toolId = await createTool(manager.userId, "在庫変更テスト工具", 3);

    const checkout = await SELF.fetch("http://example.com/api/tool-rental/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: JSON.stringify({ tool_id: toolId, borrower_name: "借用者", quantity: 2 }),
    });
    expect(checkout.status).toBe(201);

    const update = await SELF.fetch(`http://example.com/api/tool-rental/tools/${toolId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: JSON.stringify({ total_quantity: 1 }),
    });

    expect(update.status).toBe(409);
    const tool = await env.DB.prepare(
      "SELECT total_quantity FROM tool_rental_tools WHERE id = ?",
    ).bind(toolId).first<{ total_quantity: number }>();
    expect(tool?.total_quantity).toBe(3);
  });

  it("keeps loan history when a tool is archived", async () => {
    const manager = await createUser("管理担当");
    await grant(manager.userId, [
      "tool_rental.view",
      "tool_rental.manage",
      "tool_rental.checkout",
      "tool_rental.history",
    ]);
    const toolId = await createTool(manager.userId, "古い工具", 1);

    const checkout = await SELF.fetch("http://example.com/api/tool-rental/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: JSON.stringify({ tool_id: toolId, borrower_name: "借用者", quantity: 1 }),
    });
    expect(checkout.status).toBe(201);

    const response = await SELF.fetch(`http://example.com/api/tool-rental/tools/${toolId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: manager.cookie },
      body: JSON.stringify({ name: "名称変更後の工具", is_active: false }),
    });

    expect(response.status).toBe(200);
    const tool = await response.json() as { is_active: number };
    expect(tool.is_active).toBe(0);

    const historyResponse = await SELF.fetch("http://example.com/api/tool-rental/history", {
      headers: { Cookie: manager.cookie },
    });
    expect(historyResponse.status).toBe(200);
    const history = await historyResponse.json() as {
      loans: Array<{ tool_id: string; tool_name: string }>;
    };
    const archivedLoan = history.loans.find((loan) => loan.tool_id === toolId);
    expect(archivedLoan?.tool_name).toBe("古い工具");
  });
});
