import type { SiteStatus } from "~/composables/useSiteStatus"

export default defineNuxtRouteMiddleware(async (to) => {
  const siteStatusState = useSiteStatus()
  siteStatusState.value = null

  let siteStatus: SiteStatus | null = null

  try {
    siteStatus = await refreshSiteStatus()
  } catch {
    // Keep login required when the settings endpoint is unavailable.
  }

  // Legal documents must remain readable without an account, including while
  // the site is private or in maintenance mode.
  if (to.path === "/privacy-policy" || to.path === "/terms") {
    return
  }

  const requiresLogin =
    !siteStatus ||
    siteStatus.require_login ||
    siteStatus.site_visibility === "private"

  const featureRoutes: Array<[string, string]> = [
    ["/tasks", "tasks"],
    ["/calendar", "calendar"],
    ["/class-representative/attendance", "attendance"],
    ["/news", "news"],
    ["/scripts", "scripts"],
    ["/accounting", "accounting"],
    ["/equipment", "equipment"],
    ["/surveys", "surveys"],
    ["/files", "files"],
    ["/submissions", "submissions"],
    ["/decisions", "decisions"],
    ["/minutes", "minutes"],
    ["/tool-rental", "tool_rental"],
    ["/wishlist", "wishlist"],
    ["/milk-collection", "milk_collection"],
  ]
  const disabledFeature = featureRoutes.find(([prefix, feature]) =>
    (to.path === prefix || to.path.startsWith(prefix + "/")) &&
    siteStatus?.feature_enabled?.[feature] === false,
  )
  if (disabledFeature && !to.path.startsWith("/admin")) {
    return navigateTo("/")
  }

  const isMaintenanceAdminLogin =
    to.path === "/login" &&
    to.query.maintenanceAdmin === "1"

  if (
    siteStatus?.maintenance_mode &&
    !siteStatus.is_important_settings_admin &&
    to.path !== "/maintenance" &&
    !isMaintenanceAdminLogin
  ) {
    return navigateTo("/maintenance")
  }

  if (
    to.path === "/maintenance" &&
    siteStatus?.is_important_settings_admin
  ) {
    return navigateTo("/")
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

  if (auth.user?.must_change_password && to.path !== "/me") {
    return navigateTo("/me")
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
