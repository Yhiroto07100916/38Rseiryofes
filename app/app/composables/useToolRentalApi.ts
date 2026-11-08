export const useToolRentalApi = () => {
  const { apiFetch } = useApi()

  const request = <T>(
    path: string,
    options: Parameters<typeof $fetch<T>>[1] = {},
  ) => {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return apiFetch<T>(`/api/tool-rental${normalizedPath}`, options)
  }

  return { request }
}
