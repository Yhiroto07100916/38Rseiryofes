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

export const useNotifications = () => {
  const { apiFetch } = useApi()
  const notifications = ref<AppNotification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  const loadingMore = ref(false)
  const error = ref("")
  const hasMore = ref(false)
  const cursor = ref<{ created_at: string; id: string } | null>(null)
  const readFilter = ref<"all" | "unread" | "read">("all")
  const selectedCategories = ref<NotificationCategory[]>([])
  const search = ref("")
  let pollHandle: ReturnType<typeof setInterval> | undefined
  let requestInProgress = false

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

  const fetchPage = async (reset = true) => {
    if (requestInProgress) return
    requestInProgress = true
    if (reset) loading.value = true
    else loadingMore.value = true
    error.value = ""

    try {
      if (reset) cursor.value = null
      const response = await apiFetch<NotificationListResponse>(
        "/api/notifications?" + buildQuery(!reset),
      )
      applyResponse(response, reset)
    } catch {
      error.value = "通知を取得できませんでした。通信環境を確認して再試行してください。"
    } finally {
      requestInProgress = false
      loading.value = false
      loadingMore.value = false
    }
  }

  const refresh = () => fetchPage(true)
  const loadMore = () => {
    if (hasMore.value && !loadingMore.value) return fetchPage(false)
  }

  const refreshUnreadCount = async () => {
    try {
      const response = await apiFetch<{ unread_count: number }>("/api/notifications/unread-count")
      unreadCount.value = response.unread_count
    } catch {
      // 一覧の表示を維持し、次回ポーリングで再取得する。
    }
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
    try {
      const response = await apiFetch<NotificationListResponse>(
        "/api/notifications?" + buildQuery(false),
      )
      const existing = new Map(notifications.value.map(item => [item.id, item]))
      const merged = response.notifications.map(item => {
        const current = existing.get(item.id)
        return current ? { ...item, is_read: current.is_read } : item
      })
      const incomingIds = new Set(merged.map(item => item.id))
      notifications.value = [
        ...merged,
        ...notifications.value.filter(item => !incomingIds.has(item.id)),
      ]
      unreadCount.value = response.unread_count
    } catch {
      // ポーリング失敗時は現在の一覧を維持する。
    }
  }

  const startPolling = () => {
    stopPolling()
    pollHandle = setInterval(() => {
      void pollLatest()
    }, 10_000)
  }

  const stopPolling = () => {
    if (pollHandle) clearInterval(pollHandle)
    pollHandle = undefined
  }

  const setFilters = async () => {
    await fetchPage(true)
  }

  onMounted(() => {
    void fetchPage(true)
    startPolling()
  })

  onUnmounted(stopPolling)

  return {
    notifications,
    unreadCount,
    loading,
    loadingMore,
    error,
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
  }
}
