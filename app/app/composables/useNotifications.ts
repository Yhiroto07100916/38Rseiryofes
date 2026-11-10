import { onMounted, onUnmounted, ref, watch } from "vue"
import { useApi } from "~/composables/useApi"
import { useAuthStore } from "~/stores/auth"
import { deleteNotificationCache, loadNotificationCache, saveNotificationCache, validateNotificationCacheClock } from "~/utils/notification-cache"

export type NotificationCategory =
  | "tasks"
  | "calendar"
  | "submissions"
  | "news"
  | "surveys"
  | "decisions"
  | "equipment"
  | "tool_rental"
  | "accounting"
  | "files"
  | "milk_collection"
  | "wishlist"
  | "account_admin"

export interface AppNotification {
  id: string
  event_key: string
  category: NotificationCategory
  title: string
  body: string
  target_url: string | null
  actor_user_id: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: number
  created_at: string
  expires_at: string
}

interface NotificationListResponse {
  notifications: AppNotification[]
  next_cursor: { created_at: string; id: string } | null
  unread_count: number
  server_time?: string
  known_notifications?: Array<{ id: string; is_read: number }>
}

const PAGE_SIZE = 20
const RETRY_DELAYS = [10_000, 20_000, 40_000, 60_000]
const MAX_FAILURES = 5

export const useNotifications = () => {
  const { apiFetch } = useApi()
  const auth = useAuthStore()
  const notifications = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref("")
  const unreadCountError = ref("")
  const unreadCountLoading = ref(false)
  const unreadCountSuccess = ref("")
  const refreshMessage = ref("")
  const successMessage = ref("")
  const hasMore = ref(false)
  const cursor = ref<{ created_at: string; id: string } | null>(null)
  const readFilter = ref<"all" | "unread" | "read">("all")
  const selectedCategories = ref<NotificationCategory[]>([])
  const search = ref("")
  const cacheExpired = ref(false)
  let pollHandle: ReturnType<typeof setInterval> | undefined
  let listRetryHandle: ReturnType<typeof setTimeout> | undefined
  let unreadRetryHandle: ReturnType<typeof setTimeout> | undefined
  let successHandle: ReturnType<typeof setTimeout> | undefined
  let unreadSuccessHandle: ReturnType<typeof setTimeout> | undefined
  let requestInProgress = false
  let unreadRequestInProgress = false
  let unreadAbortController: AbortController | undefined
  let pendingUnreadRefresh = false
  let pendingResetFetch = false
  let manualRefreshRequested = false
  let listFailures = 0
  let unreadFailures = 0
  let hasSuccessfulApiFetch = false
  const cacheUpdatePromises = new Map<string, Promise<void>>()
  const partialCacheUpdates = new Map<string, {
    notifications: AppNotification[]
    nextCursor: { created_at: string; id: string } | null
    pageCount: number
    pagesComplete: boolean
  }>()
  const cacheDeletionRequests = new Set<string>()
  const pendingReadOperations = new Map<string, { isRead: boolean; previous: number }>()
  const readStateWriteCompletedAt = new Map<string, number>()
  let cachedClockOffsetMs: number | null = null
  let cacheSnapshot: AppNotification[] = []
  let cacheInitialized = false
  let listActive = true

  const saveCacheSnapshot = async (accountId: string | null, serverTime?: string) => {
    if (!accountId || !cacheInitialized || cacheDeletionRequests.has(accountId) || auth.user?.id !== accountId) return
    const effectiveServerTime = serverTime ?? (
      cachedClockOffsetMs !== null
        ? new Date(Date.now() + cachedClockOffsetMs).toISOString()
        : undefined
    )
    try {
      await saveNotificationCache(accountId, cacheSnapshot, unreadCount.value, effectiveServerTime, true)
    } catch {
      // キャッシュ保存失敗は通知操作に影響させない。
    }
  }

  const buildQuery = (includeCursor: boolean) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (readFilter.value !== "all") params.set("read", readFilter.value)
    for (const category of selectedCategories.value) params.append("category", category)
    const searchTerm = String(search.value ?? "").trim()
    if (searchTerm) params.set("search", searchTerm)
    if (includeCursor && cursor.value) {
      params.set("before_created_at", cursor.value.created_at)
      params.set("before_id", cursor.value.id)
    }
    return params.toString()
  }

  const delay = (milliseconds: number) =>
    new Promise<void>(resolve => setTimeout(resolve, milliseconds))

  const mapCachedNotification = (item: {
    id: string
    title: string
    body: string
    category: string
    target_url: string | null
    is_read: number
    created_at: string
  }): AppNotification => ({
    id: item.id,
    event_key: "",
    category: item.category as NotificationCategory,
    title: item.title,
    body: item.body,
    target_url: item.target_url,
    actor_user_id: null,
    entity_type: null,
    entity_id: null,
    is_read: item.is_read,
    created_at: item.created_at,
    expires_at: new Date(Date.parse(item.created_at) + 90 * 24 * 60 * 60 * 1000).toISOString(),
  })

  const loadCache = async (accountId: string) => {
    if (cacheDeletionRequests.has(accountId)) return
    try {
      const cached = await loadNotificationCache(accountId)
      if (!cached || auth.user?.id !== accountId) return
      cachedClockOffsetMs = cached.clockOffsetMs
      cacheSnapshot = cached.notifications.map(mapCachedNotification)
      cacheInitialized = true
      if (hasSuccessfulApiFetch) return
      cacheExpired.value = cached.expired

      const term = String(search.value ?? "").trim().toLocaleLowerCase()
      const categoryLabels: Record<string, string> = {
        tasks: "タスク",
        calendar: "カレンダー",
        submissions: "提出物",
        news: "お知らせ",
        surveys: "アンケート",
        decisions: "意思決定",
        equipment: "備品",
        tool_rental: "工具貸出",
        accounting: "会計",
        files: "ファイル",
        milk_collection: "牛乳パック",
        wishlist: "ほしい物リスト",
        account_admin: "アカウント",
      }
      const filtered = cached.notifications.filter(item => {
        if (readFilter.value === "unread" && item.is_read) return false
        if (readFilter.value === "read" && !item.is_read) return false
        if (
          selectedCategories.value.length > 0 &&
          !selectedCategories.value.includes(item.category as NotificationCategory)
        ) return false
        if (term && ![item.title, item.body, item.category, categoryLabels[item.category] ?? ""].some(value =>
          value.toLocaleLowerCase().includes(term),
        )) return false
        return true
      })

      const visible = filtered.slice(0, PAGE_SIZE)
      notifications.value = visible.map(mapCachedNotification)
      unreadCount.value = cached.unreadCount
      cacheSnapshot = cached.notifications.map(mapCachedNotification)
      cacheInitialized = true
      const cursorItem = filtered.length > PAGE_SIZE
        ? filtered[PAGE_SIZE - 1]
        : cached.notifications.length >= 100
          ? cached.notifications[cached.notifications.length - 1]
          : filtered[filtered.length - 1]
      cursor.value = cursorItem
        ? { created_at: cursorItem.created_at, id: cursorItem.id }
        : null
      hasMore.value = filtered.length > PAGE_SIZE || cached.notifications.length >= 100
    } catch {
      // キャッシュ障害時はAPI取得を継続する。
    }
  }

  const validateServerClock = async (accountId: string | null, serverTime?: string) => {
    if (!accountId || !serverTime) return
    const serverTimestamp = Date.parse(serverTime)
    if (!Number.isFinite(serverTimestamp)) return

    const currentOffset = serverTimestamp - Date.now()
    if (
      cachedClockOffsetMs !== null &&
      Math.abs(currentOffset - cachedClockOffsetMs) > 5 * 60 * 1000
    ) {
      await deleteNotificationCache(accountId).catch(() => undefined)
      cachedClockOffsetMs = null
      cacheSnapshot = []
      cacheInitialized = false
      if (!hasSuccessfulApiFetch) {
        notifications.value = []
        unreadCount.value = 0
        cursor.value = null
        hasMore.value = false
      }
    }
  }

  const fetchCachePage = async (
    accountId: string,
    pageCursor: { created_at: string; id: string } | null,
  ) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (pageCursor) {
      params.set("before_created_at", pageCursor.created_at)
      params.set("before_id", pageCursor.id)
    }

    const retryDelays = [1_000, 3_000, 5_000]
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      if (auth.user?.id !== accountId) {
        throw new Error("Notification cache update invalidated by account change")
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10_000)
      try {
        return await apiFetch<NotificationListResponse>(
          "/api/notifications?" + params.toString(),
          { signal: controller.signal },
        )
      } catch (error) {
        if (attempt === retryDelays.length) throw error
        await delay(retryDelays[attempt] ?? 5_000)
      } finally {
        clearTimeout(timeout)
      }
    }
    throw new Error("Notification cache page fetch failed")
  }

  const refreshFullCache = (accountId: string) => {
    if (cacheDeletionRequests.has(accountId)) return Promise.resolve()
    const existing = cacheUpdatePromises.get(accountId)
    if (existing) return existing

    const update = (async () => {
      const partial = partialCacheUpdates.get(accountId) ?? {
        notifications: [],
        nextCursor: null,
        pageCount: 0,
        pagesComplete: false,
      }
      partialCacheUpdates.set(accountId, partial)
      const all = [...partial.notifications]
      let nextCursor = partial.nextCursor
      let page = partial.pageCount

      while (!partial.pagesComplete && page < 5) {
        const response = await fetchCachePage(accountId, nextCursor)
        all.push(...response.notifications)
        nextCursor = response.next_cursor
        page += 1
        const pagesComplete = !nextCursor || page >= 5
        partialCacheUpdates.set(accountId, {
          notifications: [...all],
          nextCursor,
          pageCount: page,
          pagesComplete,
        })
        if (pagesComplete) break
      }

      const latest = await fetchCachePage(accountId, null)
      const latestIds = new Set(latest.notifications.map(item => item.id))
      const merged = [
        ...latest.notifications,
        ...all.filter(item => !latestIds.has(item.id)),
      ]
      await validateNotificationCacheClock(accountId, latest.server_time)

      // 取得済みデータは元アカウントの領域にだけ保存する。
      // アカウント切替後に共有UI用スナップショットを書き換えない。
      const snapshot = merged.slice(0, 100)
      await saveNotificationCache(accountId, snapshot, latest.unread_count, latest.server_time)
      if (auth.user?.id === accountId) {
        cacheSnapshot = snapshot
        cacheInitialized = true
      }
      partialCacheUpdates.delete(accountId)
    })().catch(() => {
      // 不完全な取得結果では既存キャッシュを置き換えない。
    }).finally(() => {
      cacheUpdatePromises.delete(accountId)
    })

    cacheUpdatePromises.set(accountId, update)
    return update
  }

  const clearListRetry = () => {
    if (listRetryHandle) clearTimeout(listRetryHandle)
    listRetryHandle = undefined
  }

  const clearUnreadRetry = () => {
    if (unreadRetryHandle) clearTimeout(unreadRetryHandle)
    unreadRetryHandle = undefined
  }

  const showSuccess = (message: string) => {
    successMessage.value = message
    if (successHandle) clearTimeout(successHandle)
    successHandle = setTimeout(() => {
      successMessage.value = ""
      successHandle = undefined
    }, 3_000)
  }

  const showUnreadSuccess = (message: string) => {
    unreadCountSuccess.value = message
    if (unreadSuccessHandle) clearTimeout(unreadSuccessHandle)
    unreadSuccessHandle = setTimeout(() => {
      unreadCountSuccess.value = ""
      unreadSuccessHandle = undefined
    }, 3_000)
  }

  const scheduleListRetry = (reset: boolean) => {
    if (!listActive || listRetryHandle || listFailures >= MAX_FAILURES) return
    const delay = RETRY_DELAYS[Math.min(listFailures - 1, RETRY_DELAYS.length - 1)]
    refreshMessage.value = "最新情報を再取得しています"
    listRetryHandle = setTimeout(() => {
      listRetryHandle = undefined
      void fetchPage(reset, true)
    }, delay)
  }

  const scheduleUnreadRetry = () => {
    if (unreadRetryHandle || unreadFailures >= MAX_FAILURES) return
    const delay = RETRY_DELAYS[Math.min(unreadFailures - 1, RETRY_DELAYS.length - 1)]
    unreadRetryHandle = setTimeout(() => {
      unreadRetryHandle = undefined
      void refreshUnreadCount()
    }, delay)
  }

  const preserveRecentReadState = (incoming: AppNotification, requestStartedAt: number): AppNotification => {
    const pending = pendingReadOperations.get(incoming.id)
    const current = notifications.value.find(item => item.id === incoming.id)
    const completedAt = readStateWriteCompletedAt.get(incoming.id)

    if (pending) return { ...incoming, is_read: pending.isRead ? 1 : 0 }
    if (completedAt !== undefined && completedAt > requestStartedAt && current) {
      return { ...incoming, is_read: current.is_read }
    }
    if (completedAt !== undefined) readStateWriteCompletedAt.delete(incoming.id)
    return incoming
  }

  const applyResponse = (
    response: NotificationListResponse,
    reset: boolean,
    requestStartedAt: number,
  ) => {
    const incoming = response.notifications.map(item => preserveRecentReadState(item, requestStartedAt))
    if (reset) {
      notifications.value = incoming
    } else {
      const existing = new Set(notifications.value.map(item => item.id))
      notifications.value = [
        ...notifications.value,
        ...incoming.filter(item => !existing.has(item.id)),
      ]
    }
    cursor.value = response.next_cursor
    hasMore.value = response.next_cursor !== null
  }

  const fetchPage = async (reset = true, isRetry = false) => {
    if (requestInProgress) {
      if (reset) pendingResetFetch = true
      return
    }

    const requestAccountId = auth.user?.id ?? null
    const requestStartedAt = Date.now()
    requestInProgress = true
    if (reset) loading.value = true
    else loadingMore.value = true
    if (!isRetry) error.value = ""

    try {
      if (reset) cursor.value = null
      const response = await apiFetch<NotificationListResponse>(
        "/api/notifications?" + buildQuery(!reset),
      )
      if (auth.user?.id !== requestAccountId) return
      await validateServerClock(requestAccountId, response.server_time)
      hasSuccessfulApiFetch = true
      applyResponse(response, reset, requestStartedAt)
      cacheExpired.value = false
      if (
        reset &&
        requestAccountId &&
        readFilter.value === "all" &&
        selectedCategories.value.length === 0 &&
        !String(search.value ?? "").trim()
      ) {
        void refreshFullCache(requestAccountId)
      }
      listFailures = 0
      clearListRetry()
      error.value = ""
      refreshMessage.value = ""
      if (manualRefreshRequested || (isRetry && reset)) showSuccess("最新情報に更新しました")
      manualRefreshRequested = false
    } catch {
      if (auth.user?.id !== requestAccountId || !listActive) return
      listFailures += 1
      successMessage.value = ""
      if (successHandle) clearTimeout(successHandle)
      successHandle = undefined
      if (listFailures >= MAX_FAILURES) {
        error.value = cacheExpired.value
          ? "最新情報を取得できませんでした。保存済みの通知を表示しています。手動で再試行してください。"
          : "再取得に失敗しました。手動で再試行してください。"
        refreshMessage.value = ""
        manualRefreshRequested = false
      } else {
        error.value = cacheExpired.value
          ? "最新情報を取得できませんでした。保存済みの通知を表示しています。"
          : "通知を取得できませんでした。通信環境を確認して再試行してください。"
        scheduleListRetry(reset)
      }
    } finally {
      requestInProgress = false
      loading.value = false
      loadingMore.value = false
      if (pendingResetFetch) {
        pendingResetFetch = false
        void fetchPage(true)
      }
    }
  }

  const refresh = async () => {
    listFailures = 0
    clearListRetry()
    if (requestInProgress) {
      manualRefreshRequested = true
      refreshMessage.value = "最新情報を取得しています"
      return
    }
    manualRefreshRequested = true
    await fetchPage(true)
  }

  const loadMore = () => {
    if (hasMore.value && !loadingMore.value) return fetchPage(false)
  }

  const refreshUnreadCount = async (manual = false) => {
    if (unreadRequestInProgress) return
    if (manual) {
      unreadFailures = 0
      clearUnreadRetry()
    }

    const requestAccountId = auth.user?.id ?? null
    const controller = new AbortController()
    unreadAbortController = controller
    unreadRequestInProgress = true
    unreadCountLoading.value = true
    try {
      const response = await apiFetch<{ unread_count: number; server_time?: string }>("/api/notifications/unread-count", {
        signal: controller.signal,
      })
      if (auth.user?.id !== requestAccountId) return
      await validateServerClock(requestAccountId, response.server_time)
      unreadCount.value = response.unread_count
      void saveCacheSnapshot(requestAccountId, response.server_time)
      const recovered = unreadFailures > 0 || Boolean(unreadCountError.value)
      unreadFailures = 0
      clearUnreadRetry()
      unreadCountError.value = ""
      if (recovered) showUnreadSuccess("未読件数を更新しました")
    } catch {
      if (auth.user?.id !== requestAccountId) return
      unreadFailures += 1
      unreadCountSuccess.value = ""
      if (unreadSuccessHandle) clearTimeout(unreadSuccessHandle)
      unreadSuccessHandle = undefined
      if (unreadFailures >= MAX_FAILURES) {
        unreadCountError.value = "未読件数を再取得できませんでした。手動で再試行してください。"
      } else {
        unreadCountError.value = "未読件数を取得できませんでした。"
        scheduleUnreadRetry()
      }
    } finally {
      if (unreadAbortController === controller) unreadAbortController = undefined
      unreadRequestInProgress = false
      unreadCountLoading.value = false
      if (pendingUnreadRefresh) {
        pendingUnreadRefresh = false
        void refreshUnreadCount()
      }
    }
  }

  const retryUnreadCount = () => refreshUnreadCount(true)

  const clearUnreadCountError = () => {
    unreadCountError.value = ""
  }

  const setRead = async (id: string, isRead: boolean) => {
    const requestAccountId = auth.user?.id ?? null
    const item = notifications.value.find(notification => notification.id === id)
    if (!item || Boolean(item.is_read) === isRead) return true

    const previous = item.is_read
    const operation = { isRead, previous }
    pendingReadOperations.set(id, operation)
    item.is_read = isRead ? 1 : 0

    try {
      await apiFetch("/api/notifications/" + encodeURIComponent(id) + "/read", {
        method: "PATCH",
        body: { is_read: isRead },
      })
      if (auth.user?.id !== requestAccountId) return true
      if (pendingReadOperations.get(id) !== operation) return true
      pendingReadOperations.delete(id)
      readStateWriteCompletedAt.set(id, Date.now())
      const currentItem = notifications.value.find(notification => notification.id === id)
      if (currentItem) currentItem.is_read = isRead ? 1 : 0
      const cachedItem = cacheSnapshot.find(notification => notification.id === id)
      if (cachedItem) cachedItem.is_read = isRead ? 1 : 0
      unreadCount.value = Math.max(0, unreadCount.value + (isRead ? -1 : 1))
      await refreshUnreadCount()
      void saveCacheSnapshot(requestAccountId)
      return true
    } catch {
      if (auth.user?.id !== requestAccountId) return true
      if (pendingReadOperations.get(id) !== operation) return true
      pendingReadOperations.delete(id)
      readStateWriteCompletedAt.delete(id)
      const currentItem = notifications.value.find(notification => notification.id === id)
      if (currentItem) currentItem.is_read = previous
      error.value = "既読状態を保存できませんでした。"
      return false
    }
  }

  const markAllRead = async () => {
    const requestAccountId = auth.user?.id ?? null
    try {
      const response = await apiFetch<{ updated_count: number; updated_ids: string[] }>("/api/notifications/read-all", {
        method: "POST",
      })
      if (auth.user?.id !== requestAccountId) return response.updated_count
      const updatedIds = new Set(response.updated_ids)
      const completedAt = Date.now()
      for (const id of updatedIds) readStateWriteCompletedAt.set(id, completedAt)
      for (const item of notifications.value) {
        if (updatedIds.has(item.id)) item.is_read = 1
      }
      for (const item of cacheSnapshot) {
        if (updatedIds.has(item.id)) item.is_read = 1
      }
      if (readFilter.value === "unread") {
        notifications.value = notifications.value.filter(item => !updatedIds.has(item.id))
      }
      void saveCacheSnapshot(requestAccountId)
      void refreshUnreadCount()
      return response.updated_count
    } catch {
      if (auth.user?.id !== requestAccountId) return null
      error.value = "既読状態を保存できませんでした。"
      return null
    }
  }

  const pollLatest = async () => {
    if (requestInProgress) return
    const requestAccountId = auth.user?.id ?? null
    const requestStartedAt = Date.now()
    requestInProgress = true
    try {
      const params = new URLSearchParams(buildQuery(false))
      const knownIds = notifications.value.slice(0, 100).map(item => item.id)
      if (knownIds.length > 0) params.set("known_ids", knownIds.join(","))
      const response = await apiFetch<NotificationListResponse>(
        "/api/notifications?" + params.toString(),
      )
      if (auth.user?.id !== requestAccountId) return
      await validateServerClock(requestAccountId, response.server_time)
      hasSuccessfulApiFetch = true
      const currentReadStates = new Map(
        (response.known_notifications ?? []).map(item => [item.id, item.is_read]),
      )
      const matchesCurrentFilters = (item: AppNotification) => {
        if (readFilter.value === "unread" && item.is_read) return false
        if (readFilter.value === "read" && !item.is_read) return false
        if (selectedCategories.value.length > 0 && !selectedCategories.value.includes(item.category)) return false
        const term = String(search.value ?? "").trim().toLocaleLowerCase()
        if (!term) return true
        const labels: Record<string, string> = {
          tasks: "タスク", calendar: "カレンダー", submissions: "提出物",
          news: "お知らせ", surveys: "アンケート", decisions: "意思決定",
          equipment: "備品", tool_rental: "工具貸出", accounting: "会計",
          files: "ファイル", milk_collection: "牛乳パック",
          wishlist: "ほしい物リスト", account_admin: "アカウント",
        }
        return [item.title, item.body, item.category, labels[item.category] ?? ""]
          .some(value => value.toLocaleLowerCase().includes(term))
      }
      const updatedExisting = notifications.value
        .map(item => {
          const pending = pendingReadOperations.get(item.id)
          const completedAt = readStateWriteCompletedAt.get(item.id)
          if (pending) return { ...item, is_read: pending.isRead ? 1 : 0 }
          if (completedAt !== undefined && completedAt > requestStartedAt) return item
          if (completedAt !== undefined) readStateWriteCompletedAt.delete(item.id)
          return currentReadStates.has(item.id)
            ? { ...item, is_read: currentReadStates.get(item.id)! }
            : item
        })
        .filter(matchesCurrentFilters)
      const merged = response.notifications.map(item => preserveRecentReadState(item, requestStartedAt))
      const incomingIds = new Set(merged.map(item => item.id))
      notifications.value = [
        ...merged,
        ...updatedExisting.filter(item => !incomingIds.has(item.id)),
      ]
      if (cacheInitialized) {
        const cachedById = new Map(cacheSnapshot.map(item => [item.id, item]))
        for (const item of response.known_notifications ?? []) {
          const cachedItem = cachedById.get(item.id)
          if (cachedItem) cachedById.set(item.id, { ...cachedItem, is_read: item.is_read })
        }
        for (const item of response.notifications) {
          cachedById.set(item.id, item)
        }
        cacheSnapshot = [...cachedById.values()]
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id))
          .slice(0, 100)
        void saveCacheSnapshot(requestAccountId, response.server_time)
      }
      if (partialCacheUpdates.has(requestAccountId)) {
        void refreshFullCache(requestAccountId)
      }
      listFailures = 0
      clearListRetry()
      error.value = ""
      cacheExpired.value = false
      refreshMessage.value = ""
      if (manualRefreshRequested) {
        manualRefreshRequested = false
        showSuccess("最新情報に更新しました")
      }
    } catch {
      if (auth.user?.id !== requestAccountId || !listActive) return
      listFailures += 1
      successMessage.value = ""
      if (successHandle) clearTimeout(successHandle)
      successHandle = undefined
      error.value = listFailures >= MAX_FAILURES
        ? "再取得に失敗しました。手動で再試行してください。"
        : "通知を取得できませんでした。通信環境を確認して再試行してください。"
      if (listFailures >= MAX_FAILURES) {
        refreshMessage.value = ""
        manualRefreshRequested = false
      } else {
        scheduleListRetry(true)
      }
    } finally {
      requestInProgress = false
      if (pendingResetFetch) {
        pendingResetFetch = false
        void fetchPage(true)
      }
    }
  }

  const startPolling = () => {
    stopPolling()
    listActive = true
    pollHandle = setInterval(() => {
      if (listFailures === 0 && !listRetryHandle) void pollLatest()
      if (unreadFailures === 0 && !unreadRetryHandle) void refreshUnreadCount()
    }, 10_000)
  }

  const stopPolling = () => {
    listActive = false
    if (pollHandle) clearInterval(pollHandle)
    pollHandle = undefined
    clearListRetry()
    clearUnreadRetry()
    if (successHandle) clearTimeout(successHandle)
    if (unreadSuccessHandle) clearTimeout(unreadSuccessHandle)
    successHandle = undefined
    unreadSuccessHandle = undefined
  }

  const setFilters = async () => {
    await fetchPage(true)
  }

  onMounted(() => {
    listFailures = 0
    unreadFailures = 0
    manualRefreshRequested = false
    const accountId = auth.user?.id
    if (accountId) void loadCache(accountId)
    void fetchPage(true)
    void refreshUnreadCount()
    startPolling()
  })

  watch(
    () => auth.user?.id,
    (accountId, previousAccountId) => {
      if (accountId === previousAccountId) return
      if (previousAccountId) {
        // ログアウト開始時点で削除対象にし、取得済みのキャッシュ保存だけを完了させてから削除する。
        cacheDeletionRequests.add(previousAccountId)
        const pendingCacheUpdate = cacheUpdatePromises.get(previousAccountId)
        void (async () => {
          try {
            if (pendingCacheUpdate) await pendingCacheUpdate
            await deleteNotificationCache(previousAccountId)
          } finally {
            partialCacheUpdates.delete(previousAccountId)
            cacheDeletionRequests.delete(previousAccountId)
          }
        })().catch(() => undefined)
      }
      unreadAbortController?.abort()
      unreadAbortController = undefined

      notifications.value = []
      cacheExpired.value = false
      unreadCount.value = 0
      cursor.value = null
      hasMore.value = false
      error.value = ""
      unreadCountError.value = ""
      listFailures = 0
      unreadFailures = 0
      hasSuccessfulApiFetch = false
      cachedClockOffsetMs = null
      cacheSnapshot = []
      cacheInitialized = false
      pendingReadOperations.clear()
      readStateWriteCompletedAt.clear()
      manualRefreshRequested = false
      pendingResetFetch = false
      pendingUnreadRefresh = Boolean(accountId && unreadRequestInProgress)
      clearListRetry()
      clearUnreadRetry()

      if (accountId) {
        void loadCache(accountId)
        void fetchPage(true)
        void refreshUnreadCount()
        startPolling()
      } else {
        stopPolling()
      }
    },
  )

  onUnmounted(stopPolling)

  return {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    error,
    unreadCountError,
    unreadCountLoading,
    unreadCountSuccess,
    refreshMessage,
    successMessage,
    hasMore,
    readFilter,
    selectedCategories,
    search,
    refresh,
    loadMore,
    setRead,
    markAllRead,
    setFilters,
    refreshUnreadCount,
    retryUnreadCount,
    clearUnreadCountError,
  }
}
