import { defineStore } from 'pinia'

interface AuthUser {
  id: string
  student_number: string
  name: string
  nickname: string | null
}

interface LoginResponse {
  user: AuthUser
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const initialized = ref(false)

  const isLoggedIn = computed(() => user.value !== null)

  const { apiFetch } = useApi()

  const fetchMe = async () => {
    try {
      const response = await apiFetch<LoginResponse>('/api/auth/me')
      user.value = response.user
      return user.value
    } catch {
      user.value = null
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
    initialized.value = true

    return response.user
  }

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      })
    } finally {
      user.value = null
      initialized.value = true
    }
  }

  return {
    user,
    initialized,
    isLoggedIn,
    fetchMe,
    login,
    logout,
  }
})
