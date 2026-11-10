export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login") {
    return
  }

  const siteStatus = useSiteStatus().value
  const requiresLogin =
    !siteStatus ||
    siteStatus.require_login ||
    siteStatus.site_visibility === "private"

  if (!requiresLogin) {
    return
  }

  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (!auth.isLoggedIn) {
    return navigateTo("/login")
  }
})
