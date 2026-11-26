import { deleteNotificationCache } from "~/utils/notification-cache"
import { defineStore } from 'pinia'

interface AuthUser {
  id: string
  student_number: string
  name: string
  nickname: string | null
  avatar_key: string | null
  must_change_password?: boolean
}

interface AuthRole {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface LoginResponse {
  user: AuthUser
  permissions: string[]
  roles?: AuthRole[]
  account_roles?: AuthRole[]
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const permissions = ref<string[]>([])
  const roles = ref<AuthRole[]>([])
  const accountRoles = ref<AuthRole[]>([])
  const initialized = ref(false)
  let fetchMePromise: Promise<AuthUser | null> | null = null
  const lastFetchedAt = ref(0)
  let authRevision = 0

  const isLoggedIn = computed(() => user.value !== null)

  const { apiFetch } = useApi()

  const fetchMe = (force = false) => {
    const cacheTtl = user.value ? 60_000 : 15_000
    if (
      !force &&
      initialized.value &&
      Date.now() - lastFetchedAt.value < cacheTtl
    ) {
      return Promise.resolve(user.value)
    }

    if (fetchMePromise) {
      return fetchMePromise
    }

    const revision = authRevision
    const request = (async () => {
      try {
        const response = await apiFetch<LoginResponse>('/api/auth/me')

        if (revision !== authRevision) {
          return user.value
        }

        user.value = response.user
        permissions.value = response.permissions ?? []
        roles.value = response.roles ?? []
        accountRoles.value = response.account_roles ?? []
        return user.value
      } catch {
        if (revision === authRevision) {
          user.value = null
          permissions.value = []
          roles.value = []
          accountRoles.value = []
        }

        return null
      } finally {
        if (revision === authRevision) {
          initialized.value = true
          lastFetchedAt.value = Date.now()

          fetchMePromise = null
        }
      }
    })()

    fetchMePromise = request
    return request
  }

  const login = async (
    studentNumber: string,
    password: string,
  ) => {
    authRevision += 1
    fetchMePromise = null
    lastFetchedAt.value = 0

    const response = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: {
        student_number: studentNumber,
        password,
      },
    })

    user.value = response.user
    permissions.value = response.permissions ?? []
    roles.value = response.roles ?? []
    accountRoles.value = response.account_roles ?? []
    initialized.value = true
    lastFetchedAt.value = Date.now()

    if (!response.roles || !response.account_roles) {
      await fetchMe(true)
    }

    return response.user
  }

  const hasPermission = (permission: string) => {
    return permissions.value.includes(permission)
  }

  const logout = async () => {
    authRevision += 1
    fetchMePromise = null

    const accountId = user.value?.id
    if (accountId) {
      void deleteNotificationCache(accountId).catch(() => {
        // キャッシュ削除失敗はログアウト処理を妨げない。
      })
    }

    // ログアウト要求の完了を待たずに認証状態を無効化し、
    // 通知一覧などの進行中リクエストがUIを更新しないようにする。
    user.value = null
    permissions.value = []
    roles.value = []
    accountRoles.value = []
    initialized.value = true
    lastFetchedAt.value = Date.now()

    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      })
    } finally {
      authRevision += 1
      fetchMePromise = null
      user.value = null
      permissions.value = []
      roles.value = []
      accountRoles.value = []
      initialized.value = true
      lastFetchedAt.value = Date.now()
    }
  }

  return {
    user,
    permissions,
    roles,
    accountRoles,
    initialized,
    isLoggedIn,
    hasPermission,
    fetchMe,
    login,
    logout,
  }
})
