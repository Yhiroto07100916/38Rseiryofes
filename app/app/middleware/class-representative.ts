export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) {
    return
  }

  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (!auth.isLoggedIn || !auth.user) {
    return navigateTo('/login')
  }

  const isClassRepresentative = auth.accountRoles.some(
    (role) => role.name === 'class_representative' || "admin",
  )

  if (!isClassRepresentative) {
    return navigateTo('/')
  }
})
