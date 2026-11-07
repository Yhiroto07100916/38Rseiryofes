export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') {
    return
  }

  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (!auth.isLoggedIn) {
    return navigateTo('/login')
  }

  const routeMiddleware = to.meta.middleware
  const middlewareNames = (
    Array.isArray(routeMiddleware)
      ? routeMiddleware
      : routeMiddleware
        ? [routeMiddleware]
        : []
  ).filter(
    (middleware): middleware is string =>
      typeof middleware === 'string',
  )

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
