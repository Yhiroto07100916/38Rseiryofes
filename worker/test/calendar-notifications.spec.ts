declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env, SELF } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { createSession } from "../src/lib/session"

const userIds: string[] = []
const sessionIds: string[] = []
const eventIds: string[] = []

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__))
})

afterEach(async () => {
  for (const eventId of eventIds.splice(0)) {
    await env.DB.prepare("DELETE FROM calendar_events WHERE id = ?")
      .bind(eventId).run()
  }
  for (const sessionId of sessionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId).run()
  }
  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(userId).run()
  }
})

async function createUser(label: string): Promise<{ id: string; cookie?: string }> {
  const id = crypto.randomUUID()
  userIds.push(id)
  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name, nickname) VALUES (?, ?, ?, NULL)",
  ).bind(id, "calendar-notification-" + id, label).run()
  return { id }
}

async function grantPermission(userId: string, permission: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO user_permissions (user_id, permission_id, effect) " +
    "SELECT ?, id, 'allow' FROM permissions WHERE key = ?",
  ).bind(userId, permission).run()
}

describe("Calendar notification events", () => {
  it("notifies schedule viewers on create, meaningful update, and delete, but not color-only update", async () => {
    const actor = await createUser("予定作成者")
    const recipient = await createUser("予定閲覧者")
    const sessionId = await createSession(env, actor.id)
    sessionIds.push(sessionId)
    const cookie = "session_id=" + sessionId

    await grantPermission(actor.id, "schedule.create")
    await grantPermission(actor.id, "schedule.edit")
    await grantPermission(actor.id, "schedule.delete")
    await grantPermission(actor.id, "schedule.view")
    await grantPermission(recipient.id, "schedule.view")

    const created = await SELF.fetch("http://example.com/api/calendar/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        title: "劇練習",
        starts_at: "2030-01-01T10:00:00",
        location: "教室",
      }),
    })

    expect(created.status).toBe(201)
    const event = await created.json() as { id: string }
    eventIds.push(event.id)

    const createdNotification = await env.DB.prepare(
      "SELECT event_key, recipient_user_id, target_url FROM notifications " +
      "WHERE entity_type = 'calendar_event' AND entity_id = ?",
    ).bind(event.id).first<{
      event_key: string
      recipient_user_id: string
      target_url: string
    }>()

    expect(createdNotification).toMatchObject({
      event_key: "calendar.created",
      recipient_user_id: recipient.id,
      target_url: "/calendar/" + event.id,
    })

    const actorNotification = await env.DB.prepare(
      "SELECT id FROM notifications WHERE entity_id = ? AND recipient_user_id = ?",
    ).bind(event.id, actor.id).first()
    expect(actorNotification).toBeNull()

    const colorOnly = await SELF.fetch(
      "http://example.com/api/calendar/events/" + event.id,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ color: "#123456" }),
      },
    )
    expect(colorOnly.status).toBe(200)

    const afterColorChange = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notifications " +
      "WHERE entity_id = ? AND event_key = 'calendar.updated'",
    ).bind(event.id).first<{ count: number }>()
    expect(afterColorChange?.count).toBe(0)

    const meaningfulUpdate = await SELF.fetch(
      "http://example.com/api/calendar/events/" + event.id,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
        },
        body: JSON.stringify({ title: "劇練習・時間変更" }),
      },
    )
    expect(meaningfulUpdate.status).toBe(200)

    const updatedNotification = await env.DB.prepare(
      "SELECT event_key, recipient_user_id FROM notifications " +
      "WHERE entity_id = ? AND event_key = 'calendar.updated'",
    ).bind(event.id).first<{
      event_key: string
      recipient_user_id: string
    }>()
    expect(updatedNotification).toMatchObject({
      event_key: "calendar.updated",
      recipient_user_id: recipient.id,
    })

    const deleted = await SELF.fetch(
      "http://example.com/api/calendar/events/" + event.id,
      {
        method: "DELETE",
        headers: { Cookie: cookie },
      },
    )
    expect(deleted.status).toBe(200)

    const deletedNotification = await env.DB.prepare(
      "SELECT event_key, recipient_user_id FROM notifications " +
      "WHERE event_key = 'calendar.deleted' AND body = ?",
    ).bind("劇練習・時間変更").first<{
      event_key: string
      recipient_user_id: string
    }>()
    expect(deletedNotification).toMatchObject({
      event_key: "calendar.deleted",
      recipient_user_id: recipient.id,
    })
  })
})
