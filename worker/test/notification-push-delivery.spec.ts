declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { processDueNotificationPushDeliveries } from "../src/routes/push"

const userIds: string[] = []
const notificationIds: string[] = []
const subscriptionIds: string[] = []

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
