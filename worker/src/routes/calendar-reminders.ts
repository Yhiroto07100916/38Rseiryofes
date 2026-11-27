import { hasPermission } from "../lib/authz"
import { createNotificationsForUsers } from "../lib/notifications"
import { getSiteSetting } from "../lib/site-settings"

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

function isDueAtMinute(targetAt: number, nowMinute: number): boolean {
  const targetMinute = Math.floor(targetAt / 60_000)
  return targetMinute <= nowMinute && targetMinute > nowMinute - 5
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
    targetUrl: "/calendar/" + event.id,
    requiredPermission: "schedule.view",
    entityType: "calendar_event",
    entityId: event.id,
    dedupeKey: eventKey + ":" + event.id + ":" + event.starts_at + ":" + suffix,
  })
}

export async function processDueCalendarNotifications(env: Env): Promise<void> {
  const now = new Date()
  const nowMinute = minuteKey(now)
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 5 * 60_000)
  const notificationSettings = await getSiteSetting<{ daily_schedule?: { enabled?: boolean; time?: string } }>(
    env, "notification_settings", {},
  )
  const dailyScheduleEnabled = notificationSettings.daily_schedule?.enabled === true
  const events = await env.DB.prepare(
    "SELECT id, title, starts_at, is_all_day, created_by FROM calendar_events " +
    "WHERE datetime(starts_at) >= datetime(?) AND datetime(starts_at) <= datetime(?) ORDER BY starts_at ASC",
  ).bind(windowStart.toISOString(), windowEnd.toISOString()).all<ReminderEvent>()

  if (events.results.length === 0) return

  const scheduleUsers = await usersWithPermission(env, "schedule.view")

  for (const event of events.results) {
    const startsAt = new Date(event.starts_at)
    if (Number.isNaN(startsAt.getTime())) continue

    const recipients = scheduleUsers
    const reminder24h = startsAt.getTime() - 24 * 60 * 60 * 1000
    const reminder1h = startsAt.getTime() - 60 * 60 * 1000

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

      if (isDueAtMinute(previous, nowMinute)) {
        await notify(env, event, "calendar.all_day_reminder_previous_18",
          "明日の終日予定のお知らせ", recipients, "previous-18")
      }
      if (isDueAtMinute(sameDay, nowMinute) && !dailyScheduleEnabled) {
        await notify(env, event, "calendar.all_day_reminder_same_day_08",
          "本日の終日予定のお知らせ", recipients, "same-day-08")
      }
    } else {
      if (isDueAtMinute(reminder24h, nowMinute)) {
        await notify(env, event, "calendar.reminder_24h",
          "予定の開始24時間前です", recipients, "24h")
      }
      if (isDueAtMinute(reminder1h, nowMinute)) {
        await notify(env, event, "calendar.reminder_1h",
          "予定の開始1時間前です", recipients, "1h")
      }
    }

    if (isDueAtMinute(reminder24h, nowMinute)) {
      await notify(env, event, "calendar.attendance_reminder_24h",
        "予定の出欠を回答してください（24時間前）", nonResponders, "attendance-24h")
    }
    if (isDueAtMinute(reminder1h, nowMinute)) {
      await notify(env, event, "calendar.attendance_reminder_1h",
        "予定の出欠を回答してください（1時間前）", nonResponders, "attendance-1h")
    }
  }
}


export async function processDailyScheduleNotifications(env: Env): Promise<void> {
  const notificationSettings = await getSiteSetting<{ daily_schedule?: { enabled?: boolean; time?: string } }>(
    env, "notification_settings", {},
  )
  const dailySchedule = notificationSettings.daily_schedule
  if (dailySchedule?.enabled !== true || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(dailySchedule.time ?? "")) {
    return
  }

  const now = new Date()
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now)
  const [scheduledHour, scheduledMinute] = dailySchedule.time.split(":").map(Number)
  const [currentHour, currentMinute] = clock.split(":").map(Number)
  const minutesSinceSchedule = currentHour! * 60 + currentMinute! - (scheduledHour! * 60 + scheduledMinute!)
  // A short catch-up window tolerates Cron delays; the daily dedupe key prevents repeats.
  if (minutesSinceSchedule < 0 || minutesSinceSchedule >= 5) return

  const { year, month, day } = jstParts(now)
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const dayStart = new Date(Date.UTC(year, month - 1, day, -9))
  const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
  const events = await env.DB.prepare(
    "SELECT id, title, starts_at, ends_at, is_all_day FROM calendar_events " +
    "WHERE datetime(starts_at) < datetime(?) " +
    "AND ((ends_at IS NULL AND datetime(starts_at) >= datetime(?)) " +
    "OR (ends_at IS NOT NULL AND datetime(ends_at) >= datetime(?))) " +
    "ORDER BY starts_at ASC",
  ).bind(nextDayStart.toISOString(), dayStart.toISOString(), dayStart.toISOString()).all<{
    id: string
    title: string
    starts_at: string
    ends_at: string | null
    is_all_day: number
  }>()

  if (events.results.length === 0) return

  const recipients = await usersWithPermission(env, "schedule.view")
  if (recipients.length === 0) return

  const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
  const lines = events.results.slice(0, 10).map(event => {
    if (event.is_all_day === 1) return `・終日 ${event.title}`
    const startsAt = new Date(event.starts_at)
    const timeLabel = startsAt.getTime() < dayStart.getTime()
      ? "継続中"
      : timeFormatter.format(startsAt)
    return `・${timeLabel} ${event.title}`
  })
  if (events.results.length > lines.length) {
    lines.push(`・ほか${events.results.length - lines.length}件`)
  }

  await createNotificationsForUsers(env, {
    recipientUserIds: recipients,
    eventKey: "calendar.daily_schedule_reminder",
    category: "calendar",
    title: `今日の予定（${dateKey}）`,
    body: lines.join("\n"),
    targetUrl: `/calendar?date=${dateKey}`,
    requiredPermission: "schedule.view",
    entityType: "calendar_daily_schedule",
    entityId: dateKey,
    dedupeKey: "calendar.daily_schedule_reminder:" + dateKey,
  })
}
