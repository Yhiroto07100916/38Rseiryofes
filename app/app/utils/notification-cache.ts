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
  unreadCount: number
  notifications: CachedNotification[]
}

export interface LoadedNotificationCache {
  notifications: CachedNotification[]
  unreadCount: number
  savedAt: number
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
    typeof item.created_at === "string"
  )
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
  const database = await openDatabase()

  const record = await new Promise<NotificationCacheRecord | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly")
    const request = transaction.objectStore(STORE_NAME).get(accountId)
    request.onsuccess = () => resolve(request.result as NotificationCacheRecord | undefined)
    request.onerror = () => reject(request.error ?? new Error("Cache read failed"))
  })

  if (!record) return null

  const now = Date.now()
  const invalid =
    record.accountId !== accountId ||
    record.version !== CACHE_VERSION ||
    !Number.isFinite(record.savedAt) ||
    !Number.isFinite(record.unreadCount) ||
    !Array.isArray(record.notifications) ||
    !record.notifications.every(validNotification) ||
    record.savedAt > now + 5 * 60 * 1000 ||
    now - record.savedAt > MAX_CACHE_AGE

  if (invalid) {
    await deleteRecord(database, accountId)
    return null
  }

  return {
    notifications: record.notifications,
    unreadCount: record.unreadCount,
    savedAt: record.savedAt,
    expired: now - record.savedAt > CACHE_TTL,
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
): Promise<void> {
  if (!accountId) return
  const database = await openDatabase()
  const cachedNotifications = [...notifications]
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
    transaction.objectStore(STORE_NAME).put({
      accountId,
      version: CACHE_VERSION,
      savedAt: Date.now(),
      unreadCount: Math.max(0, Math.floor(unreadCount)),
      notifications: cachedNotifications,
    } satisfies NotificationCacheRecord)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error("Cache write failed"))
    transaction.onabort = () => reject(transaction.error ?? new Error("Cache write aborted"))
  })
}

export async function deleteNotificationCache(accountId: string): Promise<void> {
  if (!accountId) return
  const database = await openDatabase()
  await deleteRecord(database, accountId)
}
