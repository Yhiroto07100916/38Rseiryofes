export default defineNuxtRouteMiddleware(async () => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (!auth.isLoggedIn || !auth.user) {
    return navigateTo('/login')
  }

  const isAdmin = auth.accountRoles.some(
    (role) => role.name === 'admin',
  )

  if (!isAdmin) {
    return navigateTo('/')
  }
})
