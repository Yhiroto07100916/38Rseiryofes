const RETRY_DELAYS = [10_000, 20_000, 40_000, 60_000] as const

export const NOTIFICATION_MAX_FAILURES = 5

export function getNotificationRetryDelay(failureCount: number): number | null {
  if (!Number.isInteger(failureCount) || failureCount < 1) return null
  return RETRY_DELAYS[Math.min(failureCount - 1, RETRY_DELAYS.length - 1)] ?? null
}

export function getNotificationFailureLimit(manualRetryActive: boolean): number {
  return NOTIFICATION_MAX_FAILURES + (manualRetryActive ? 1 : 0)
}
