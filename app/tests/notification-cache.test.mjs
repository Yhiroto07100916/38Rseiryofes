import assert from "node:assert/strict"
import test from "node:test"
import {
  isNotificationCacheExpired,
  isNotificationCacheRecordValid,
} from "../app/utils/notification-cache.ts"

const DAY = 24 * 60 * 60 * 1000
const now = Date.parse("2026-11-10T12:00:00.000Z")

function validRecord(overrides = {}) {
  return {
    accountId: "user-1",
    version: 1,
    savedAt: now - 60_000,
    clientTimeAtSave: now - 60_000,
    serverTimeAtSave: now - 60_000,
    clockOffsetMs: 0,
    unreadCount: 2,
    notifications: [{
      id: "notification-1",
      title: "お知らせ",
      body: "本文",
      category: "news",
      target_url: null,
      is_read: 0,
      created_at: new Date(now - DAY).toISOString(),
    }],
    ...overrides,
  }
}

test("accepts a valid cache record for its account", () => {
  assert.equal(isNotificationCacheRecordValid(validRecord(), "user-1", now), true)
})

test("rejects records belonging to another account", () => {
  assert.equal(isNotificationCacheRecordValid(validRecord(), "user-2", now), false)
})

test("rejects unsupported cache versions", () => {
  assert.equal(isNotificationCacheRecordValid(validRecord({ version: 2 }), "user-1", now), false)
})

test("rejects invalid timestamps and clock metadata", () => {
  for (const record of [
    validRecord({ savedAt: Number.NaN }),
    validRecord({ savedAt: now + 5 * 60 * 1000 + 1 }),
    validRecord({ clientTimeAtSave: Number.NaN }),
    validRecord({ serverTimeAtSave: Number.POSITIVE_INFINITY }),
    validRecord({ clockOffsetMs: Number.NaN }),
  ]) {
    assert.equal(isNotificationCacheRecordValid(record, "user-1", now), false)
  }
})

test("rejects negative or fractional unread counts", () => {
  assert.equal(isNotificationCacheRecordValid(validRecord({ unreadCount: -1 }), "user-1", now), false)
  assert.equal(isNotificationCacheRecordValid(validRecord({ unreadCount: 1.5 }), "user-1", now), false)
})

test("rejects malformed and oversized notification collections", () => {
  assert.equal(isNotificationCacheRecordValid(validRecord({ notifications: [{ id: "broken" }] }), "user-1", now), false)
  assert.equal(isNotificationCacheRecordValid(validRecord({ notifications: Array(101).fill(validRecord().notifications[0]) }), "user-1", now), false)
})

test("rejects cache records older than the 90-day retention period", () => {
  assert.equal(isNotificationCacheRecordValid(validRecord({ savedAt: now - 90 * DAY - 1 }), "user-1", now), false)
})

test("keeps the exact five-minute boundary valid and expires after it", () => {
  assert.equal(isNotificationCacheExpired(now - 5 * 60 * 1000, now), false)
  assert.equal(isNotificationCacheExpired(now - 5 * 60 * 1000 - 1, now), true)
})

test("keeps the exact 90-day notification boundary valid", () => {
  const record = validRecord({
    notifications: [{
      ...validRecord().notifications[0],
      created_at: new Date(now - 90 * DAY).toISOString(),
    }],
  })
  assert.equal(isNotificationCacheRecordValid(record, "user-1", now), true)
})
