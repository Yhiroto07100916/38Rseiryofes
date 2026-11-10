export interface SiteStatus {
  site_visibility: "public" | "private"
  maintenance_mode: boolean
  maintenance_message: string
  require_login: boolean
  login_enabled: boolean
  site_name: string
  site_description: string
  event_name: string
  event_year: number
  timezone: string
  logo_url: string
  favicon_url: string
  calendar_default_view: "month" | "list"
  feature_enabled: Record<string, boolean>
  is_authenticated: boolean
  is_admin: boolean
  is_important_settings_admin: boolean
}

export function useSiteStatus() {
  return useState<SiteStatus | null>("site-status", () => null)
}

export async function refreshSiteStatus() {
  const config = useRuntimeConfig()
  const apiBaseUrl = String(config.public.apiBaseUrl).replace(/\/$/, "")
  const status = await $fetch<SiteStatus>(`${apiBaseUrl}/api/site-status`, {
    credentials: "include",
    headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
  })

  useSiteStatus().value = status
  return status
}
