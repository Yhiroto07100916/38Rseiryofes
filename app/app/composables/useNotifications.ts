import { onMounted, onUnmounted, ref } from "vue"
import { useApi } from "~/composables/useApi"

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
}

const PAGE_SIZE = 20
const RETRY_DELAYS = [10_000, 20_000, 40_000, 60_000]
const MAX_FAILURES = 5

export const useNotifications = () => {
  const { apiFetch } = useApi()
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
  let pendingResetFetch = false
  let manualRefreshRequested = false
  let listFailures = 0
  let unreadFailures = 0

  const buildQuery = (includeCursor: boolean) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
    if (readFilter.value !== "all") params.set("read", readFilter.value)
    for (const category of selectedCategories.value) params.append("category", category)
    if (search.value.trim()) params.set("search", search.value.trim())
    if (includeCursor && cursor.value) {
      params.set("before_created_at", cursor.value.created_at)
      params.set("before_id", cursor.value.id)
    }
    return params.toString()
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

    requestInProgress = true
    if (reset) loading.value = true
    else loadingMore.value = true
    if (!isRetry) error.value = ""

    try {
      if (reset) cursor.value = null
      const response = await apiFetch<NotificationListResponse>(
        "/api/notifications?" + buildQuery(!reset),
      )
      applyResponse(response, reset)
      listFailures = 0
      clearListRetry()
      error.value = ""
      refreshMessage.value = ""
      if (manualRefreshRequested || isRetry) showSuccess("最新情報に更新しました")
      manualRefreshRequested = false
    } catch {
      listFailures += 1
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
    if (unreadRequestInProgress) return
    if (manual) {
      unreadFailures = 0
      clearUnreadRetry()
    }

    unreadRequestInProgress = true
    unreadCountLoading.value = true
    try {
      const response = await apiFetch<{ unread_count: number }>("/api/notifications/unread-count")
      unreadCount.value = response.unread_count
      const recovered = unreadFailures > 0 || Boolean(unreadCountError.value)
      unreadFailures = 0
      clearUnreadRetry()
      unreadCountError.value = ""
      if (recovered) showUnreadSuccess("未読件数を更新しました")
    } catch {
      unreadFailures += 1
      if (unreadFailures >= MAX_FAILURES) {
        unreadCountError.value = "未読件数を再取得できませんでした。手動で再試行してください。"
      } else {
        unreadCountError.value = "未読件数を取得できませんでした。"
        scheduleUnreadRetry()
      }
    } finally {
      unreadRequestInProgress = false
      unreadCountLoading.value = false
    }
  }

  const retryUnreadCount = () => refreshUnreadCount(true)

  const clearUnreadCountError = () => {
    unreadCountError.value = ""
  }

  const setRead = async (id: string, isRead: boolean) => {
    const item = notifications.value.find(notification => notification.id === id)
    if (!item || Boolean(item.is_read) === isRead) return true

    const previous = item.is_read
    item.is_read = isRead ? 1 : 0

    try {
      await apiFetch("/api/notifications/" + encodeURIComponent(id) + "/read", {
        method: "PATCH",
        body: { is_read: isRead },
      })
      await refreshUnreadCount()
      return true
    } catch {
      item.is_read = previous
      error.value = "既読状態を保存できませんでした。"
      return false
    }
  }

  const markAllRead = async () => {
    try {
      const response = await apiFetch<{ updated_count: number }>("/api/notifications/read-all", {
        method: "POST",
      })
      for (const item of notifications.value) item.is_read = 1
      unreadCount.value = Math.max(0, unreadCount.value - response.updated_count)
      return response.updated_count
    } catch {
      error.value = "既読状態を保存できませんでした。"
      return null
    }
  }

  const pollLatest = async () => {
    if (requestInProgress) return
    requestInProgress = true
    try {
      const response = await apiFetch<NotificationListResponse>(
        "/api/notifications?" + buildQuery(false),
      )
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
    void fetchPage(true)
    void refreshUnreadCount()
    startPolling()
  })

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
