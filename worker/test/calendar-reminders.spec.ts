declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env } from "cloudflare:test"
import { beforeAll, describe, expect, it } from "vitest"
import { processDueCalendarNotifications } from "../src/routes/calendar-reminders"

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__))
})

async function createViewer(): Promise<string> {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name, nickname) VALUES (?, ?, ?, NULL)",
  ).bind(id, "calendar-reminder-" + id, "予定通知テスト").run()
  await env.DB.prepare(
    "INSERT INTO user_permissions (user_id, permission_id, effect) " +
    "SELECT ?, id, 'allow' FROM permissions WHERE key = 'schedule.view'",
  ).bind(id).run()
  return id
}

describe("Calendar reminder processing", () => {
  it("creates one-hour event and attendance reminders once for current schedule viewers", async () => {
    const userId = await createViewer()
    const eventId = crypto.randomUUID()
    const currentMinute = Math.floor(Date.now() / 60_000) * 60_000
    const startsAt = new Date(currentMinute + 60 * 60_000).toISOString()

    await env.DB.prepare(
      "INSERT INTO calendar_events (id, title, starts_at, is_all_day, created_by) " +
      "VALUES (?, ?, ?, 0, ?)",
    ).bind(eventId, "通知テスト予定", startsAt, userId).run()

    try {
      await processDueCalendarNotifications(env)
      await processDueCalendarNotifications(env)

      const rows = await env.DB.prepare(
        "SELECT event_key, recipient_user_id FROM notifications " +
        "WHERE entity_type = 'calendar_event' AND entity_id = ? ORDER BY event_key",
      ).bind(eventId).all<{ event_key: string; recipient_user_id: string }>()

      expect(rows.results).toHaveLength(2)
      expect(rows.results.map(row => row.event_key)).toEqual([
        "calendar.attendance_reminder_1h",
        "calendar.reminder_1h",
      ])
      expect(rows.results.every(row => row.recipient_user_id === userId)).toBe(true)
    } finally {
      await env.DB.prepare("DELETE FROM notifications WHERE entity_id = ?").bind(eventId).run()
      await env.DB.prepare("DELETE FROM calendar_events WHERE id = ?").bind(eventId).run()
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run()
    }
  })
})
