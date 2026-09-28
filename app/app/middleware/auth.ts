export default defineNuxtRouteMiddleware(async (to) => {
  console.log('[auth middleware] start:', to.path)

  if (to.path === '/login') {
    return
  }

  const auth = useAuthStore()

  console.log('[auth middleware] initialized:', auth.initialized)
  console.log('[auth middleware] isLoggedIn:', auth.isLoggedIn)

  if (!auth.initialized) {
    console.log('[auth middleware] calling fetchMe')
    await auth.fetchMe()
    console.log('[auth middleware] fetchMe finished')
  }

  console.log('[auth middleware] final isLoggedIn:', auth.isLoggedIn)

  if (!auth.isLoggedIn) {
    console.log('[auth middleware] redirecting to /login')
    return navigateTo('/login')
  }
})
