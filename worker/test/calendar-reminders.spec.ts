declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env } from "cloudflare:test"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { processDailyScheduleNotifications, processDueCalendarNotifications } from "../src/routes/calendar-reminders"

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

  it("excludes users who already answered and keeps undecided users eligible", async () => {
    const unanswered = await createViewer()
    const undecided = await createViewer()
    const attending = await createViewer()
    const notAttending = await createViewer()
    const eventId = crypto.randomUUID()
    const currentMinute = Math.floor(Date.now() / 60_000) * 60_000
    const startsAt = new Date(currentMinute + 60 * 60_000).toISOString()

    await env.DB.prepare(
      "INSERT INTO calendar_events (id, title, starts_at, is_all_day, created_by) VALUES (?, ?, ?, 0, ?)",
    ).bind(eventId, "回答状況テスト", startsAt, unanswered).run()

    await env.DB.batch([
      env.DB.prepare("INSERT INTO calendar_event_attendance (event_id, user_id, status) VALUES (?, ?, 'undecided')").bind(eventId, undecided),
      env.DB.prepare("INSERT INTO calendar_event_attendance (event_id, user_id, status) VALUES (?, ?, 'attending')").bind(eventId, attending),
      env.DB.prepare("INSERT INTO calendar_event_attendance (event_id, user_id, status) VALUES (?, ?, 'not_attending')").bind(eventId, notAttending),
    ])

    try {
      await processDueCalendarNotifications(env)
      const rows = await env.DB.prepare(
        "SELECT recipient_user_id FROM notifications WHERE entity_type = 'calendar_event' AND entity_id = ? AND event_key = 'calendar.attendance_reminder_1h'",
      ).bind(eventId).all<{ recipient_user_id: string }>()
      const recipients = rows.results.map(row => row.recipient_user_id)

      expect(recipients).toContain(unanswered)
      expect(recipients).toContain(undecided)
      expect(recipients).not.toContain(attending)
      expect(recipients).not.toContain(notAttending)
    } finally {
      await env.DB.prepare("DELETE FROM notifications WHERE entity_id = ?").bind(eventId).run()
      await env.DB.prepare("DELETE FROM calendar_events WHERE id = ?").bind(eventId).run()
      await env.DB.prepare("DELETE FROM users WHERE id IN (?, ?, ?, ?)").bind(unanswered, undecided, attending, notAttending).run()
    }
  })

  it("sends all-day reminders at 18:00 on the previous day and 08:00 on the same day in JST", async () => {
    const userId = await createViewer()
    const eventId = crypto.randomUUID()
    const startsAt = "2026-11-11T00:00:00+09:00"

    await env.DB.prepare(
      "INSERT INTO calendar_events (id, title, starts_at, is_all_day, created_by) VALUES (?, ?, ?, 1, ?)",
    ).bind(eventId, "終日予定テスト", startsAt, userId).run()

    try {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-11-10T18:00:00+09:00"))
      await processDueCalendarNotifications(env)

      vi.setSystemTime(new Date("2026-11-11T08:00:00+09:00"))
      await processDueCalendarNotifications(env)

      const rows = await env.DB.prepare(
        "SELECT event_key, recipient_user_id FROM notifications WHERE entity_type = 'calendar_event' AND entity_id = ? ORDER BY event_key",
      ).bind(eventId).all<{ event_key: string; recipient_user_id: string }>()

      expect(rows.results).toContainEqual({
        event_key: "calendar.all_day_reminder_previous_18",
        recipient_user_id: userId,
      })
      expect(rows.results).toContainEqual({
        event_key: "calendar.all_day_reminder_same_day_08",
        recipient_user_id: userId,
      })
    } finally {
      vi.useRealTimers()
      await env.DB.prepare("DELETE FROM notifications WHERE entity_id = ?").bind(eventId).run()
      await env.DB.prepare("DELETE FROM calendar_events WHERE id = ?").bind(eventId).run()
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run()
    }
  })


  it("sends one daily schedule digest at the configured JST time to schedule viewers only", async () => {
    const viewer = await createViewer()
    const unrelatedUser = crypto.randomUUID()
    await env.DB.prepare(
      "INSERT INTO users (id, student_number, name, nickname) VALUES (?, ?, ?, NULL)",
    ).bind(unrelatedUser, "calendar-digest-" + unrelatedUser, "権限なし").run()

    const timedEventId = crypto.randomUUID()
    const allDayEventId = crypto.randomUUID()
    const previousSettings = await env.DB.prepare(
      "SELECT value FROM site_settings WHERE key = 'notification_settings'",
    ).first<{ value: string }>()
    await env.DB.prepare(
      "UPDATE site_settings SET value = ? WHERE key = 'notification_settings'",
    ).bind(JSON.stringify({
      enabled: true,
      categories: { calendar: true },
      return_due_all_users: true,
      daily_schedule: { enabled: true, time: "08:00" },
    })).run()

    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO calendar_events (id, title, starts_at, is_all_day, created_by) VALUES (?, ?, ?, 0, ?)",
      ).bind(timedEventId, "朝の準備", "2026-11-28T09:00:00+09:00", viewer),
      env.DB.prepare(
        "INSERT INTO calendar_events (id, title, starts_at, is_all_day, created_by) VALUES (?, ?, ?, 1, ?)",
      ).bind(allDayEventId, "終日作業", "2026-11-28T00:00:00+09:00", viewer),
    ])

    try {
      vi.useFakeTimers()
      vi.setSystemTime(new Date("2026-11-27T23:00:00.000Z"))
      await processDailyScheduleNotifications(env)
      await processDailyScheduleNotifications(env)
      await processDueCalendarNotifications(env)

      const rows = await env.DB.prepare(
        "SELECT recipient_user_id, body FROM notifications WHERE entity_type = 'calendar_daily_schedule' AND entity_id = '2026-11-28'",
      ).all<{ recipient_user_id: string; body: string }>()

      expect(rows.results).toHaveLength(1)
      expect(rows.results[0]?.recipient_user_id).toBe(viewer)
      expect(rows.results[0]?.body).toContain("朝の準備")
      expect(rows.results[0]?.body).toContain("終日作業")

      const sameDayAllDayReminder = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM notifications WHERE entity_id = ? AND event_key = 'calendar.all_day_reminder_same_day_08'",
      ).bind(allDayEventId).first<{ count: number }>()
      expect(sameDayAllDayReminder?.count).toBe(0)
    } finally {
      vi.useRealTimers()
      await env.DB.prepare(
        "DELETE FROM notifications WHERE entity_id IN (?, ?) OR (entity_type = 'calendar_daily_schedule' AND entity_id = '2026-11-28')",
      ).bind(timedEventId, allDayEventId).run()
      await env.DB.prepare("DELETE FROM calendar_events WHERE id IN (?, ?)").bind(timedEventId, allDayEventId).run()
      if (previousSettings?.value) {
        await env.DB.prepare("UPDATE site_settings SET value = ? WHERE key = 'notification_settings'")
          .bind(previousSettings.value).run()
      }
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(unrelatedUser).run()
      await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(viewer).run()
    }
  })

})
