import { requireAccountRole } from "../lib/authz"
import { createNotificationsForUsers } from "../lib/notifications"

export interface AccountRole {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  member_count?: number
}

interface CreateAccountRoleBody {
  name?: unknown
  description?: unknown
}

interface UpdateAccountRoleBody {
  name?: unknown
  description?: unknown
}

function generateId(): string {
  return crypto.randomUUID()
}


const IMPORTANT_SETTINGS_ROLE = "important_settings_admin"

const SETTING_RULES: Record<string, {
  type: "string" | "boolean" | "integer" | "json"
  maxLength?: number
  minLength?: number
  min?: number
  max?: number
  critical?: boolean
}> = {
  site_name: { type: "string", minLength: 1, maxLength: 80 },
  site_description: { type: "string", maxLength: 300 },
  event_name: { type: "string", minLength: 1, maxLength: 80 },
  event_year: { type: "integer", min: 2020, max: 2100 },
  site_visibility: { type: "string", maxLength: 10, critical: true },
  maintenance_mode: { type: "boolean", critical: true },
  maintenance_message: { type: "string", maxLength: 500, critical: true },
  login_enabled: { type: "boolean", critical: true },
  require_login: { type: "boolean", critical: true },
  timezone: { type: "string", minLength: 1, maxLength: 64 },
  logo_url: { type: "string", maxLength: 2048 },
  favicon_url: { type: "string", maxLength: 2048 },
  social_links: { type: "json" },
  feature_settings: { type: "json" },
  notification_settings: { type: "json" },
  operation_settings: { type: "json" },
  security_settings: { type: "json", critical: true },
  "security.force_logout_all_sessions": { type: "string", critical: true },
}

function isValidSettingValue(key: string, value: unknown): boolean {
  if (key === "timezone") {
    if (typeof value !== "string") return false
    try {
      new Intl.DateTimeFormat("ja-JP", { timeZone: value })
      return true
    } catch {
      return false
    }
  }
  if (key === "logo_url" || key === "favicon_url") {
    if (value === "") return true
    if (typeof value !== "string") return false
    try { return new URL(value).protocol === "https:" } catch { return false }
  }
  if (key === "social_links") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const links = value as Record<string, unknown>
    const allowedPlatforms = ["instagram", "x", "tiktok", "youtube", "github", "discord"]
    if (Object.keys(links).some(platform => !allowedPlatforms.includes(platform))) return false
    return allowedPlatforms.every(platform => {
      const url = links[platform]
      if (url === undefined || url === "") return true
      if (typeof url !== "string" || url.length > 2048) return false
      try { return new URL(url).protocol === "https:" } catch { return false }
    })
  }
  if (key === "feature_settings") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    return Object.entries(value as Record<string, unknown>).every(([feature, config]) =>
      /^[a-z_]+$/.test(feature) && Boolean(config) && typeof config === "object" &&
      !Array.isArray(config) &&
      Object.entries(config as Record<string, unknown>).every(([action, enabled]) =>
        ["enabled", "view", "create", "edit", "delete", "assign", "comment", "approve", "respond", "export", "share", "revoke"].includes(action) &&
        typeof enabled === "boolean"
      )
    )
  }
  if (key === "notification_settings") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const settings = value as Record<string, unknown>
    if (typeof settings.enabled !== "boolean" || settings.return_due_all_users !== true) return false
    if (!settings.categories || typeof settings.categories !== "object" || Array.isArray(settings.categories)) return false
    return Object.values(settings.categories as Record<string, unknown>).every(item => typeof item === "boolean")
  }
  if (key === "operation_settings") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const settings = value as Record<string, unknown>
    return ["month", "list"].includes(String(settings.calendar_default_view)) &&
      ["todo", "in_progress", "review", "done"].includes(String(settings.task_default_status)) &&
      Number.isInteger(settings.upload_max_file_size_mb) &&
      Number(settings.upload_max_file_size_mb) >= 1 && Number(settings.upload_max_file_size_mb) <= 100
  }
  if (key === "security_settings") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    const settings = value as Record<string, unknown>
    return Number.isInteger(settings.session_duration_hours) &&
      Number(settings.session_duration_hours) >= 1 && Number(settings.session_duration_hours) <= 720 &&
      Number.isInteger(settings.login_attempt_limit) &&
      Number(settings.login_attempt_limit) >= 3 && Number(settings.login_attempt_limit) <= 20 &&
      Number.isInteger(settings.login_lock_minutes) &&
      Number(settings.login_lock_minutes) >= 1 && Number(settings.login_lock_minutes) <= 1440 &&
      typeof settings.force_password_change === "boolean"
  }
  return true
}

async function requireImportantSettingsAdmin(
  request: Request,
  env: Env,
): Promise<{ userId: string } | Response> {
  const auth = await requireAccountRole(request, env, IMPORTANT_SETTINGS_ROLE)
  if (auth instanceof Response) return auth
  return { userId: auth.user.id }
}

async function handleSiteSettings(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const subPath = pathParts.slice(1)

  if (subPath.length === 1 && subPath[0] === "force-logout" && request.method === "POST") {
    const admin = await requireImportantSettingsAdmin(request, env)
    if (admin instanceof Response) return admin
    const result = await env.DB.prepare("DELETE FROM sessions").run()
    await env.DB.prepare(
      "INSERT INTO site_setting_logs (id, setting_key, old_value, new_value, changed_by) VALUES (?, 'security.force_logout_all_sessions', ?, ?, ?)",
    ).bind(crypto.randomUUID(), String(result.meta?.changes ?? 0), "all_sessions_invalidated", admin.userId).run()
    return Response.json({ success: true, invalidated_sessions: result.meta?.changes ?? 0 })
  }

  if (subPath.length === 1 && subPath[0] === "system-info" && request.method === "GET") {
    const admin = await requireAdmin(request, env)
    if (admin instanceof Response) return admin
    let databaseStatus = "ok"
    try {
      await env.DB.prepare("SELECT 1 AS healthy").first<{ healthy: number }>()
    } catch {
      databaseStatus = "error"
    }
    const versionMetadata = (env as Env & {
      CF_VERSION_METADATA?: { id?: string; tag?: string }
      APP_VERSION?: string
    }).CF_VERSION_METADATA
    const version = versionMetadata?.tag ||
      versionMetadata?.id?.slice(0, 12) ||
      (env as Env & { APP_VERSION?: string }).APP_VERSION ||
      "未設定"
    return Response.json({
      api_status: "ok",
      database_status: databaseStatus,
      version,
      checked_at: new Date().toISOString(),
    })
  }

  if (
    subPath.length === 2 &&
    subPath[0] === "important-admins" &&
    subPath[1] === "candidates" &&
    request.method === "GET"
  ) {
    const admin = await requireImportantSettingsAdmin(request, env)
    if (admin instanceof Response) return admin
    const result = await env.DB.prepare(`
      SELECT u.id, u.student_number, u.name, u.nickname
      FROM users u
      INNER JOIN user_account_roles admin_uar ON admin_uar.user_id = u.id
      INNER JOIN account_roles admin_role ON admin_role.id = admin_uar.account_role_id
      WHERE admin_role.name = 'admin'
        AND NOT EXISTS (
          SELECT 1
          FROM user_account_roles important_uar
          INNER JOIN account_roles important_role
            ON important_role.id = important_uar.account_role_id
          WHERE important_uar.user_id = u.id
            AND important_role.name = ?
        )
      ORDER BY u.student_number
    `).bind(IMPORTANT_SETTINGS_ROLE).all<{
      id: string
      student_number: string
      name: string
      nickname: string | null
    }>()
    return Response.json({ users: result.results })
  }

  if (subPath.length === 1 && subPath[0] === "important-admins") {
    const admin = await requireImportantSettingsAdmin(request, env)
    if (admin instanceof Response) return admin

    if (request.method === "GET") {
      const result = await env.DB.prepare(`
        SELECT u.id, u.student_number, u.name, u.nickname
        FROM user_account_roles uar
        INNER JOIN account_roles ar ON ar.id = uar.account_role_id
        INNER JOIN users u ON u.id = uar.user_id
        WHERE ar.name = ?
        ORDER BY u.student_number
      `).bind(IMPORTANT_SETTINGS_ROLE).all<{
        id: string
        student_number: string
        name: string
        nickname: string | null
      }>()
      return Response.json({ users: result.results })
    }

    if (request.method === "POST") {
      let body: { user_id?: unknown }
      try {
        body = await request.json<{ user_id?: unknown }>()
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 })
      }
      if (typeof body.user_id !== "string" || !body.user_id.trim()) {
        return Response.json({ error: "user_id is required" }, { status: 400 })
      }
      const user = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
        .bind(body.user_id).first<{ id: string }>()
      if (!user) return Response.json({ error: "User not found" }, { status: 404 })

      const targetIsAdmin = await env.DB.prepare(`
        SELECT 1
        FROM user_account_roles uar
        INNER JOIN account_roles ar ON ar.id = uar.account_role_id
        WHERE uar.user_id = ? AND ar.name = 'admin'
        LIMIT 1
      `).bind(user.id).first()
      if (!targetIsAdmin) {
        return Response.json({ error: "Important settings administrators must also have the admin account role" }, { status: 400 })
      }

      const role = await env.DB.prepare("SELECT id FROM account_roles WHERE name = ?")
        .bind(IMPORTANT_SETTINGS_ROLE).first<{ id: string }>()
      if (!role) return Response.json({ error: "Important settings role is not configured" }, { status: 500 })

      const existing = await env.DB.prepare(`
        SELECT 1 FROM user_account_roles
        WHERE user_id = ? AND account_role_id = ?
      `).bind(user.id, role.id).first()
      if (existing) return Response.json({ error: "Role already assigned" }, { status: 409 })

      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO user_account_roles (user_id, account_role_id) VALUES (?, ?)
        `).bind(user.id, role.id),
        env.DB.prepare(`
          INSERT INTO site_setting_logs (id, setting_key, old_value, new_value, changed_by)
          VALUES (?, ?, NULL, 'true', ?)
        `).bind(crypto.randomUUID(), "important_settings_admin:" + user.id, admin.userId),
      ])

      return Response.json({ success: true }, { status: 201 })
    }
  }

  if (subPath.length === 2 && subPath[0] === "important-admins" && request.method === "DELETE") {
    const admin = await requireImportantSettingsAdmin(request, env)
    if (admin instanceof Response) return admin

    const targetUserId = subPath[1]
    const role = await env.DB.prepare("SELECT id FROM account_roles WHERE name = ?")
      .bind(IMPORTANT_SETTINGS_ROLE).first<{ id: string }>()
    if (!role) return Response.json({ error: "Role not found" }, { status: 500 })

    const assigned = await env.DB.prepare(`
      SELECT 1 FROM user_account_roles WHERE user_id = ? AND account_role_id = ?
    `).bind(targetUserId, role.id).first()
    if (!assigned) return Response.json({ error: "Role assignment not found" }, { status: 404 })

    const deletion = await env.DB.batch([
      env.DB.prepare(`
        DELETE FROM user_account_roles
        WHERE user_id = ?
          AND account_role_id = ?
          AND (SELECT COUNT(*) FROM user_account_roles WHERE account_role_id = ?) > 1
      `).bind(targetUserId, role.id, role.id),
      env.DB.prepare(`
        INSERT INTO site_setting_logs (id, setting_key, old_value, new_value, changed_by)
        SELECT ?, ?, 'true', 'false', ?
        WHERE changes() > 0
      `).bind(crypto.randomUUID(), "important_settings_admin:" + targetUserId, admin.userId),
    ])
    if ((deletion[0]?.meta.changes ?? 0) === 0) {
      return Response.json({ error: "At least one important settings administrator must remain" }, { status: 409 })
    }
    return new Response(null, { status: 204 })
  }

  const admin = await requireAdmin(request, env)
  if (admin instanceof Response) return admin
  const importantRole = await env.DB.prepare(`
    SELECT 1
    FROM user_account_roles uar
    INNER JOIN account_roles ar ON ar.id = uar.account_role_id
    WHERE uar.user_id = ? AND ar.name = ?
    LIMIT 1
  `).bind(admin.userId, IMPORTANT_SETTINGS_ROLE).first()
  const isImportantSettingsAdmin = Boolean(importantRole)

  if (subPath.length === 1 && subPath[0] === "logs" && request.method === "GET") {
    const result = await env.DB.prepare(`
      SELECT l.id, l.setting_key, l.old_value, l.new_value, l.changed_by,
        l.changed_at, u.name AS changed_by_name, u.nickname AS changed_by_nickname
      FROM site_setting_logs l
      LEFT JOIN users u ON u.id = l.changed_by
      ORDER BY l.changed_at DESC
      LIMIT 100
    `).all<{
      id: string
      setting_key: string
      old_value: string | null
      new_value: string
      changed_by: string | null
      changed_at: string
      changed_by_name: string | null
      changed_by_nickname: string | null
    }>()
    const logs = result.results.map((log) => {
      if (SETTING_RULES[log.setting_key]?.critical && !isImportantSettingsAdmin) {
        return { ...log, old_value: null, new_value: "[redacted]" }
      }
      return log
    })
    return Response.json({ logs })
  }

  if (subPath.length !== 0) {
    return Response.json({ error: "Not Found" }, { status: 404 })
  }

  if (request.method === "GET") {
    const result = await env.DB.prepare(`
      SELECT key, value, description, updated_by, updated_at
      FROM site_settings
      ORDER BY key
    `).all<{
      key: string
      value: string
      description: string | null
      updated_by: string | null
      updated_at: string
    }>()

    const settings: Record<string, unknown> = {}
    for (const row of result.results) {
      if (SETTING_RULES[row.key]?.critical && !isImportantSettingsAdmin) continue
      try { settings[row.key] = JSON.parse(row.value) } catch { settings[row.key] = null }
    }
    return Response.json({ settings })
  }

  if (request.method === "PATCH") {
    let body: { settings?: unknown }
    try {
      body = await request.json<{ settings?: unknown }>()
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 })
    }
    if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
      return Response.json({ error: "settings must be an object" }, { status: 400 })
    }

    const entries = Object.entries(body.settings as Record<string, unknown>)
    if (entries.length === 0 || entries.length > 20) {
      return Response.json({ error: "Provide between 1 and 20 settings" }, { status: 400 })
    }

    const statements = []
    for (const [key, value] of entries) {
      const rule = SETTING_RULES[key]
      if (!rule) return Response.json({ error: `Unknown setting: ${key}` }, { status: 400 })
      if (rule.critical && !isImportantSettingsAdmin) {
        return Response.json({ error: `Setting requires important settings administrator: ${key}` }, { status: 403 })
      }
      if (
        (rule.type === "string" && (typeof value !== "string" || value.length < (rule.minLength ?? 0) || value.length > (rule.maxLength ?? 1000))) ||
        (rule.type === "boolean" && typeof value !== "boolean") ||
        (rule.type === "integer" && (!Number.isInteger(value) || (value as number) < (rule.min ?? -Infinity) || (value as number) > (rule.max ?? Infinity))) ||
        (rule.type === "json" && !isValidSettingValue(key, value)) ||
        (key === "site_visibility" && value !== "public" && value !== "private")
      ) {
        return Response.json({ error: `Invalid value for setting: ${key}` }, { status: 400 })
      }

      const old = await env.DB.prepare("SELECT value FROM site_settings WHERE key = ?")
        .bind(key).first<{ value: string }>()
      const newValue = JSON.stringify(value)
      if (old?.value === newValue) continue

      statements.push(
        env.DB.prepare(`
          INSERT INTO site_settings (key, value, updated_by, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_by = excluded.updated_by,
            updated_at = CURRENT_TIMESTAMP
        `).bind(key, newValue, admin.userId),
        env.DB.prepare(`
          INSERT INTO site_setting_logs (id, setting_key, old_value, new_value, changed_by)
          VALUES (?, ?, ?, ?, ?)
        `).bind(crypto.randomUUID(), key, old?.value ?? null, newValue, admin.userId),
      )
    }

    if (statements.length) await env.DB.batch(statements)
    return Response.json({ success: true, updated: statements.length / 2 })
  }

  return Response.json({ error: "Method Not Allowed" }, { status: 405 })
}

async function requireAdmin(
  request: Request,
  env: Env,
): Promise<{ userId: string } | Response> {
  const auth = await requireAccountRole(
    request,
    env,
    "admin",
  )

  if (auth instanceof Response) {
    return auth
  }

  return { userId: auth.user.id }
}

export async function handleAccountRoles(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  if (pathParts[0] === "settings") {
    return handleSiteSettings(request, env, pathParts)
  }

  const admin = await requireAdmin(request, env)

  if (admin instanceof Response) {
    return admin
  }

  if (request.method === "GET") {
    if (pathParts.length === 2 && pathParts[1] === "members") {
      const accountRole = await env.DB
        .prepare("SELECT id FROM account_roles WHERE id = ?")
        .bind(pathParts[0])
        .first<{ id: string }>()

      if (!accountRole) {
        return Response.json(
          { error: "Account role not found" },
          { status: 404 },
        )
      }

      const result = await env.DB
        .prepare(`
          SELECT
            u.id,
            u.student_number,
            u.name,
            u.nickname,
            u.created_at,
            u.updated_at,
            CASE
              WHEN uar.user_id IS NULL THEN 0
              ELSE 1
            END AS assigned
          FROM users u
          LEFT JOIN user_account_roles uar
            ON uar.user_id = u.id
            AND uar.account_role_id = ?
          ORDER BY u.student_number
        `)
        .bind(pathParts[0])
        .all<{
          id: string
          student_number: string
          name: string
          nickname: string | null
          created_at: string
          updated_at: string
          assigned: number
        }>()

      return Response.json({
        users: result.results,
      })
    }

    if (pathParts.length === 0) {
      const result = await env.DB
        .prepare(`
          SELECT
            ar.id,
            ar.name,
            ar.description,
            ar.created_at,
            ar.updated_at,
            COUNT(DISTINCT uar.user_id) AS member_count
          FROM account_roles ar
          LEFT JOIN user_account_roles uar
            ON uar.account_role_id = ar.id
          GROUP BY
            ar.id,
            ar.name,
            ar.description,
            ar.created_at,
            ar.updated_at
          ORDER BY ar.name ASC
        `)
        .all<AccountRole>()

      return Response.json({
        account_roles: result.results,
      })
    }

    if (pathParts.length === 1) {
      const accountRole = await env.DB
        .prepare(`
          SELECT
            id,
            name,
            description,
            created_at,
            updated_at
          FROM account_roles
          WHERE id = ?
        `)
        .bind(pathParts[0])
        .first<AccountRole>()

      if (!accountRole) {
        return Response.json(
          { error: "Account role not found" },
          { status: 404 },
        )
      }

      return Response.json({
        account_role: accountRole,
      })
    }

    return Response.json(
      { error: "Not Found" },
      { status: 404 },
    )
  }

  if (request.method === "POST" && pathParts.length === 0) {
    let body: CreateAccountRoleBody

    try {
      body = await request.json<CreateAccountRoleBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    if (
      typeof body.name !== "string" ||
      body.name.trim().length === 0
    ) {
      return Response.json(
        { error: "name is required" },
        { status: 400 },
      )
    }

    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== "string"
    ) {
      return Response.json(
        { error: "description must be a string or null" },
        { status: 400 },
      )
    }

    const name = body.name.trim()
    const description =
      body.description === undefined || body.description === null
        ? null
        : body.description.trim()

    const existing = await env.DB
      .prepare(`
        SELECT id
        FROM account_roles
        WHERE name = ?
      `)
      .bind(name)
      .first<{ id: string }>()

    if (existing) {
      return Response.json(
        { error: "Account role already exists" },
        { status: 409 },
      )
    }

    const id = generateId()

    await env.DB
      .prepare(`
        INSERT INTO account_roles (
          id,
          name,
          description
        )
        VALUES (?, ?, ?)
      `)
      .bind(id, name, description)
      .run()

    const accountRole = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          description,
          created_at,
          updated_at
        FROM account_roles
        WHERE id = ?
      `)
      .bind(id)
      .first<AccountRole>()

    return Response.json(
      {
        account_role: accountRole,
      },
      { status: 201 },
    )
  }

  if (request.method === "PATCH" && pathParts.length === 1) {
    let body: UpdateAccountRoleBody

    try {
      body = await request.json<UpdateAccountRoleBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    const existing = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          description,
          created_at,
          updated_at
        FROM account_roles
        WHERE id = ?
      `)
      .bind(pathParts[0])
      .first<AccountRole>()

    if (!existing) {
      return Response.json(
        { error: "Account role not found" },
        { status: 404 },
      )
    }

    const name =
      body.name === undefined
        ? existing.name
        : typeof body.name === "string" && body.name.trim().length > 0
          ? body.name.trim()
          : null

    if (existing.name === IMPORTANT_SETTINGS_ROLE && name !== IMPORTANT_SETTINGS_ROLE) {
      return Response.json({ error: "Important settings administrator role cannot be renamed" }, { status: 403 })
    }

    if (name === null) {
      return Response.json(
        { error: "name must be a non-empty string" },
        { status: 400 },
      )
    }

    const description =
      body.description === undefined
        ? existing.description
        : body.description === null
          ? null
          : typeof body.description === "string"
            ? body.description.trim()
            : null

    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== "string"
    ) {
      return Response.json(
        { error: "description must be a string or null" },
        { status: 400 },
      )
    }

    const duplicate = await env.DB
      .prepare(`
        SELECT id
        FROM account_roles
        WHERE name = ?
          AND id != ?
      `)
      .bind(name, pathParts[0])
      .first<{ id: string }>()

    if (duplicate) {
      return Response.json(
        { error: "Account role already exists" },
        { status: 409 },
      )
    }

    await env.DB
      .prepare(`
        UPDATE account_roles
        SET
          name = ?,
          description = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(name, description, pathParts[0])
      .run()

    const accountRole = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          description,
          created_at,
          updated_at
        FROM account_roles
        WHERE id = ?
      `)
      .bind(pathParts[0])
      .first<AccountRole>()

    return Response.json({
      account_role: accountRole,
    })
  }

  if (request.method === "DELETE" && pathParts.length === 1) {
    const existing = await env.DB
      .prepare(`
        SELECT id
        FROM account_roles
        WHERE id = ?
      `)
      .bind(pathParts[0])
      .first<{ id: string }>()

    if (!existing) {
      return Response.json(
        { error: "Account role not found" },
        { status: 404 },
      )
    }
    const protectedRole = await env.DB.prepare("SELECT name FROM account_roles WHERE id = ?")
      .bind(pathParts[0]).first<{ name: string }>()
    if (protectedRole?.name === IMPORTANT_SETTINGS_ROLE) {
      return Response.json({ error: "Important settings administrator role cannot be deleted" }, { status: 403 })
    }

    const assignmentCount = await env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM user_account_roles
        WHERE account_role_id = ?
      `)
      .bind(pathParts[0])
      .first<{ count: number }>()

    if ((assignmentCount?.count ?? 0) > 0) {
      return Response.json(
        {
          error: "Account role is assigned to users",
        },
        { status: 409 },
      )
    }

    await env.DB
      .prepare(`
        DELETE FROM account_roles
        WHERE id = ?
      `)
      .bind(pathParts[0])
      .run()

    return new Response(null, { status: 204 })
  }

  return Response.json(
    { error: "Not Found" },
    { status: 404 },
  )
}

export async function handleUserAccountRoles(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const admin = await requireAdmin(request, env)

  if (admin instanceof Response) {
    return admin
  }

  const userId = pathParts[0]

  const user = await env.DB
    .prepare(`
      SELECT id
      FROM users
      WHERE id = ?
    `)
    .bind(userId)
    .first<{ id: string }>()

  if (!user) {
    return Response.json(
      { error: "User not found" },
      { status: 404 },
    )
  }

  if (request.method === "GET" && pathParts.length === 1) {
    const result = await env.DB
      .prepare(`
        SELECT
          ar.id,
          ar.name,
          ar.description,
          ar.created_at,
          ar.updated_at
        FROM user_account_roles uar
        INNER JOIN account_roles ar
          ON ar.id = uar.account_role_id
        WHERE uar.user_id = ?
        ORDER BY ar.name ASC
      `)
      .bind(userId)
      .all<AccountRole>()

    return Response.json({
      account_roles: result.results,
    })
  }

  if (request.method === "POST" && pathParts.length === 1) {
    let body: { account_role_id?: unknown }

    try {
      body = await request.json<{ account_role_id?: unknown }>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    if (
      typeof body.account_role_id !== "string" ||
      body.account_role_id.trim().length === 0
    ) {
      return Response.json(
        { error: "account_role_id is required" },
        { status: 400 },
      )
    }

    const accountRole = await env.DB
      .prepare(`
        SELECT id, name
        FROM account_roles
        WHERE id = ?
      `)
      .bind(body.account_role_id)
      .first<{ id: string; name: string }>()

    if (!accountRole) {
      return Response.json(
        { error: "Account role not found" },
        { status: 404 },
      )
    }

    if (accountRole.name === IMPORTANT_SETTINGS_ROLE) {
      return Response.json({
        error: "Use the dedicated site settings administrator management endpoint",
      }, { status: 403 })
    }

    const existing = await env.DB
      .prepare(`
        SELECT 1
        FROM user_account_roles
        WHERE user_id = ?
          AND account_role_id = ?
      `)
      .bind(userId, body.account_role_id)
      .first()

    if (existing) {
      return Response.json(
        { error: "Account role already assigned" },
        { status: 409 },
      )
    }

    await env.DB
      .prepare(`
        INSERT INTO user_account_roles (
          user_id,
          account_role_id
        )
        VALUES (?, ?)
      `)
      .bind(userId, body.account_role_id)
      .run()

    try {
      await createNotificationsForUsers(env, {
        recipientUserIds: [userId],
        eventKey: "account_admin.role_granted",
        category: "account_admin",
        title: "アカウントロールが付与されました",
        body: accountRole.name,
        targetUrl: "/me",
        actorUserId: admin.userId,
        entityType: "account_role",
        entityId: accountRole.id,
        dedupeKey: "account_admin.role_granted:" + userId + ":" + accountRole.id + ":" + crypto.randomUUID(),
      })
    } catch (notificationError) {
      console.error("Failed to create account role grant notification:", notificationError)
    }

    return Response.json(
      {
        message: "Account role assigned",
      },
      { status: 201 },
    )
  }

  if (
    request.method === "DELETE" &&
    pathParts.length === 2
  ) {
    const accountRoleId = pathParts[1]

    const existing = await env.DB
      .prepare(`
        SELECT 1
        FROM user_account_roles
        WHERE user_id = ?
          AND account_role_id = ?
      `)
      .bind(userId, accountRoleId)
      .first()

    if (!existing) {
      return Response.json(
        { error: "Account role assignment not found" },
        { status: 404 },
      )
    }

    const accountRole = await env.DB.prepare(
      "SELECT id, name FROM account_roles WHERE id = ?",
    ).bind(accountRoleId).first<{ id: string; name: string }>()

    if (accountRole?.name === IMPORTANT_SETTINGS_ROLE) {
      return Response.json({
        error: "Use the dedicated site settings administrator management endpoint",
      }, { status: 403 })
    }

    if (accountRole?.name === "admin") {
      const isImportantAdmin = await env.DB.prepare(`
        SELECT 1
        FROM user_account_roles uar
        INNER JOIN account_roles ar ON ar.id = uar.account_role_id
        WHERE uar.user_id = ? AND ar.name = ?
        LIMIT 1
      `).bind(userId, IMPORTANT_SETTINGS_ROLE).first()
      if (isImportantAdmin) {
        return Response.json({
          error: "Remove the important settings administrator role before removing the admin role",
        }, { status: 409 })
      }
    }

    await env.DB
      .prepare(`
        DELETE FROM user_account_roles
        WHERE user_id = ?
          AND account_role_id = ?
      `)
      .bind(userId, accountRoleId)
      .run()

    if (accountRole) {
      try {
        await createNotificationsForUsers(env, {
          recipientUserIds: [userId],
          eventKey: "account_admin.role_revoked",
          category: "account_admin",
          title: "アカウントロールが解除されました",
          body: accountRole.name,
          targetUrl: "/me",
          actorUserId: admin.userId,
          entityType: "account_role",
          entityId: accountRole.id,
          dedupeKey: "account_admin.role_revoked:" + userId + ":" + accountRole.id + ":" + crypto.randomUUID(),
        })
      } catch (notificationError) {
        console.error("Failed to create account role revocation notification:", notificationError)
      }
    }

    return new Response(null, { status: 204 })
  }

  return Response.json(
    { error: "Not Found" },
    { status: 404 },
  )
}
