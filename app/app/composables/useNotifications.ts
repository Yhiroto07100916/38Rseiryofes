import { onMounted, onUnmounted, ref, watch } from "vue"
import { useApi } from "~/composables/useApi"
import { useAuthStore } from "~/stores/auth"
import { loadNotificationCache, saveNotificationCache, validateNotificationCacheClock } from "~/utils/notification-cache"

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
  let pollHandle: ReturnType<typeof setInterval> | undefined
  let listRetryHandle: ReturnType<typeof setTimeout> | undefined
  let unreadRetryHandle: ReturnType<typeof setTimeout> | undefined
  let successHandle: ReturnType<typeof setTimeout> | undefined
  let unreadSuccessHandle: ReturnType<typeof setTimeout> | undefined
  let requestInProgress = false
  let unreadRequestInProgress = false
  let pendingUnreadRefresh = false
  let pendingResetFetch = false
  let manualRefreshRequested = false
  let listFailures = 0
  let unreadFailures = 0
  let hasSuccessfulApiFetch = false
  const cacheUpdatePromises = new Map<string, Promise<void>>()
  let cachedClockOffsetMs: number | null = null

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
    try {
      const cached = await loadNotificationCache(accountId)
      if (!cached || hasSuccessfulApiFetch || auth.user?.id !== accountId) return
      cachedClockOffsetMs = cached.clockOffsetMs

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
        await delay(retryDelays[attempt])
      } finally {
        clearTimeout(timeout)
      }
    }
    throw new Error("Notification cache page fetch failed")
  }

  const refreshFullCache = (accountId: string) => {
    const existing = cacheUpdatePromises.get(accountId)
    if (existing) return existing

    const update = (async () => {
      const all: AppNotification[] = []
      let nextCursor: { created_at: string; id: string } | null = null
      let unread = 0

      for (let page = 0; page < 5; page++) {
        const response = await fetchCachePage(accountId, nextCursor)
        all.push(...response.notifications)
        unread = response.unread_count
        nextCursor = response.next_cursor
        if (!nextCursor) break
      }

      const latest = await fetchCachePage(accountId, null)
      const latestIds = new Set(latest.notifications.map(item => item.id))
      const merged = [
        ...latest.notifications,
        ...all.filter(item => !latestIds.has(item.id)),
      ]
      unread = latest.unread_count
      await validateNotificationCacheClock(accountId, latest.server_time)

      // ここから先は取得完了済み。ログアウト後も元アカウントの領域にだけ保存する。
      await saveNotificationCache(accountId, merged.slice(0, 100), unread, latest.server_time)
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
    if (listRetryHandle || listFailures >= MAX_FAILURES) return
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

  const applyResponse = (response: NotificationListResponse, reset: boolean) => {
    if (reset) {
      notifications.value = response.notifications
    } else {
      const existing = new Set(notifications.value.map(item => item.id))
      notifications.value = [
        ...notifications.value,
        ...response.notifications.filter(item => !existing.has(item.id)),
      ]
    }
    unreadCount.value = response.unread_count
    cursor.value = response.next_cursor
    hasMore.value = response.next_cursor !== null
  }

  const fetchPage = async (reset = true, isRetry = false) => {
    if (requestInProgress) {
      if (reset) pendingResetFetch = true
      return
    }

    const requestAccountId = auth.user?.id ?? null
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
      applyResponse(response, reset)
      if (
        reset &&
        requestAccountId &&
        readFilter.value === "all" &&
        selectedCategories.value.length === 0 &&
        !search.value.trim()
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
      listFailures += 1
      successMessage.value = ""
      if (successHandle) clearTimeout(successHandle)
      successHandle = undefined
      if (listFailures >= MAX_FAILURES) {
        error.value = "再取得に失敗しました。手動で再試行してください。"
        refreshMessage.value = ""
        manualRefreshRequested = false
      } else {
        error.value = "通知を取得できませんでした。通信環境を確認して再試行してください。"
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
    if (unreadRequestInProgress) {
      pendingUnreadRefresh = true
      return
    }
    if (manual) {
      unreadFailures = 0
      clearUnreadRetry()
    }

    const requestAccountId = auth.user?.id ?? null
    unreadRequestInProgress = true
    unreadCountLoading.value = true
    try {
      const response = await apiFetch<{ unread_count: number; server_time?: string }>("/api/notifications/unread-count")
      if (auth.user?.id !== requestAccountId) return
      await validateServerClock(requestAccountId, response.server_time)
      unreadCount.value = response.unread_count
      const recovered = unreadFailures > 0 || Boolean(unreadCountError.value)
      unreadFailures = 0
      clearUnreadRetry()
      unreadCountError.value = ""
      if (recovered) showUnreadSuccess("未読件数を更新しました")
    } catch {
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
    item.is_read = isRead ? 1 : 0

    try {
      await apiFetch("/api/notifications/" + encodeURIComponent(id) + "/read", {
        method: "PATCH",
        body: { is_read: isRead },
      })
      if (auth.user?.id !== requestAccountId) return true
      await refreshUnreadCount()
      return true
    } catch {
      if (auth.user?.id !== requestAccountId) return true
      item.is_read = previous
      error.value = "既読状態を保存できませんでした。"
      return false
    }
  }

  const markAllRead = async () => {
    const requestAccountId = auth.user?.id ?? null
    try {
      const response = await apiFetch<{ updated_count: number }>("/api/notifications/read-all", {
        method: "POST",
      })
      if (auth.user?.id !== requestAccountId) return response.updated_count
      for (const item of notifications.value) item.is_read = 1
      unreadCount.value = Math.max(0, unreadCount.value - response.updated_count)
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
    requestInProgress = true
    try {
      const response = await apiFetch<NotificationListResponse>(
        "/api/notifications?" + buildQuery(false),
      )
      if (auth.user?.id !== requestAccountId) return
      await validateServerClock(requestAccountId, response.server_time)
      hasSuccessfulApiFetch = true
      const merged = response.notifications
      const incomingIds = new Set(merged.map(item => item.id))
      notifications.value = [
        ...merged,
        ...notifications.value.filter(item => !incomingIds.has(item.id)),
      ]
      unreadCount.value = response.unread_count
      listFailures = 0
      clearListRetry()
      error.value = ""
      refreshMessage.value = ""
      if (manualRefreshRequested) {
        manualRefreshRequested = false
        showSuccess("最新情報に更新しました")
      }
    } catch {
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
    pollHandle = setInterval(() => {
      if (listFailures === 0 && !listRetryHandle) void pollLatest()
      if (unreadFailures === 0 && !unreadRetryHandle) void refreshUnreadCount()
    }, 10_000)
  }

  const stopPolling = () => {
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

      notifications.value = []
      unreadCount.value = 0
      cursor.value = null
      hasMore.value = false
      error.value = ""
      unreadCountError.value = ""
      listFailures = 0
      unreadFailures = 0
      hasSuccessfulApiFetch = false
      cachedClockOffsetMs = null
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
