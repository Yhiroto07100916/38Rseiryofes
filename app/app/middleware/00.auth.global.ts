export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || to.path === '/login') {
    return
  }

  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (!auth.isLoggedIn) {
    return navigateTo('/login')
  }
})
