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

  const middleware = Array.isArray(to.meta.middleware)
    ? to.meta.middleware
    : [to.meta.middleware]

  if (middleware.includes('admin')) {
    const isAdmin = auth.accountRoles.some(
      (role) => role.name === 'admin',
    )

    if (!isAdmin) {
      return navigateTo('/')
    }
  }

  if (middleware.includes('class-representative')) {
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
