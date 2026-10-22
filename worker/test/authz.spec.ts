declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env } from "cloudflare:test";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { hasPermission } from "../src/lib/authz";

const userIds: string[] = [];
const roleIds: string[] = [];
const accountRoleIds: string[] = [];

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__));
});

afterEach(async () => {
  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(userId).run();
  }

  for (const roleId of roleIds.splice(0)) {
    await env.DB.prepare("DELETE FROM roles WHERE id = ?")
      .bind(roleId).run();
  }

  for (const roleId of accountRoleIds.splice(0)) {
    await env.DB.prepare("DELETE FROM account_roles WHERE id = ?")
      .bind(roleId).run();
  }
});

afterAll(async () => {
  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(userId).run();
  }
});

async function createUser() {
  const id = crypto.randomUUID();
  userIds.push(id);

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `).bind(id, `authz-test-${id}`, "権限テストユーザー").run();

  return id;
}

async function createRole() {
  const id = crypto.randomUUID();
  roleIds.push(id);

  await env.DB.prepare(`
    INSERT INTO roles (id, name, description)
    VALUES (?, ?, ?)
  `).bind(id, `authz-test-role-${id}`, "権限テスト").run();

  return id;
}

async function createAccountRole(name?: string) {
  const id = crypto.randomUUID();
  accountRoleIds.push(id);

  await env.DB.prepare(`
    INSERT INTO account_roles (id, name, description)
    VALUES (?, ?, ?)
  `).bind(id, name ?? `authz-test-account-role-${id}`, "権限テスト").run();

  return id;
}

async function assignPermission(
  table: "user_permissions" | "role_permissions" | "account_role_permissions",
  ownerColumn: "user_id" | "role_id" | "account_role_id",
  ownerId: string,
  key: string,
  effect: "allow" | "deny",
) {
  const allowedTables: Record<string, string> = {
    user_permissions: "user_permissions",
    role_permissions: "role_permissions",
    account_role_permissions: "account_role_permissions",
  };
  const allowedColumns: Record<string, string> = {
    user_id: "user_id",
    role_id: "role_id",
    account_role_id: "account_role_id",
  };

  if (!allowedTables[table] || !allowedColumns[ownerColumn]) {
    throw new Error("Unsupported permission assignment");
  }

  await env.DB.prepare(`
    INSERT INTO ${table} (${ownerColumn}, permission_id, effect)
    SELECT ?, id, ?
    FROM permissions
    WHERE key = ?
  `).bind(ownerId, effect, key).run();
}

describe("hasPermission", () => {
  it("denies a user when no matching permission exists", async () => {
    const userId = await createUser();

    expect(await hasPermission(env, userId, "tasks.view")).toBe(false);
  });

  it("lets a user-specific allow override a role deny", async () => {
    const userId = await createUser();
    const roleId = await createRole();

    await env.DB.prepare(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (?, ?)
    `).bind(userId, roleId).run();

    await assignPermission(
      "role_permissions", "role_id", roleId, "tasks.view", "deny",
    );
    await assignPermission(
      "user_permissions", "user_id", userId, "tasks.view", "allow",
    );

    expect(await hasPermission(env, userId, "tasks.view")).toBe(true);
  });

  it("prioritizes deny across multiple roles", async () => {
    const userId = await createUser();
    const allowRoleId = await createRole();
    const denyRoleId = await createRole();

    for (const roleId of [allowRoleId, denyRoleId]) {
      await env.DB.prepare(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
      `).bind(userId, roleId).run();
    }

    await assignPermission(
      "role_permissions", "role_id", allowRoleId, "tasks.view", "allow",
    );
    await assignPermission(
      "role_permissions", "role_id", denyRoleId, "tasks.view", "deny",
    );

    expect(await hasPermission(env, userId, "tasks.view")).toBe(false);
  });

  it("uses account-role permissions when higher levels are unset", async () => {
    const userId = await createUser();
    const accountRoleId = await createAccountRole();

    await env.DB.prepare(`
      INSERT INTO user_account_roles (user_id, account_role_id)
      VALUES (?, ?)
    `).bind(userId, accountRoleId).run();

    await assignPermission(
      "account_role_permissions",
      "account_role_id",
      accountRoleId,
      "tasks.view",
      "allow",
    );

    expect(await hasPermission(env, userId, "tasks.view")).toBe(true);
  });

  it("lets a role permission override an account-role permission", async () => {
    const userId = await createUser();
    const roleId = await createRole();
    const accountRoleId = await createAccountRole();

    await env.DB.prepare(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (?, ?)
    `).bind(userId, roleId).run();

    await env.DB.prepare(`
      INSERT INTO user_account_roles (user_id, account_role_id)
      VALUES (?, ?)
    `).bind(userId, accountRoleId).run();

    await assignPermission(
      "role_permissions", "role_id", roleId, "tasks.view", "allow",
    );
    await assignPermission(
      "account_role_permissions",
      "account_role_id",
      accountRoleId,
      "tasks.view",
      "deny",
    );

    expect(await hasPermission(env, userId, "tasks.view")).toBe(true);
  });

  it("allows administrators even for an unregistered permission key", async () => {
    const userId = await createUser();

    await env.DB.prepare(`
      INSERT INTO user_account_roles (user_id, account_role_id)
      SELECT ?, id
      FROM account_roles
      WHERE name = 'admin'
    `).bind(userId).run();

    expect(
      await hasPermission(env, userId, "permission.not.registered"),
    ).toBe(true);
  });
});
