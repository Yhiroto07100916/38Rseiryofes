import { defineStore } from 'pinia'

interface AuthUser {
  id: string
  student_number: string
  name: string
  nickname: string | null
  avatar_key: string | null
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
  let authRevision = 0

  const isLoggedIn = computed(() => user.value !== null)

  const { apiFetch } = useApi()

  const fetchMe = () => {
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

          if (fetchMePromise === request) {
            fetchMePromise = null
          }
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

    if (!response.roles || !response.account_roles) {
      await fetchMe()
    }

    return response.user
  }

  const hasPermission = (permission: string) => {
    return permissions.value.includes(permission)
  }

  const logout = async () => {
    authRevision += 1
    fetchMePromise = null

    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      })
    } finally {
      user.value = null
      permissions.value = []
      roles.value = []
      accountRoles.value = []
      initialized.value = true
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
