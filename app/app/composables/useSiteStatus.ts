export interface SiteStatus {
  site_visibility: "public" | "private"
  maintenance_mode: boolean
  maintenance_message: string
  require_login: boolean
  login_enabled: boolean
  site_name: string
  site_description: string
  app_version: string
  release_notes: string
  event_name: string
  event_year: number
  timezone: string
  logo_url: string
  favicon_url: string
  social_links: Record<string, string>
  calendar_default_view: "month" | "list"
  task_default_status: "todo" | "in_progress" | "review" | "done"
  upload_max_file_size_mb: number
  feature_enabled: Record<string, boolean>
  is_authenticated: boolean
  is_admin: boolean
  is_important_settings_admin: boolean
}

export interface RefreshSiteStatusOptions {
  apiBaseUrl?: string
  state?: ReturnType<typeof useSiteStatus>
  headers?: Record<string, string>
}

export function useSiteStatus() {
  return useState<SiteStatus | null>("site-status", () => null)
}

export async function refreshSiteStatus(options: RefreshSiteStatusOptions = {}) {
  const nuxtApp = useNuxtApp()

  return await nuxtApp.runWithContext(async () => {
    const resolvedApiBaseUrl =
      options.apiBaseUrl ?? String(useRuntimeConfig().public.apiBaseUrl)
    const apiBaseUrl = resolvedApiBaseUrl.replace(/\/$/, "")
    const headers =
      options.headers ?? (import.meta.server ? useRequestHeaders(["cookie"]) : undefined)

    const status = await $fetch<SiteStatus>(`${apiBaseUrl}/api/site-status`, {
      credentials: "include",
      headers,
    })

    const state = options.state ?? useSiteStatus()
    state.value = status
    return status
  })
}