export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (!auth.isLoggedIn || !auth.user) {
    return navigateTo('/login')
  }

  const { apiFetch } = useApi()

  try {
    const response = await apiFetch<{
      account_roles: Array<{
        id: string
        name: string
        description: string | null
      }>
    }>(`/api/users/${auth.user.id}/account-roles`)

    const isAdmin = response.account_roles.some(
      (role) => role.name === 'admin',
    )

    if (!isAdmin) {
      return navigateTo('/')
    }
  } catch {
    return navigateTo('/')
  }
})
