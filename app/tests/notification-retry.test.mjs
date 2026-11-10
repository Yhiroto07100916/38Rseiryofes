import assert from "node:assert/strict"
import test from "node:test"
import {
  getNotificationFailureLimit,
  getNotificationRetryDelay,
  NOTIFICATION_MAX_FAILURES,
} from "../app/utils/notification-retry.ts"

test("uses the expected retry backoff sequence", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map(getNotificationRetryDelay),
    [10_000, 20_000, 40_000, 60_000, 60_000, 60_000],
  )
})

test("rejects invalid retry failure counts", () => {
  for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(getNotificationRetryDelay(value), null)
  }
})

test("allows five automatic failures", () => {
  assert.equal(getNotificationFailureLimit(false), 5)
  assert.equal(NOTIFICATION_MAX_FAILURES, 5)
})

test("allows one additional attempt after a manual retry", () => {
  assert.equal(getNotificationFailureLimit(true), 6)
})
