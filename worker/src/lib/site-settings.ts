type FeatureSetting = {
  enabled?: boolean
  view?: boolean
  create?: boolean
  edit?: boolean
  delete?: boolean
  [action: string]: boolean | undefined
}

type FeatureSettings = Record<string, FeatureSetting>

const PERMISSION_FEATURE_ALIASES: Record<string, string> = {
  schedule: "calendar",
  script: "scripts",
  member: "members",
}

export async function getSiteSetting<T>(
  env: Pick<Env, "DB">,
  key: string,
  fallback: T,
): Promise<T> {
  try {
    const row = await env.DB.prepare(
      "SELECT value FROM site_settings WHERE key = ? LIMIT 1",
    ).bind(key).first<{ value: string }>()
    if (!row) return fallback
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

export async function isFeaturePermissionEnabled(
  env: Pick<Env, "DB">,
  permissionKey: string,
): Promise<boolean> {
  const rawFeature = await getSiteSetting<FeatureSettings>(env, "feature_settings", {})
  const parts = permissionKey.split(".")
  const rawCategory = parts[0] ?? ""
  const category = PERMISSION_FEATURE_ALIASES[rawCategory] ?? rawCategory
  const feature = rawFeature[category]
  if (feature?.enabled === false) return false

  const action = parts[parts.length - 1]
  if (feature && ["view", "create", "edit", "delete", "assign", "comment", "approve", "respond", "export", "share", "revoke"].includes(action)) {
    if (feature[action] === false) return false
  }

  return true
}

export async function getSecuritySettings(env: Pick<Env, "DB">): Promise<{
  session_duration_hours: number
  login_attempt_limit: number
  login_lock_minutes: number
  force_password_change: boolean
}> {
  const value = await getSiteSetting<{
    session_duration_hours?: number
    login_attempt_limit?: number
    login_lock_minutes?: number
    force_password_change?: boolean
  }>(env, "security_settings", {})
  return {
    session_duration_hours: Math.max(1, Math.min(720, Number(value.session_duration_hours) || 168)),
    login_attempt_limit: Math.max(3, Math.min(20, Number(value.login_attempt_limit) || 5)),
    login_lock_minutes: Math.max(1, Math.min(1440, Number(value.login_lock_minutes) || 15)),
    force_password_change: value.force_password_change === true,
  }
}
