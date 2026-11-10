export interface CachedNotification {
  id: string
  title: string
  body: string
  category: string
  target_url: string | null
  is_read: number
  created_at: string
}

export interface NotificationCacheRecord {
  accountId: string
  version: number
  savedAt: number
  clientTimeAtSave?: number
  serverTimeAtSave?: number | null
  clockOffsetMs?: number | null
  unreadCount: number
  notifications: CachedNotification[]
}

export interface LoadedNotificationCache {
  notifications: CachedNotification[]
  unreadCount: number
  savedAt: number
  clockOffsetMs: number | null
  expired: boolean
}

const DATABASE_NAME = "38r-notification-cache"
const DATABASE_VERSION = 1
const STORE_NAME = "accounts"
const CACHE_VERSION = 1
const MAX_CACHE_AGE = 90 * 24 * 60 * 60 * 1000
const CACHE_TTL = 5 * 60 * 1000
const MAX_NOTIFICATIONS = 100

let databasePromise: Promise<IDBDatabase> | null = null
const pendingCacheSaves = new Map<string, Promise<void>>()
const cacheDeletionRequested = new Set<string>()
const persistentCacheDeletionRequests = new Set<string>()
const cacheDeletionPromises = new Map<string, Promise<void>>()

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable"))
  }

  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "accountId" })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error("Failed to open notification cache"))
    }
    request.onblocked = () => {
      databasePromise = null
      reject(new Error("Notification cache upgrade is blocked"))
    }
  })

  return databasePromise
}

function validNotification(value: unknown): value is CachedNotification {
  if (!value || typeof value !== "object") return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.body === "string" &&
    typeof item.category === "string" &&
    (typeof item.target_url === "string" || item.target_url === null) &&
    (item.is_read === 0 || item.is_read === 1) &&
    typeof item.created_at === "string" &&
    Number.isFinite(Date.parse(item.created_at))
  )
}

export function isNotificationCacheRecordValid(
  value: unknown,
  accountId: string,
  now = Date.now(),
): value is NotificationCacheRecord {
  if (!value || typeof value !== "object") return false
  const record = value as NotificationCacheRecord
  return (
    record.accountId === accountId &&
    record.version === CACHE_VERSION &&
    Number.isFinite(record.savedAt) &&
    Number.isFinite(record.unreadCount) &&
    record.unreadCount >= 0 &&
    Number.isInteger(record.unreadCount) &&
    (record.clockOffsetMs === undefined || record.clockOffsetMs === null || Number.isFinite(record.clockOffsetMs)) &&
    Array.isArray(record.notifications) &&
    record.notifications.length <= MAX_NOTIFICATIONS &&
    record.notifications.every(validNotification) &&
    !record.notifications.some(item => now - Date.parse(item.created_at) > MAX_CACHE_AGE) &&
    record.savedAt <= now + 5 * 60 * 1000 &&
    (record.clientTimeAtSave === undefined || Number.isFinite(record.clientTimeAtSave)) &&
    (record.serverTimeAtSave === undefined || record.serverTimeAtSave === null || Number.isFinite(record.serverTimeAtSave)) &&
    now - record.savedAt <= MAX_CACHE_AGE
  )
}

export function isNotificationCacheExpired(savedAt: number, now = Date.now()): boolean {
  return now - savedAt > CACHE_TTL
}

function deleteRecord(database: IDBDatabase, accountId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite")
    transaction.objectStore(STORE_NAME).delete(accountId)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Cache deletion failed"))
    transaction.onabort = () => reject(transaction.error ?? new Error("Cache deletion aborted"))
  })
}

export async function loadNotificationCache(
  accountId: string,
): Promise<LoadedNotificationCache | null> {
  if (!accountId) return null
  const pendingDeletion = cacheDeletionPromises.get(accountId)
  if (pendingDeletion) await pendingDeletion
  cacheDeletionRequested.delete(accountId)
  persistentCacheDeletionRequests.delete(accountId)
  const database = await openDatabase()

  const record = await new Promise<NotificationCacheRecord | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly")
    const request = transaction.objectStore(STORE_NAME).get(accountId)
    request.onsuccess = () => resolve(request.result as NotificationCacheRecord | undefined)
    request.onerror = () => reject(request.error ?? new Error("Cache read failed"))
  })

  if (!record) return null

  const now = Date.now()
  if (!isNotificationCacheRecordValid(record, accountId, now)) {
    await deleteNotificationCache(accountId, false)
    return null
  }

  return {
    notifications: record.notifications,
    unreadCount: record.unreadCount,
    savedAt: record.savedAt,
    clockOffsetMs: record.clockOffsetMs ?? null,
    expired: isNotificationCacheExpired(record.savedAt, now),
  }
}

export async function saveNotificationCache(
  accountId: string,
  notifications: Array<{
    id: string
    title: string
    body: string
    category: string
    target_url: string | null
    is_read: number
    created_at: string
  }>,
  unreadCount: number,
  serverTime?: string | null,
  preserveValidity = false,
): Promise<void> {
  if (!accountId || cacheDeletionRequested.has(accountId)) return

  const previous = pendingCacheSaves.get(accountId)
  const saveStartedAt = Date.now()
  const operation = (async () => {
    if (previous) {
      try {
        await previous
      } catch {
        // 直前の保存失敗に引きずられず、新しいスナップショットを保存する。
      }
    }
    const database = await openDatabase()
    const retentionNow = serverTime && Number.isFinite(Date.parse(serverTime))
      ? Date.parse(serverTime)
      : Date.now()
    const cachedNotifications = notifications
      .filter(item => retentionNow - Date.parse(item.created_at) <= MAX_CACHE_AGE)
      .sort((a, b) => {
        const dateDifference = Date.parse(b.created_at) - Date.parse(a.created_at)
        return dateDifference || b.id.localeCompare(a.id)
      })
      .slice(0, MAX_NOTIFICATIONS)
      .map(item => ({
        id: item.id,
        title: item.title,
        body: item.body,
        category: item.category,
        target_url: item.target_url,
        is_read: item.is_read ? 1 : 0,
        created_at: item.created_at,
      }))

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const writeRecord = (existing?: NotificationCacheRecord) => {
        const savedAt = preserveValidity && existing && Number.isFinite(existing.savedAt)
          ? existing.savedAt
          : Date.now()
        const serverTimeAtSave = preserveValidity && existing
          ? existing.serverTimeAtSave ?? null
          : serverTime ? Date.parse(serverTime) : Number.NaN
        const clientTimeAtSave = preserveValidity && existing && Number.isFinite(existing.clientTimeAtSave)
          ? existing.clientTimeAtSave as number
          : savedAt
        store.put({
          accountId,
          version: CACHE_VERSION,
          savedAt,
          clientTimeAtSave,
          serverTimeAtSave: typeof serverTimeAtSave === "number" && Number.isFinite(serverTimeAtSave)
            ? serverTimeAtSave
            : null,
          clockOffsetMs: typeof serverTimeAtSave === "number" && Number.isFinite(serverTimeAtSave)
            ? serverTimeAtSave - clientTimeAtSave
            : null,
          unreadCount: Math.max(0, Math.floor(unreadCount)),
          notifications: cachedNotifications,
        } satisfies NotificationCacheRecord)
      }
      if (preserveValidity) {
        const request = store.get(accountId)
        request.onsuccess = () => writeRecord(request.result as NotificationCacheRecord | undefined)
      } else {
        writeRecord()
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("Cache write failed"))
      transaction.onabort = () => reject(transaction.error ?? new Error("Cache write aborted"))
    })

    if (!preserveValidity) {
      const completedAt = Date.now()
      const serverTimestamp = serverTime ? Date.parse(serverTime) : Number.NaN
      const completedServerTime = Number.isFinite(serverTimestamp)
        ? serverTimestamp + (completedAt - saveStartedAt)
        : null
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, "readwrite")
        const store = transaction.objectStore(STORE_NAME)
        const request = store.get(accountId)
        request.onsuccess = () => {
          const existing = request.result as NotificationCacheRecord | undefined
          if (existing) {
            store.put({
              ...existing,
              savedAt: completedAt,
              clientTimeAtSave: completedAt,
              serverTimeAtSave: completedServerTime,
              clockOffsetMs: completedServerTime === null ? null : completedServerTime - completedAt,
            } satisfies NotificationCacheRecord)
          }
        }
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error ?? new Error("Cache completion timestamp update failed"))
        transaction.onabort = () => reject(transaction.error ?? new Error("Cache completion timestamp update aborted"))
      })
    }
  })()

  pendingCacheSaves.set(accountId, operation)
  try {
    await operation
  } finally {
    if (pendingCacheSaves.get(accountId) === operation) {
      pendingCacheSaves.delete(accountId)
    }
  }
}


export async function validateNotificationCacheClock(
  accountId: string,
  serverTime: string | undefined,
): Promise<boolean> {
  if (!accountId || !serverTime) return true
  const actualServerTime = Date.parse(serverTime)
  if (!Number.isFinite(actualServerTime)) return true

  const database = await openDatabase()
  const record = await new Promise<NotificationCacheRecord | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly")
    const request = transaction.objectStore(STORE_NAME).get(accountId)
    request.onsuccess = () => resolve(request.result as NotificationCacheRecord | undefined)
    request.onerror = () => reject(request.error ?? new Error("Cache clock validation failed"))
  })

  if (!record) return true

  const currentClientTime = Date.now()
  const hasSavedServerClock = typeof record.serverTimeAtSave === "number" &&
    Number.isFinite(record.serverTimeAtSave) &&
    typeof record.clientTimeAtSave === "number" &&
    Number.isFinite(record.clientTimeAtSave)
  const expectedServerTime = hasSavedServerClock
    ? (record.serverTimeAtSave as number) + (currentClientTime - (record.clientTimeAtSave as number))
    : currentClientTime
  const clockDifference = Math.abs(actualServerTime - expectedServerTime)

  if (clockDifference > 5 * 60 * 1000) {
    await deleteNotificationCache(accountId, false)
    return false
  }

  if (!hasSavedServerClock) {
    // サーバー時刻なしで保存されたキャッシュは、初回のサーバー時刻取得時に
    // 端末時刻との差を検証し、以後の検証に使う基準時刻を記録する。
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(accountId)
      request.onsuccess = () => {
        const latest = request.result as NotificationCacheRecord | undefined
        if (latest) {
          store.put({
            ...latest,
            clientTimeAtSave: currentClientTime,
            serverTimeAtSave: actualServerTime,
            clockOffsetMs: actualServerTime - currentClientTime,
          } satisfies NotificationCacheRecord)
        }
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("Cache clock metadata update failed"))
      transaction.onabort = () => reject(transaction.error ?? new Error("Cache clock metadata update aborted"))
    })
  }

  return true
}

export async function deleteNotificationCache(
  accountId: string,
  blockWritesUntilNextLoad = true,
): Promise<void> {
  if (!accountId) return
  const existingDeletion = cacheDeletionPromises.get(accountId)
  if (existingDeletion) {
    if (blockWritesUntilNextLoad) persistentCacheDeletionRequests.add(accountId)
    return existingDeletion
  }

  // 削除中は新しい保存を止め、開始済みの保存だけを完了させる。
  cacheDeletionRequested.add(accountId)
  if (blockWritesUntilNextLoad) persistentCacheDeletionRequests.add(accountId)
  const deletion = (async () => {
    const pendingSave = pendingCacheSaves.get(accountId)
    if (pendingSave) await pendingSave.catch(() => undefined)
    const database = await openDatabase()
    await deleteRecord(database, accountId)
  })()
  cacheDeletionPromises.set(accountId, deletion)
  try {
    await deletion
  } finally {
    cacheDeletionPromises.delete(accountId)
    if (!persistentCacheDeletionRequests.has(accountId)) {
      cacheDeletionRequested.delete(accountId)
    }
  }
}
