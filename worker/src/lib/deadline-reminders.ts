export const DEADLINE_REMINDER_OPTIONS = [
  { minutes: 10080, label: "7日前", key: "7d" },
  { minutes: 4320, label: "3日前", key: "3d" },
  { minutes: 1440, label: "24時間前", key: "24h" },
  { minutes: 720, label: "12時間前", key: "12h" },
  { minutes: 180, label: "3時間前", key: "3h" },
  { minutes: 30, label: "30分前", key: "30m" },
  { minutes: 15, label: "15分前", key: "15m" },
  { minutes: 10, label: "10分前", key: "10m" },
  { minutes: 5, label: "5分前", key: "5m" },
] as const

export const DEFAULT_TASK_DEADLINE_REMINDERS = [4320, 1440, 180, 30]
export const DEFAULT_SUBMISSION_DEADLINE_REMINDERS = [10080, 4320, 1440, 180, 30]

const allowedOffsets = new Set<number>(DEADLINE_REMINDER_OPTIONS.map(option => option.minutes))

export function normalizeDeadlineReminderOffsets(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return [...fallback]
  return [...new Set(value.filter(
    (item): item is number => typeof item === "number" && Number.isInteger(item) && allowedOffsets.has(item),
  ))].sort((a, b) => b - a)
}

export function isDeadlineReminderDue(dueAt: number, now: number, offsetMinutes: number): boolean {
  const remaining = dueAt - now
  const offsetMilliseconds = offsetMinutes * 60_000
  // Cron runs every minute; tolerate minor scheduling jitter without sending overdue reminders.
  return remaining > offsetMilliseconds - 2 * 60_000 && remaining <= offsetMilliseconds
}

export function getDeadlineReminderOption(offsetMinutes: number) {
  return DEADLINE_REMINDER_OPTIONS.find(option => option.minutes === offsetMinutes)
}
