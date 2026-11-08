declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env, SELF } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"

beforeAll(async () => {
  const migrations = JSON.parse(__D1_MIGRATIONS__)
  await applyD1Migrations(env.DB, migrations)
})

async function createUser(label: string) {
  const userId = crypto.randomUUID()
  const sessionId = crypto.randomUUID()

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name)
    VALUES (?, ?, ?)
  `).bind(userId, `tool-ledger-${crypto.randomUUID()}`, label).run()

  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, datetime('now', '+1 day'))
  `).bind(sessionId, userId).run()

  return { userId, cookie: `session_id=${sessionId}` }
}

async function grant(userId: string, keys: string[]) {
  for (const key of keys) {
    await env.DB.prepare(`
      INSERT INTO user_permissions (user_id, permission_id, effect)
      SELECT ?, id, 'allow' FROM permissions WHERE key = ?
    `).bind(userId, key).run()
  }
}

async function api(
  user: { cookie: string } | null,
  path: string,
  options: { method?: string; body?: unknown } = {},
) {
  const headers = new Headers()
  if (user) headers.set("Cookie", user.cookie)
  if (options.body !== undefined) headers.set("Content-Type", "application/json")

  return SELF.fetch(`http://example.com/api/tool-rental${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
}

async function createTool(
  manager: { cookie: string },
  name: string,
  managementNumber: string,
) {
  const response = await api(manager, "/tools", {
    method: "POST",
    body: {
      name,
      category: "備品",
      description: "テスト用",
      location: "38R",
      tool_items: [{ management_number: managementNumber }],
    },
  })
  expect(response.status).toBe(201)
  return await response.json() as { id: number }
}

describe("38R tool inventory and lending ledger", () => {
  it("requires authentication and separates view and checkout permissions", async () => {
    const unauthenticated = await api(null, "/tools")
    expect(unauthenticated.status).toBe(401)

    const viewer = await createUser("閲覧者")
    await grant(viewer.userId, ["tool_rental.view"])

    const list = await api(viewer, "/tools")
    expect(list.status).toBe(200)

    const checkout = await api(viewer, "/loans", {
      method: "POST",
      body: { tool_item_id: 1, class_name: "38R", name: "借用者" },
    })
    expect(checkout.status).toBe(403)
  })

  it("registers tools and individual management numbers", async () => {
    const manager = await createUser("台帳管理者")
    await grant(manager.userId, ["tool_rental.manage", "tool_rental.view"])

    const tool = await createTool(manager, "延長コード", "38R-TOOL-001")
    const response = await api(manager, `/tools/${tool.id}/items`)
    expect(response.status).toBe(200)

    const items = await response.json() as Array<{ id: number; management_number: string; status: string }>
    expect(items).toHaveLength(1)
    expect(items[0].management_number).toBe("38R-TOOL-001")
    expect(items[0].status).toBe("available")

    const tools = await api(manager, "/tools")
    const list = await tools.json() as Array<{ id: number; quantity: number; available_quantity: number }>
    expect(list.find(item => item.id === tool.id)).toMatchObject({ quantity: 1, available_quantity: 1 })
  })

  it("records the borrower and returner for an individual tool", async () => {
    const manager = await createUser("貸出返却担当")
    await grant(manager.userId, [
      "tool_rental.view",
      "tool_rental.manage",
      "tool_rental.checkout",
      "tool_rental.return",
      "tool_rental.history",
    ])

    const tool = await createTool(manager, "ドライバー", "38R-TOOL-002")
    const itemResponse = await api(manager, `/tools/${tool.id}/items`)
    const items = await itemResponse.json() as Array<{ id: number }>

    const checkout = await api(manager, "/loans", {
      method: "POST",
      body: {
        tool_item_id: items[0].id,
        class_name: "38R",
        name: "借りた人",
      },
    })
    expect(checkout.status).toBe(201)

    const currentResponse = await api(manager, "/loans/current")
    expect(currentResponse.status).toBe(200)
    const current = await currentResponse.json() as Array<{
      loan_item_id: number
      management_number: string
      borrower_name: string
      time_limit_minutes: number | null
      due_at: string | null
    }>
    expect(current).toHaveLength(1)
    expect(current[0]).toMatchObject({
      management_number: "38R-TOOL-002",
      borrower_name: "借りた人",
      time_limit_minutes: null,
      due_at: null,
    })

    const returned = await api(manager, "/loans/return", {
      method: "POST",
      body: {
        loan_item_id: current[0].loan_item_id,
        returner_class_name: "38R",
        returner_name: "返却を記録した人",
      },
    })
    expect(returned.status).toBe(200)

    const currentAfterReturn = await api(manager, "/loans/current")
    expect(await currentAfterReturn.json()).toEqual([])

    const historyResponse = await api(manager, "/loans/history")
    expect(historyResponse.status).toBe(200)
    const history = await historyResponse.json() as Array<{
      management_number: string
      borrower_name: string
      returned_by_name: string
      status: string
    }>
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      management_number: "38R-TOOL-002",
      borrower_name: "借りた人",
      returned_by_name: "返却を記録した人",
      status: "returned",
    })

    const itemsAfterReturn = await api(manager, `/tools/${tool.id}/items`)
    const updatedItems = await itemsAfterReturn.json() as Array<{ status: string }>
    expect(updatedItems[0].status).toBe("available")
  })

  it("starts a persisted countdown five minutes before the optional time limit", async () => {
    const manager = await createUser("タイマー確認担当")
    await grant(manager.userId, [
      "tool_rental.view",
      "tool_rental.manage",
      "tool_rental.checkout",
    ])

    const tool = await createTool(manager, "タイマー用工具", "38R-TOOL-TIMER")
    const itemResponse = await api(manager, `/tools/${tool.id}/items`)
    const items = await itemResponse.json() as Array<{ id: number }>

    const invalid = await api(manager, "/loans", {
      method: "POST",
      body: {
        tool_item_id: items[0].id,
        class_name: "38R",
        name: "借りた人",
        time_limit_minutes: 4,
      },
    })
    expect(invalid.status).toBe(400)

    const checkout = await api(manager, "/loans", {
      method: "POST",
      body: {
        tool_item_id: items[0].id,
        class_name: "38R",
        name: "借りた人",
        time_limit_minutes: 60,
      },
    })
    expect(checkout.status).toBe(201)

    const currentResponse = await api(manager, "/loans/current")
    const current = await currentResponse.json() as Array<{
      borrowed_at: string
      time_limit_minutes: number | null
      due_at: string | null
    }>
    expect(current).toHaveLength(1)
    expect(current[0].time_limit_minutes).toBe(60)
    expect(current[0].due_at).not.toBeNull()

    const borrowedAt = new Date(`${current[0].borrowed_at.replace(' ', 'T')}+09:00`).getTime()
    const dueAt = new Date(`${current[0].due_at?.replace(' ', 'T')}+09:00`).getTime()
    expect(Math.round((dueAt - borrowedAt) / 60000)).toBe(55)
  })

  it("rejects a second checkout of an already borrowed individual item", async () => {
    const manager = await createUser("重複貸出テスト担当")
    await grant(manager.userId, [
      "tool_rental.view",
      "tool_rental.manage",
      "tool_rental.checkout",
    ])

    const tool = await createTool(manager, "ペンチ", "38R-TOOL-003")
    const itemResponse = await api(manager, `/tools/${tool.id}/items`)
    const items = await itemResponse.json() as Array<{ id: number }>

    const first = await api(manager, "/loans", {
      method: "POST",
      body: { tool_item_id: items[0].id, class_name: "38R", name: "一人目" },
    })
    expect(first.status).toBe(201)

    const second = await api(manager, "/loans", {
      method: "POST",
      body: { tool_item_id: items[0].id, class_name: "38R", name: "二人目" },
    })
    expect(second.status).toBe(409)
  })

  it("does not expose removed reservation or notification operations", async () => {
    const manager = await createUser("機能範囲テスト担当")
    await grant(manager.userId, ["tool_rental.manage", "tool_rental.view"])

    const reservations = await api(manager, "/reservations")
    const notifications = await api(manager, "/settings/notifications")
    const returnTimes = await api(manager, "/settings/return-time")

    expect(reservations.status).toBe(404)
    expect(notifications.status).toBe(404)
    expect(returnTimes.status).toBe(404)
  })
})
