declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env, SELF } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

const userIds: string[] = []
const sessionIds: string[] = []
const roleIds: string[] = []
const accountRoleIds: string[] = []

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__))
})

afterEach(async () => {
  for (const sessionId of sessionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId)
      .run()
  }

  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM user_roles WHERE user_id = ?")
      .bind(userId)
      .run()
    await env.DB.prepare("DELETE FROM user_account_roles WHERE user_id = ?")
      .bind(userId)
      .run()
    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(userId)
      .run()
  }

  for (const roleId of roleIds.splice(0)) {
    await env.DB.prepare("DELETE FROM roles WHERE id = ?")
      .bind(roleId)
      .run()
  }

  for (const accountRoleId of accountRoleIds.splice(0)) {
    await env.DB.prepare("DELETE FROM account_roles WHERE id = ?")
      .bind(accountRoleId)
      .run()
  }
})

async function createUser(name: string) {
  const id = crypto.randomUUID()
  userIds.push(id)

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `)
    .bind(id, `role-test-${id}`, name)
    .run()

  return id
}

async function createAdminSession() {
  const userId = await createUser("ロール管理テスト")
  const sessionId = crypto.randomUUID()
  sessionIds.push(sessionId)

  const adminRole = await env.DB
    .prepare("SELECT id FROM account_roles WHERE name = 'admin'")
    .first<{ id: string }

  if (!adminRole) {
    throw new Error("Seeded admin account role was not found")
  }

  await env.DB.prepare(`
    INSERT INTO user_account_roles (user_id, account_role_id)
    VALUES (?, ?)
  `)
    .bind(userId, adminRole.id)
    .run()

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+1 day'))
  `)
    .bind(sessionId, userId)
    .run()

  return `session_id=${sessionId}`
}

describe("role member endpoints", () => {
  it("returns aggregated member counts and bulk membership", async () => {
    const cookie = await createAdminSession()
    const firstUserId = await createUser("ロール所属ユーザー")
    const secondUserId = await createUser("ロール未所属ユーザー")
    const roleId = crypto.randomUUID()
    const accountRoleId = crypto.randomUUID()

    roleIds.push(roleId)
    accountRoleIds.push(accountRoleId)

    await env.DB.prepare(`
      INSERT INTO roles (id, name, description)
      VALUES (?, ?, ?)
    `)
      .bind(roleId, `role-test-${roleId}`, "テスト用活動ロール")
      .run()

    await env.DB.prepare(`
      INSERT INTO account_roles (id, name, description)
      VALUES (?, ?, ?)
    `)
      .bind(accountRoleId, `account-role-test-${accountRoleId}`, "テスト用権限")
      .run()

    await env.DB.prepare(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (?, ?)
    `)
      .bind(firstUserId, roleId)
      .run()

    await env.DB.prepare(`
      INSERT INTO user_account_roles (user_id, account_role_id)
      VALUES (?, ?)
    `)
      .bind(firstUserId, accountRoleId)
      .run()

    const roleListResponse = await SELF.fetch(
      "http://example.com/api/roles",
      { headers: { Cookie: cookie } },
    )
    expect(roleListResponse.status).toBe(200)
    const roleList = await roleListResponse.json() as {
      roles: Array<{ id: string; member_count: number }>
    }
    expect(roleList.roles.find(role => role.id === roleId)?.member_count).toBe(1)

    const roleMembersResponse = await SELF.fetch(
      `http://example.com/api/roles/${roleId}/members`,
      { headers: { Cookie: cookie } },
    )
    expect(roleMembersResponse.status).toBe(200)
    const roleMembers = await roleMembersResponse.json() as {
      users: Array<{ id: string; assigned: number }>
    }
    expect(roleMembers.users.find(user => user.id === firstUserId)?.assigned).toBe(1)
    expect(roleMembers.users.find(user => user.id === secondUserId)?.assigned).toBe(0)

    const accountRoleListResponse = await SELF.fetch(
      "http://example.com/api/account-roles",
      { headers: { Cookie: cookie } },
    )
    expect(accountRoleListResponse.status).toBe(200)
    const accountRoleList = await accountRoleListResponse.json() as {
      account_roles: Array<{ id: string; member_count: number }>
    }
    expect(
      accountRoleList.account_roles.find(role => role.id === accountRoleId)?.member_count,
    ).toBe(1)

    const accountRoleMembersResponse = await SELF.fetch(
      `http://example.com/api/account-roles/${accountRoleId}/members`,
      { headers: { Cookie: cookie } },
    )
    expect(accountRoleMembersResponse.status).toBe(200)
    const accountRoleMembers = await accountRoleMembersResponse.json() as {
      users: Array<{ id: string; assigned: number }>
    }
    expect(
      accountRoleMembers.users.find(user => user.id === firstUserId)?.assigned,
    ).toBe(1)
    expect(
      accountRoleMembers.users.find(user => user.id === secondUserId)?.assigned,
    ).toBe(0)
  })
})
