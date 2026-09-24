export const useApi = () => {
  const config = useRuntimeConfig()

  const apiFetch = <T>(
    path: string,
    options: Parameters<typeof $fetch<T>>[1] = {},
  ) => {
    const headers = new Headers(
      (options as RequestInit).headers,
    )

    if (import.meta.server) {
      const requestHeaders = useRequestHeaders([
        'cookie',
      ])

      if (requestHeaders.cookie) {
        headers.set('cookie', requestHeaders.cookie)
      }
    }

    return $fetch<T>(path, {
      baseURL: config.public.apiBaseUrl,
      credentials: 'include',
      ...options,
      headers,
    })
  }

  return {
    apiFetch,
  }
}
