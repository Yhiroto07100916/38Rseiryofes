export default defineNuxtRouteMiddleware(async (to) => {
  let requiresLogin = true

  if (import.meta.client) {
    const config = useRuntimeConfig()
    const apiBaseUrl = String(config.public.apiBaseUrl).replace(/\/$/, "")

    try {
      const siteStatus = await $fetch<{
        maintenance_mode: boolean
        maintenance_message: string
        require_login: boolean
        site_visibility: "public" | "private"
        is_admin: boolean
      }>(`${apiBaseUrl}/api/site-status`, {
        credentials: "include",
      })

      requiresLogin = siteStatus.require_login || siteStatus.site_visibility === "private"

      if (
        siteStatus.maintenance_mode &&
        !siteStatus.is_admin &&
        to.path !== "/maintenance" &&
        to.path !== "/login"
      ) {
        return navigateTo("/maintenance")
      }

      if (to.path === "/maintenance" && siteStatus.is_admin) {
        return navigateTo("/")
      }
    } catch {
      // The API access guard remains authoritative if the status endpoint is unavailable.
    }
  }

  if (to.path === "/login" || to.path === "/maintenance") {
    return
  }

  const auth = useAuthStore()
  const nuxtApp = useNuxtApp()
  const shouldRefreshSession =
    import.meta.client && !nuxtApp.isHydrating

  if (!auth.initialized || shouldRefreshSession) {
    await auth.fetchMe()
  }

  if (!auth.isLoggedIn && requiresLogin) {
    return navigateTo("/login")
  }

  const routeMeta = to.meta as typeof to.meta & {
    permissions?: string[]
  }
  const requiredPermissions = routeMeta.permissions ?? []
  const hasAllRequiredPermissions = requiredPermissions.every(
    (permission) => auth.hasPermission(permission),
  )

  if (!hasAllRequiredPermissions) {
    return navigateTo("/")
  }

  const routeMiddleware = to.meta.middleware
  const middlewareNames = Array.isArray(routeMiddleware)
    ? routeMiddleware
    : routeMiddleware
      ? [routeMiddleware]
      : []

  if (middlewareNames.includes("admin")) {
    const isAdmin = auth.accountRoles.some(
      (role) => role.name === "admin",
    )

    if (!isAdmin) {
      return navigateTo("/")
    }
  }

  if (middlewareNames.includes("class-representative")) {
    const isClassRepresentative = auth.accountRoles.some(
      (role) =>
        role.name === "class_representative" ||
        role.name === "admin",
    )

    if (!isClassRepresentative) {
      return navigateTo("/")
    }
  }
})
