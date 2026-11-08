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
  `).bind(userId, `tool-rental-${crypto.randomUUID()}`, label).run()

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
  options: {
    method?: string
    body?: unknown
  } = {},
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
  managementNumbers: string[],
) {
  const response = await api(manager, "/tools", {
    method: "POST",
    body: {
      name,
      category: "手工具",
      description: "テスト用",
      location: "倉庫",
      tool_items: managementNumbers.map(management_number => ({ management_number })),
    },
  })

  expect(response.status).toBe(201)
  return await response.json() as {
    id: number
    name: string
    quantity: number
    available_quantity: number
  }
}

describe("Tool rental full workflow API", () => {
  it("requires authentication and enforces separate permissions", async () => {
    const unauthenticated = await api(null, "/tools")
    expect(unauthenticated.status).toBe(401)

    const viewer = await createUser("閲覧担当")
    await grant(viewer.userId, ["tool_rental.view"])

    const list = await api(viewer, "/tools")
    expect(list.status).toBe(200)

    const checkout = await api(viewer, "/loans", {
      method: "POST",
      body: {
        class_name: "38R",
        name: "借用者",
        tool_id: 1,
        tool_item_ids: [1],
      },
    })
    expect(checkout.status).toBe(403)
  })

  it("registers individual inventory items and keeps their management numbers", async () => {
    const manager = await createUser("在庫管理担当")
    await grant(manager.userId, ["tool_rental.manage", "tool_rental.view"])

    const tool = await createTool(manager, "テスト工具", ["TR-001", "TR-002"])
    expect(tool.quantity).toBe(2)
    expect(tool.available_quantity).toBe(2)

    const itemsResponse = await api(manager, `/tools/${tool.id}/items`)
    expect(itemsResponse.status).toBe(200)

    const items = await itemsResponse.json() as Array<{
      id: number
      management_number: string
      status: string
    }>
    expect(items.map(item => item.management_number)).toEqual(["TR-001", "TR-002"])
    expect(items.every(item => item.status === "available")).toBe(true)
  })

  it("supports lending and partial returns by individual item", async () => {
    const manager = await createUser("貸出・返却担当")
    await grant(manager.userId, [
      "tool_rental.view",
      "tool_rental.manage",
      "tool_rental.checkout",
      "tool_rental.return",
      "tool_rental.history",
    ])

    const tool = await createTool(manager, "個体返却テスト", ["PART-001", "PART-002"])
    const itemsResponse = await api(manager, `/tools/${tool.id}/items`)
    const items = await itemsResponse.json() as Array<{ id: number }>

    const checkout = await api(manager, "/loans", {
      method: "POST",
      body: {
        class_name: "38R",
        name: "貸出者",
        tool_id: tool.id,
        tool_item_ids: items.map(item => item.id),
      },
    })
    expect(checkout.status).toBe(201)

    const loan = await checkout.json() as {
      id: number
      tool_items: Array<{ loan_item_id: number; tool_item_id: number }>
    }
    expect(loan.tool_items).toHaveLength(2)

    const firstLoanItemId = loan.tool_items[0].loan_item_id
    const firstToolItemId = loan.tool_items[0].tool_item_id

    const partialReturn = await api(manager, "/loans/return", {
      method: "POST",
      body: {
        loan_item_ids: [firstLoanItemId],
        class_name: "38R",
        name: "返却者",
      },
    })
    expect(partialReturn.status).toBe(200)

    const updatedItemsResponse = await api(manager, `/tools/${tool.id}/items`)
    const updatedItems = await updatedItemsResponse.json() as Array<{
      id: number
      status: string
    }>
    expect(updatedItems.find(item => item.id === firstToolItemId)?.status).toBe("available")
    expect(updatedItems.filter(item => item.status === "borrowed")).toHaveLength(1)

    await env.DB.prepare("UPDATE tools SET name = ? WHERE id = ?")
      .bind("変更後の工具名", tool.id)
      .run()

    const currentLoans = await api(manager, "/loans/current")
    expect(currentLoans.status).toBe(200)
    const current = await currentLoans.json() as Array<{
      id: number
      quantity: number
      returned_quantity: number
      tool_name: string
    }>
    expect(current.some(item =>
      item.id === loan.id &&
      item.returned_quantity === 1 &&
      item.tool_name === "個体返却テスト",
    )).toBe(true)
  })

  it("queues reservations when all individual items are checked out", async () => {
    const manager = await createUser("予約担当")
    await grant(manager.userId, [
      "tool_rental.view",
      "tool_rental.manage",
      "tool_rental.checkout",
      "tool_rental.return",
    ])

    const tool = await createTool(manager, "予約テスト工具", ["RES-001"])
    const itemsResponse = await api(manager, `/tools/${tool.id}/items`)
    const items = await itemsResponse.json() as Array<{ id: number }>

    const checkout = await api(manager, "/loans", {
      method: "POST",
      body: {
        class_name: "38R",
        name: "先行借用者",
        tool_id: tool.id,
        tool_item_ids: [items[0].id],
      },
    })
    expect(checkout.status).toBe(201)

    const reservationResponse = await api(manager, "/reservations", {
      method: "POST",
      body: {
        tool_id: tool.id,
        class_name: "38R",
        name: "予約者",
        quantity: 1,
      },
    })
    expect(reservationResponse.status).toBe(201)

    const reservationsResponse = await api(manager, "/reservations?status=waiting")
    expect(reservationsResponse.status).toBe(200)
    const reservations = await reservationsResponse.json() as Array<{
      id: number
      queue_position: number
      status: string
    }>
    expect(reservations).toHaveLength(1)
    expect(reservations[0].queue_position).toBe(1)
    expect(reservations[0].status).toBe("waiting")
  })

  it("saves the normal and chief universal return times", async () => {
    const manager = await createUser("返却時刻管理担当")
    await grant(manager.userId, ["tool_rental.manage", "tool_rental.view"])

    const normal = await api(manager, "/settings/return-time", {
      method: "PATCH",
      body: { universal_return_times: ["15:30"] },
    })
    expect(normal.status).toBe(200)

    const chief = await api(manager, "/settings/return-time-chief", {
      method: "PATCH",
      body: { universal_return_times: ["16:00"] },
    })
    expect(chief.status).toBe(200)

    const normalRead = await api(manager, "/settings/return-time")
    const chiefRead = await api(manager, "/settings/return-time-chief")
    expect((await normalRead.json() as { universal_return_times: Array<{ return_time: string }> }).universal_return_times[0].return_time).toBe("15:30")
    expect((await chiefRead.json() as { universal_return_times: Array<{ return_time: string }> }).universal_return_times[0].return_time).toBe("16:00")
  })
})
