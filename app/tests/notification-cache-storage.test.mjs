import assert from "node:assert/strict"
import test from "node:test"
import {
  installFakeIndexedDB,
  readFakeIndexedDBRecord,
  writeFakeIndexedDBRecord,
} from "./helpers/fake-indexeddb.mjs"

installFakeIndexedDB()

const {
  deleteNotificationCache,
  loadNotificationCache,
  saveNotificationCache,
} = await import("../app/utils/notification-cache.ts")

const DATABASE_NAME = "38r-notification-cache"
const STORE_NAME = "accounts"
const now = Date.now()

function notification(id, createdAt = now) {
  return {
    id,
    title: `通知 ${id}`,
    body: "テスト本文",
    category: "news",
    target_url: null,
    is_read: 0,
    created_at: new Date(createdAt).toISOString(),
  }
}

test("persists cache records separately for each account", async () => {
  await saveNotificationCache("account-a", [notification("a-1")], 1)
  await saveNotificationCache("account-b", [notification("b-1")], 2)

  const accountA = await loadNotificationCache("account-a")
  const accountB = await loadNotificationCache("account-b")

  assert.deepEqual(accountA?.notifications.map(item => item.id), ["a-1"])
  assert.equal(accountA?.unreadCount, 1)
  assert.deepEqual(accountB?.notifications.map(item => item.id), ["b-1"])
  assert.equal(accountB?.unreadCount, 2)
})

test("deleting one account cache does not affect another account", async () => {
  await deleteNotificationCache("account-a")

  assert.equal(await loadNotificationCache("account-a"), null)
  assert.deepEqual(
    (await loadNotificationCache("account-b"))?.notifications.map(item => item.id),
    ["b-1"],
  )
})

test("limits persisted notifications to the newest 100 records", async () => {
  const notifications = Array.from({ length: 105 }, (_, index) =>
    notification(`item-${index}`, now - (104 - index) * 1000),
  )

  await saveNotificationCache("account-c", notifications, 7)
  const cached = await loadNotificationCache("account-c")

  assert.equal(cached?.notifications.length, 100)
  assert.equal(cached?.notifications[0]?.id, "item-104")
  assert.equal(cached?.notifications.at(-1)?.id, "item-5")
})

test("removes malformed persisted records instead of returning them", async () => {
  await saveNotificationCache("account-d", [notification("d-1")], 1)
  const record = readFakeIndexedDBRecord(DATABASE_NAME, STORE_NAME, "account-d")
  assert.ok(record)
  record.unreadCount = -1
  writeFakeIndexedDBRecord(DATABASE_NAME, STORE_NAME, "account-d", record)

  const cached = await loadNotificationCache("account-d")
  assert.equal(cached, null)
  assert.equal(readFakeIndexedDBRecord(DATABASE_NAME, STORE_NAME, "account-d"), undefined)
})

test("blocks writes after deletion until the next cache load", async () => {
  await saveNotificationCache("account-e", [notification("e-1")], 1)
  await deleteNotificationCache("account-e")
  await saveNotificationCache("account-e", [notification("e-2")], 1)

  assert.equal(await loadNotificationCache("account-e"), null)

  await saveNotificationCache("account-e", [notification("e-3")], 1)
  assert.deepEqual(
    (await loadNotificationCache("account-e"))?.notifications.map(item => item.id),
    ["e-3"],
  )
})
