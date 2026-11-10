declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { canAccessNotificationTarget, processDueNotificationPushDeliveries } from "../src/routes/push"

const userIds: string[] = []
const notificationIds: string[] = []
const subscriptionIds: string[] = []
const calendarEventIds: string[] = []

const pushEnv = Object.assign(Object.create(env), {
  VAPID_PUBLIC_KEY: "test-public-key",
  VAPID_PRIVATE_KEY: JSON.stringify({}),
}) as Env

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__))
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  for (const id of notificationIds.splice(0)) {
    await env.DB.prepare("DELETE FROM notifications WHERE id = ?").bind(id).run()
  }
  for (const id of calendarEventIds.splice(0)) {
    await env.DB.prepare("DELETE FROM calendar_events WHERE id = ?").bind(id).run()
  }
  for (const id of subscriptionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(id).run()
  }
  for (const id of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run()
  }
})

async function createUser(name: string): Promise<string> {
  const id = crypto.randomUUID()
  userIds.push(id)
  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name, nickname) VALUES (?, ?, ?, NULL)",
  ).bind(id, "notification-push-" + id, name).run()
  return id
}

describe("notification Push delivery account isolation", () => {
  it("suppresses an attendance reminder if the recipient answers before Push delivery", async () => {
    const recipientId = await createUser("出欠回答済みユーザー")
    const eventId = crypto.randomUUID()
    const startsAt = new Date(Date.now() + 60 * 60_000).toISOString()
    calendarEventIds.push(eventId)

    await env.DB.prepare(
      "INSERT INTO user_permissions (user_id, permission_id, effect) " +
      "SELECT ?, id, 'allow' FROM permissions WHERE key = 'schedule.view'",
    ).bind(recipientId).run()
    await env.DB.prepare(
      "INSERT INTO calendar_events (id, title, starts_at, is_all_day, created_by) VALUES (?, ?, ?, 0, ?)",
    ).bind(eventId, "出欠リマインダーテスト", startsAt, recipientId).run()
    await env.DB.prepare(
      "INSERT INTO calendar_event_attendance (event_id, user_id, status) VALUES (?, ?, 'attending')",
    ).bind(eventId, recipientId).run()

    const delivery = {
      delivery_id: crypto.randomUUID(),
      notification_id: crypto.randomUUID(),
      subscription_id: crypto.randomUUID(),
      attempt_count: 0,
      endpoint: "https://fcm.googleapis.com/fcm/send/test",
      p256dh: "test-p256dh",
      auth: "test-auth",
      title: "出欠を回答してください",
      body: "予定",
      target_url: "/calendar",
      recipient_user_id: recipientId,
      category: "calendar",
      event_key: "calendar.attendance_reminder_1h",
      dedupe_key: "calendar.attendance_reminder_1h:" + eventId + ":" + startsAt + ":1h",
      required_permission: "schedule.view",
      entity_type: "calendar_event",
      entity_id: eventId,
    }

    expect(await canAccessNotificationTarget(env, delivery)).toBe(false)

    await env.DB.prepare(
      "UPDATE calendar_event_attendance SET status = 'undecided' WHERE event_id = ? AND user_id = ?",
    ).bind(eventId, recipientId).run()
    expect(await canAccessNotificationTarget(env, delivery)).toBe(true)
  })

  it("does not send an old account's notification to a subscription reassigned to another account", async () => {
    const recipientId = await createUser("通知の受信者")
    const currentSubscriptionOwnerId = await createUser("現在の端末所有者")
    const notificationId = crypto.randomUUID()
    const subscriptionId = crypto.randomUUID()
    const endpoint = "https://fcm.googleapis.com/fcm/send/" + crypto.randomUUID()
    notificationIds.push(notificationId)
    subscriptionIds.push(subscriptionId)

    await env.DB.prepare(
      "INSERT INTO notifications (id, recipient_user_id, event_key, category, title, body, target_url, dedupe_key, expires_at) " +
      "VALUES (?, ?, 'tasks.created', 'tasks', 'テスト通知', '本文', '/tasks/test', ?, datetime('now', '+90 days'))",
    ).bind(notificationId, recipientId, "test:" + notificationId).run()

    await env.DB.prepare(
      "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)",
    ).bind(subscriptionId, currentSubscriptionOwnerId, endpoint, "test-p256dh", "test-auth").run()

    await env.DB.prepare(
      "INSERT INTO notification_push_deliveries (id, notification_id, subscription_id, status, attempt_count, next_attempt_at) " +
      "VALUES (?, ?, ?, 'pending', 0, CURRENT_TIMESTAMP)",
    ).bind(crypto.randomUUID(), notificationId, subscriptionId).run()

    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }))
    vi.stubGlobal("fetch", fetchMock)

    await processDueNotificationPushDeliveries(pushEnv)

    expect(fetchMock).not.toHaveBeenCalled()

    const delivery = await env.DB.prepare(
      "SELECT status FROM notification_push_deliveries WHERE notification_id = ?",
    ).bind(notificationId).first<{ status: string }>()
    expect(delivery?.status).toBe("failed")
  })
})
