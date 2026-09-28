import { defineStore } from 'pinia'

interface AuthUser {
  id: string
  student_number: string
  name: string
  nickname: string | null
}

interface LoginResponse {
  user: AuthUser
  permissions: string[]
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const permissions = ref<string[]>([])
  const initialized = ref(false)

  const isLoggedIn = computed(() => user.value !== null)

  const { apiFetch } = useApi()

  const fetchMe = async () => {
    try {
      const response = await apiFetch<LoginResponse>('/api/auth/me')
      user.value = response.user
      permissions.value = response.permissions
      return user.value
    } catch {
      user.value = null
      permissions.value = []
      return null
    } finally {
      initialized.value = true
    }
  }

  const login = async (
    studentNumber: string,
    password: string,
  ) => {
    const response = await apiFetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: {
        student_number: studentNumber,
        password,
      },
    })

    user.value = response.user
    permissions.value = response.permissions
    initialized.value = true

    return response.user
  }

  const hasPermission = (permission: string) => {
    return permissions.value.includes(permission)
  }

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      })
    } finally {
      user.value = null
      permissions.value = []
      initialized.value = true
    }
  }

  return {
    user,
    permissions,
    initialized,
    isLoggedIn,
    hasPermission,
    fetchMe,
    login,
    logout,
  }
})
