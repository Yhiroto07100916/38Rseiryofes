declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { createSession } from "../src/lib/session"
import { handleNotifications } from "../src/routes/notifications"

const userIds: string[] = []
const sessionIds: string[] = []
const notificationIds: string[] = []

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__))
})

afterEach(async () => {
  for (const id of notificationIds.splice(0)) {
    await env.DB.prepare("DELETE FROM notifications WHERE id = ?").bind(id).run()
  }
  for (const id of sessionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run()
  }
  for (const id of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run()
  }
})

async function createUser(): Promise<{ userId: string; cookie: string }> {
  const userId = crypto.randomUUID()
  userIds.push(userId)
  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name, nickname) VALUES (?, ?, ?, NULL)",
  ).bind(userId, "notification-test-" + userId, "通知テストユーザー").run()
  const sessionId = await createSession(env, userId)
  sessionIds.push(sessionId)
  return { userId, cookie: "session_id=" + sessionId }
}

async function insertNotification(
  userId: string,
  values: Partial<{
    category: string
    title: string
    body: string
    isRead: number
    createdAt: string
  }> = {},
): Promise<string> {
  const id = crypto.randomUUID()
  notificationIds.push(id)
  const now = values.createdAt || new Date().toISOString().replace("T", " ").slice(0, 19)
  await env.DB.prepare(
    "INSERT INTO notifications (id, recipient_user_id, event_key, category, title, body, target_url, dedupe_key, is_read, created_at, expires_at) " +
    "VALUES (?, ?, 'test.created', ?, ?, ?, '/tasks/test', ?, ?, ?, datetime('now', '+90 days'))",
  ).bind(
    id,
    userId,
    values.category || "tasks",
    values.title || "テスト通知",
    values.body || "通知本文",
    "test:" + id,
    values.isRead ?? 0,
    now,
  ).run()
  return id
}

function request(method: string, path: string, cookie: string, body?: unknown): Request {
  return new Request("https://worker.example.com/api/notifications" + path, {
    method,
    headers: {
      Cookie: cookie,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

describe("Notification center API", () => {
  it("requires authentication", async () => {
    const response = await handleNotifications(
      new Request("https://worker.example.com/api/notifications"),
      env,
      [],
    )
    expect(response.status).toBe(401)
  })

  it("returns only notifications belonging to the current account", async () => {
    const first = await createUser()
    const second = await createUser()
    const firstId = await insertNotification(first.userId, { title: "自分宛て" })
    await insertNotification(second.userId, { title: "別アカウント宛て" })

    const response = await handleNotifications(
      request("GET", "", first.cookie),
      env,
      [],
    )
    const data = await response.json() as { notifications: Array<{ id: string; title: string }> }

    expect(response.status).toBe(200)
    expect(data.notifications).toHaveLength(1)
    expect(data.notifications[0]).toMatchObject({ id: firstId, title: "自分宛て" })
  })

  it("returns current read states for loaded notifications even when filters exclude them", async () => {
    const user = await createUser()
    const id = await insertNotification(user.userId)

    const updated = await handleNotifications(
      request("PATCH", "/" + id + "/read", user.cookie, { is_read: true }),
      env,
      [id, "read"],
    )
    expect(updated.status).toBe(200)

    const response = await handleNotifications(
      request("GET", "?read=unread&known_ids=" + id, user.cookie),
      env,
      [],
    )
    const data = await response.json() as {
      notifications: Array<{ id: string }>
      known_notifications: Array<{ id: string; is_read: number; read_updated_at: string; read_version: number }>
    }

    expect(data.notifications).toHaveLength(0)
    expect(data.known_notifications).toEqual(expect.arrayContaining([expect.objectContaining({ id, is_read: 1, read_version: expect.any(Number) })]))
  })

  it("returns notifications newest first and limits each page to 20", async () => {
    const user = await createUser()
    for (let i = 0; i < 22; i += 1) {
      await insertNotification(user.userId, { title: "通知 " + i })
    }

    const response = await handleNotifications(
      request("GET", "?limit=100", user.cookie),
      env,
      [],
    )
    const data = await response.json() as {
      notifications: Array<{ id: string }>
      next_cursor: { id: string } | null
    }

    expect(data.notifications).toHaveLength(20)
    expect(data.next_cursor).not.toBeNull()
  })

  it("updates read state only for the owning account", async () => {
    const owner = await createUser()
    const other = await createUser()
    const id = await insertNotification(owner.userId)

    const forbidden = await handleNotifications(
      request("PATCH", "/" + id + "/read", other.cookie, { is_read: true }),
      env,
      [id, "read"],
    )
    expect(forbidden.status).toBe(404)

    const updated = await handleNotifications(
      request("PATCH", "/" + id + "/read", owner.cookie, { is_read: true }),
      env,
      [id, "read"],
    )
    expect(updated.status).toBe(200)
    const updateBody = await updated.json() as { read_updated_at: string; read_version: number }
    expect(updateBody.read_updated_at).toBeTruthy()

    const stored = await env.DB.prepare(
      "SELECT is_read, read_updated_at, read_version FROM notifications WHERE id = ?",
    ).bind(id).first<{ is_read: number; read_updated_at: string; read_version: number }>()
    expect(stored?.is_read).toBe(1)
    expect(stored?.read_updated_at).toBe(updateBody.read_updated_at)
    expect(stored?.read_version).toBe(updateBody.read_version)
    expect(updateBody.read_version).toBe(1)

    const refetched = await handleNotifications(
      request("GET", "/" + id, owner.cookie),
      env,
      [id],
    )
    const refetchedBody = await refetched.json() as { notification: { is_read: number; read_updated_at: string; read_version: number } }
    expect(refetchedBody.notification.is_read).toBe(1)
    expect(refetchedBody.notification.read_updated_at).toBe(updateBody.read_updated_at)
    expect(refetchedBody.notification.read_version).toBe(updateBody.read_version)
    expect(refetchedBody.notification.read_version).toBe(updateBody.read_version)

    const secondUpdate = await handleNotifications(
      request("PATCH", "/" + id + "/read", owner.cookie, { is_read: false }),
      env,
      [id, "read"],
    )
    const secondUpdateBody = await secondUpdate.json() as { read_version: number }
    expect(secondUpdateBody.read_version).toBe(updateBody.read_version + 1)
  })

  it("uses enabled-by-default push preferences and persists category/global changes", async () => {
    const user = await createUser()
    const initial = await handleNotifications(
      request("GET", "/settings", user.cookie),
      env,
      ["settings"],
    )
    const initialData = await initial.json() as {
      global_push_enabled: boolean
      categories: Record<string, boolean>
    }
    expect(initialData.global_push_enabled).toBe(true)
    expect(initialData.categories.tasks).toBe(true)
    expect(initialData.categories.milk_collection).toBe(true)

    const updated = await handleNotifications(
      request("PATCH", "/settings", user.cookie, {
        global_push_enabled: false,
        categories: { tasks: false, milk_collection: true },
      }),
      env,
      ["settings"],
    )
    expect(updated.status).toBe(200)

    const refreshed = await handleNotifications(
      request("GET", "/settings", user.cookie),
      env,
      ["settings"],
    )
    const refreshedData = await refreshed.json() as {
      global_push_enabled: boolean
      categories: Record<string, boolean>
    }
    expect(refreshedData.global_push_enabled).toBe(false)
    expect(refreshedData.categories.tasks).toBe(false)
    expect(refreshedData.categories.milk_collection).toBe(true)
    expect(refreshedData.categories.calendar).toBe(true)
  })

  it("marks only the unread notifications present at the start as read", async () => {
    const user = await createUser()
    const unreadId = await insertNotification(user.userId)
    await insertNotification(user.userId, { isRead: 1 })

    const response = await handleNotifications(
      request("POST", "/read-all", user.cookie),
      env,
      ["read-all"],
    )
    const data = await response.json() as {
      updated_count: number
      updated_ids: string[]
      updated_read_states: Array<{ id: string; read_updated_at: string; read_version: number }>
    }

    expect(response.status).toBe(200)
    expect(data.updated_count).toBe(1)
    expect(data.updated_ids).toEqual([unreadId])
    expect(data.updated_read_states).toHaveLength(1)
    expect(data.updated_read_states[0]?.id).toBe(unreadId)
    expect(data.updated_read_states[0]?.read_updated_at).toBeTruthy()
    expect(data.updated_read_states[0]?.read_version).toBe(1)

    const storedReadState = await env.DB.prepare(
      "SELECT is_read, read_updated_at, read_version FROM notifications WHERE id = ?",
    ).bind(unreadId).first<{ is_read: number; read_updated_at: string; read_version: number }>()
    expect(storedReadState?.is_read).toBe(1)
    expect(storedReadState?.read_updated_at).toBe(data.updated_read_states[0]?.read_updated_at)
    expect(storedReadState?.read_version).toBe(data.updated_read_states[0]?.read_version)

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notifications WHERE recipient_user_id = ? AND is_read = 0",
    ).bind(user.userId).first<{ count: number }>()
    expect(count?.count).toBe(0)
  })
  it("returns zero when mark-all-read is pressed with no unread notifications", async () => {
    const user = await createUser()
    await insertNotification(user.userId, { isRead: 1 })

    const response = await handleNotifications(
      request("POST", "/read-all", user.cookie),
      env,
      ["read-all"],
    )
    const data = await response.json() as { updated_count: number }

    expect(response.status).toBe(200)
    expect(data.updated_count).toBe(0)
  })

  it("searches by the visible Japanese category label", async () => {
    const user = await createUser()
    const taskNotification = await insertNotification(user.userId, { category: "tasks" })
    await insertNotification(user.userId, { category: "calendar", title: "予定の通知" })

    const response = await handleNotifications(
      request("GET", "?search=" + encodeURIComponent("タスク"), user.cookie),
      env,
      [],
    )
    const data = await response.json() as { notifications: Array<{ id: string }> }
    expect(data.notifications.map(item => item.id)).toContain(taskNotification)
    expect(data.notifications).toHaveLength(1)
  })
})
