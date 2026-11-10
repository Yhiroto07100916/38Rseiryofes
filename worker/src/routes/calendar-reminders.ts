import { hasPermission } from "../lib/authz"
import { createNotificationsForUsers } from "../lib/notifications"

interface ReminderEvent {
  id: string
  title: string
  starts_at: string
  is_all_day: number
  created_by: string
}

function minuteKey(date: Date): number {
  return Math.floor(date.getTime() / 60_000)
}

function jstParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date)
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value)
  return { year: value("year"), month: value("month"), day: value("day") }
}

function jstDateTimeUtc(year: number, month: number, day: number, hour: number): number {
  return Date.UTC(year, month - 1, day, hour - 9)
}

async function usersWithPermission(env: Env, permission: string): Promise<string[]> {
  const users = await env.DB.prepare("SELECT id FROM users").all<{ id: string }>()
  const results = await Promise.all(users.results.map(async user => ({
    id: user.id,
    allowed: await hasPermission(env, user.id, permission),
  })))
  return results.filter(user => user.allowed).map(user => user.id)
}

async function notify(
  env: Env,
  event: ReminderEvent,
  eventKey: string,
  title: string,
  recipientUserIds: string[],
  suffix: string,
): Promise<void> {
  await createNotificationsForUsers(env, {
    recipientUserIds,
    eventKey,
    category: "calendar",
    title,
    body: event.title,
    targetUrl: "/calendar",
    requiredPermission: "schedule.view",
    entityType: "calendar_event",
    entityId: event.id,
    dedupeKey: eventKey + ":" + event.id + ":" + suffix,
  })
}

export async function processDueCalendarNotifications(env: Env): Promise<void> {
  const now = new Date()
  const nowMinute = minuteKey(now)
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const events = await env.DB.prepare(
    "SELECT id, title, starts_at, is_all_day, created_by FROM calendar_events " +
    "WHERE datetime(starts_at) >= datetime(?) AND datetime(starts_at) <= datetime(?) ORDER BY starts_at ASC",
  ).bind(windowStart.toISOString(), windowEnd.toISOString()).all<ReminderEvent>()

  if (events.results.length === 0) return

  const scheduleUsers = await usersWithPermission(env, "schedule.view")

  for (const event of events.results) {
    const startsAt = new Date(event.starts_at)
    if (Number.isNaN(startsAt.getTime())) continue

    if (event.is_all_day === 1) {
      const { year, month, day } = jstParts(startsAt)
      const previousDay = new Date(Date.UTC(year, month - 1, day - 1))
      const previous = jstDateTimeUtc(
        previousDay.getUTCFullYear(),
        previousDay.getUTCMonth() + 1,
        previousDay.getUTCDate(),
        18,
      )
      const sameDay = jstDateTimeUtc(year, month, day, 8)

      if (minuteKey(new Date(previous)) === nowMinute) {
        await notify(env, event, "calendar.all_day_reminder_previous_18",
          "明日の終日予定のお知らせ", scheduleUsers, "previous-18")
      }
      if (minuteKey(new Date(sameDay)) === nowMinute) {
        await notify(env, event, "calendar.all_day_reminder_same_day_08",
          "本日の終日予定のお知らせ", scheduleUsers, "same-day-08")
      }
      continue
    }

    const recipients = scheduleUsers
    const reminder24h = startsAt.getTime() - 24 * 60 * 60 * 1000
    const reminder1h = startsAt.getTime() - 60 * 60 * 1000

    if (minuteKey(new Date(reminder24h)) === nowMinute) {
      await notify(env, event, "calendar.reminder_24h",
        "予定の開始24時間前です", recipients, "24h")
    }
    if (minuteKey(new Date(reminder1h)) === nowMinute) {
      await notify(env, event, "calendar.reminder_1h",
        "予定の開始1時間前です", recipients, "1h")
    }

    const attendanceRecipients = await env.DB.prepare(
      "SELECT u.id FROM users u " +
      "WHERE NOT EXISTS (" +
      "SELECT 1 FROM calendar_event_attendance a " +
      "WHERE a.event_id = ? AND a.user_id = u.id " +
      "AND a.status IN ('attending', 'not_attending')" +
      ")",
    ).bind(event.id).all<{ id: string }>()
    const eligibleAttendanceUsers = new Set(attendanceRecipients.results.map(row => row.id))
    const nonResponders = recipients.filter(userId => eligibleAttendanceUsers.has(userId))

    if (minuteKey(new Date(reminder24h)) === nowMinute) {
      await notify(env, event, "calendar.attendance_reminder_24h",
        "予定の出欠を回答してください（24時間前）", nonResponders, "attendance-24h")
    }
    if (minuteKey(new Date(reminder1h)) === nowMinute) {
      await notify(env, event, "calendar.attendance_reminder_1h",
        "予定の出欠を回答してください（1時間前）", nonResponders, "attendance-1h")
    }
  }
}
