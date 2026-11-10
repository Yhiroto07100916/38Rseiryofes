declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { canAccessNotificationTarget, processDueNotificationPushDeliveries } from "../src/routes/push"

const userIds: string[] = []
const notificationIds: string[] = []
const subscriptionIds: string[] = []
const surveyIds: string[] = []
const calendarEventIds: string[] = []
const taskIds: string[] = []

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
  for (const id of surveyIds.splice(0)) {
    await env.DB.prepare("DELETE FROM surveys WHERE id = ?").bind(id).run()
  }
  for (const id of taskIds.splice(0)) {
    await env.DB.prepare("DELETE FROM tasks WHERE id = ?").bind(id).run()
  }
  for (const id of subscriptionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(id).run()
  }
  for (const id of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run()
  }
})

async function createUser(name: string, permissions: string[] = []): Promise<string> {
  const id = crypto.randomUUID()
  userIds.push(id)
  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name, nickname) VALUES (?, ?, ?, NULL)",
  ).bind(id, "notification-push-" + id, name).run()
  for (const permission of permissions) {
    await env.DB.prepare(
      "INSERT INTO user_permissions (user_id, permission_id, effect) " +
      "SELECT ?, id, 'allow' FROM permissions WHERE key = ?",
    ).bind(id, permission).run()
  }
  return id
}

function deliveryFor(input: {
  recipientId: string
  category: string
  eventKey: string
  entityType: string
  entityId: string
  targetUrl: string
  requiredPermission?: string | null
  dedupeKey?: string
}): Parameters<typeof canAccessNotificationTarget>[1] {
  return {
    delivery_id: crypto.randomUUID(),
    notification_id: crypto.randomUUID(),
    subscription_id: crypto.randomUUID(),
    attempt_count: 0,
    endpoint: "https://fcm.googleapis.com/fcm/send/test",
    p256dh: "test",
    auth: "test",
    title: "テスト通知",
    body: "本文",
    target_url: input.targetUrl,
    recipient_user_id: input.recipientId,
    category: input.category,
    event_key: input.eventKey,
    dedupe_key: input.dedupeKey ?? input.eventKey + ":" + input.entityId,
    required_permission: input.requiredPermission ?? null,
    entity_type: input.entityType,
    entity_id: input.entityId,
  }
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

  it("suppresses survey publication Push after respondent permission is revoked", async () => {
    const creatorId = await createUser("アンケート作成者")
    const recipientId = await createUser("閲覧のみ", ["surveys.view"])
    const surveyId = crypto.randomUUID()
    surveyIds.push(surveyId)
    await env.DB.prepare(
      "INSERT INTO surveys (id, title, status, created_by) VALUES (?, ?, 'published', ?)",
    ).bind(surveyId, "回答アンケート", creatorId).run()

    const allowed = await canAccessNotificationTarget(env, deliveryFor({
      recipientId,
      category: "surveys",
      eventKey: "surveys.published",
      entityType: "survey",
      entityId: surveyId,
      targetUrl: "/surveys?open=" + surveyId,
    }))

    expect(allowed).toBe(false)
  })

  it("suppresses timed reminders after an event becomes all-day", async () => {
    const creatorId = await createUser("予定作成者")
    const recipientId = await createUser("予定閲覧者", ["schedule.view"])
    const eventId = crypto.randomUUID()
    const startsAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString()
    calendarEventIds.push(eventId)
    await env.DB.prepare(
      "INSERT INTO calendar_events (id, title, starts_at, is_all_day, created_by) VALUES (?, ?, ?, 1, ?)",
    ).bind(eventId, "終日予定", startsAt, creatorId).run()

    const allowed = await canAccessNotificationTarget(env, deliveryFor({
      recipientId,
      category: "calendar",
      eventKey: "calendar.reminder_24h",
      entityType: "calendar_event",
      entityId: eventId,
      targetUrl: "/calendar/" + eventId,
      requiredPermission: "schedule.view",
      dedupeKey: "calendar.reminder_24h:" + eventId + ":" + startsAt + ":24h",
    }))

    expect(allowed).toBe(false)
  })

  it("still delivers assignment removal notices after task access is lost", async () => {
    const creatorId = await createUser("タスク作成者")
    const removedAssigneeId = await createUser("担当解除されたユーザー")
    const taskId = crypto.randomUUID()
    taskIds.push(taskId)
    await env.DB.prepare(
      "INSERT INTO tasks (id, title, scope, status, priority, created_by) VALUES (?, ?, 'class', 'todo', 'medium', ?)",
    ).bind(taskId, "担当解除通知テスト", creatorId).run()

    const allowed = await canAccessNotificationTarget(env, deliveryFor({
      recipientId: removedAssigneeId,
      category: "tasks",
      eventKey: "task.assignee_removed",
      entityType: "task",
      entityId: taskId,
      targetUrl: "/tasks",
    }))

    expect(allowed).toBe(true)
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
