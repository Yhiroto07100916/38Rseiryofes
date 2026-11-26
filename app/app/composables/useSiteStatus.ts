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

const SITE_STATUS_CACHE_TTL_MS = 30_000

export function useSiteStatus() {
  return useState<SiteStatus | null>("site-status", () => null)
}

export function invalidateSiteStatus() {
  useSiteStatus().value = null
  useState<number>("site-status-refreshed-at", () => 0).value = 0
}

export async function refreshSiteStatus(
  options: { force?: boolean } = {},
) {
  const statusState = useSiteStatus()
  const refreshedAt = useState<number>("site-status-refreshed-at", () => 0)

  if (
    !options.force &&
    statusState.value &&
    Date.now() - refreshedAt.value < SITE_STATUS_CACHE_TTL_MS
  ) {
    return statusState.value
  }

  const config = useRuntimeConfig()
  const apiBaseUrl = String(config.public.apiBaseUrl).replace(/\/$/, "")
  const status = await $fetch<SiteStatus>(`${apiBaseUrl}/api/site-status`, {
    credentials: "include",
    headers: import.meta.server ? useRequestHeaders(["cookie"]) : undefined,
  })

  statusState.value = status
  refreshedAt.value = Date.now()
  return status
}
