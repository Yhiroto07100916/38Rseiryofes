export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') {
    return
  }

  const auth = useAuthStore()
  const nuxtApp = useNuxtApp()
  const shouldRefreshSession =
    import.meta.client && !nuxtApp.isHydrating

  if (!auth.initialized || shouldRefreshSession) {
    await auth.fetchMe()
  }

  if (!auth.isLoggedIn) {
    return navigateTo('/login')
  }

  const routeMeta = to.meta as typeof to.meta & {
    permissions?: string[]
  }
  const requiredPermissions = routeMeta.permissions ?? []
  const hasAllRequiredPermissions = requiredPermissions.every(
    (permission) => auth.hasPermission(permission),
  )

  if (!hasAllRequiredPermissions) {
    return navigateTo('/')
  }

  const routeMiddleware = to.meta.middleware
  const middlewareNames = Array.isArray(routeMiddleware)
    ? routeMiddleware
    : routeMiddleware
      ? [routeMiddleware]
      : []

  if (middlewareNames.includes('admin')) {
    const isAdmin = auth.accountRoles.some(
      (role) => role.name === 'admin',
    )

    if (!isAdmin) {
      return navigateTo('/')
    }
  }

  if (middlewareNames.includes('class-representative')) {
    const isClassRepresentative = auth.accountRoles.some(
      (role) =>
        role.name === 'class_representative' ||
        role.name === 'admin',
    )

    if (!isClassRepresentative) {
      return navigateTo('/')
    }
  }
})
