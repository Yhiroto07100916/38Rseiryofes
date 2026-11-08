export const useToolRentalAuth = () => {
  const auth = useAuthStore()

  const isAdmin = computed(() => auth.hasPermission('tool_rental.manage'))
  const isStaff = computed(() =>
    auth.hasPermission('tool_rental.checkout') ||
    auth.hasPermission('tool_rental.return'),
  )

  return { isAdmin, isStaff }
}
