import {
  getUserPermissions,
  requireAccountRole,
} from "../lib/authz"
import { hashPassword, verifyPassword } from "../lib/password"
import { getSecuritySettings } from "../lib/site-settings"
import {
  createLoginSessionHeaders,
  createLogoutSessionHeaders,
  createSession,
  deleteOtherSessions,
  deleteSession,
  getSessionId,
  getSessionCookieDomain,
  getSessionUser,
} from "../lib/session"

interface LoginBody {
  student_number?: unknown
  password?: unknown
}

interface ChangePasswordBody {
  current_password?: unknown
  new_password?: unknown
  new_password_confirmation?: unknown
}

interface UpdateProfileBody {
  nickname?: unknown
}

export async function handleAuth(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 1) {
    if (pathParts[0] === "login") {
      return handleLogin(request, env)
    }

    if (pathParts[0] === "logout") {
      return handleLogout(request, env)
    }
  }

  if (request.method === "GET" && pathParts.length === 1) {
    if (pathParts[0] === "me") {
      return handleMe(request, env)
    }
  }

  if (request.method === "PATCH" && pathParts.length === 1) {
    if (pathParts[0] === "password") {
      return handleChangePassword(request, env)
    }

    if (pathParts[0] === "profile") {
      return handleUpdateProfile(request, env)
    }
  }

  return Response.json(
    { error: "Method Not Allowed" },
    { status: 405 },
  )
}

interface AuthRole {
  id: string
  name: string
  description: string | null
  created_at: string
}

async function getAuthData(env: Env, userId: string) {
  const [permissions, roles, accountRoles] = await Promise.all([
    getUserPermissions(env, userId),
    env.DB
      .prepare(`
        SELECT
          r.id,
          r.name,
          r.description,
          r.created_at
        FROM roles r
        INNER JOIN user_roles ur
          ON ur.role_id = r.id
        WHERE ur.user_id = ?
        ORDER BY r.name
      `)
      .bind(userId)
      .all<AuthRole>(),
    env.DB
      .prepare(`
        SELECT
          ar.id,
          ar.name,
          ar.description,
          ar.created_at
        FROM account_roles ar
        INNER JOIN user_account_roles uar
          ON uar.account_role_id = ar.id
        WHERE uar.user_id = ?
        ORDER BY ar.name
      `)
      .bind(userId)
      .all<AuthRole>(),
  ])

  return {
    permissions,
    roles: roles.results,
    account_roles: accountRoles.results,
  }
}

async function isLoginEnabled(env: Env): Promise<boolean> {
  try {
    const setting = await env.DB.prepare(
      "SELECT value FROM site_settings WHERE key = 'login_enabled'",
    ).first<{ value: string }>()

    if (!setting) return true
    return JSON.parse(setting.value) !== false
  } catch {
    // The setting migration may not be applied yet; preserve the legacy behavior.
    return true
  }
}

async function handleLogin(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: LoginBody

  try {
    body = await request.json<LoginBody>()
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400 },
    )
  }

  if (
    typeof body.student_number !== "string" ||
    body.student_number.trim() === ""
  ) {
    return Response.json(
      { error: "student_number is required" },
      { status: 400 },
    )
  }

  if (
    typeof body.password !== "string" ||
    body.password === ""
  ) {
    return Response.json(
      { error: "password is required" },
      { status: 400 },
    )
  }

  const studentNumber = body.student_number.trim()

  const securitySettings = await getSecuritySettings(env)
  const clientIp = request.headers.get("CF-Connecting-IP") ?? "unknown"
  const identifierDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(studentNumber + "|" + clientIp),
  )
  const identifierHash = Array.from(new Uint8Array(identifierDigest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("")
  const lock = await env.DB.prepare(
    "SELECT failed_attempts, locked_until FROM login_attempt_locks WHERE identifier_hash = ?",
  ).bind(identifierHash).first<{ failed_attempts: number; locked_until: string | null }>()
  if (lock?.locked_until && Date.parse(lock.locked_until + (lock.locked_until.endsWith("Z") ? "" : "Z")) > Date.now()) {
    return Response.json(
      { error: "Too many failed login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((Date.parse(lock.locked_until + (lock.locked_until.endsWith("Z") ? "" : "Z")) - Date.now()) / 1000))) } },
    )
  }

  const user = await env.DB
    .prepare(`
      SELECT
        id,
        student_number,
        name,
        nickname,
        avatar_key,
        password_hash,
        password_changed_at
      FROM users
      WHERE student_number = ?
    `)
    .bind(studentNumber)
    .first<{
      id: string
      student_number: string
      name: string
      nickname: string | null
      avatar_key: string | null
      password_hash: string | null
      password_changed_at: string | null
    }>()

  if (
    !user ||
    !user.password_hash ||
    !(await verifyPassword(body.password, user.password_hash))
  ) {
    const lockExpired = lock?.locked_until
      ? Date.parse(lock.locked_until + (lock.locked_until.endsWith("Z") ? "" : "Z")) <= Date.now()
      : false
    const failedAttempts = (lockExpired ? 0 : lock?.failed_attempts ?? 0) + 1
    const lockedUntil = failedAttempts >= securitySettings.login_attempt_limit
      ? new Date(Date.now() + securitySettings.login_lock_minutes * 60_000).toISOString()
      : null
    await env.DB.prepare(
      "INSERT INTO login_attempt_locks (identifier_hash, failed_attempts, locked_until, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) " +
      "ON CONFLICT(identifier_hash) DO UPDATE SET failed_attempts = excluded.failed_attempts, locked_until = excluded.locked_until, updated_at = CURRENT_TIMESTAMP",
    ).bind(identifierHash, failedAttempts, lockedUntil).run()
    return Response.json(
      { error: "Invalid student number or password" },
      { status: 401 },
    )
  }

  await env.DB.prepare("DELETE FROM login_attempt_locks WHERE identifier_hash = ?")
    .bind(identifierHash).run()

  const maintenanceMode = await getSiteSetting<boolean>(env, "maintenance_mode", false)
  const loginEnabled = await isLoginEnabled(env)
  if (!loginEnabled || maintenanceMode) {
    const isImportantSettingsAdmin = await env.DB.prepare(`
      SELECT 1
      FROM user_account_roles uar
      INNER JOIN account_roles ar ON ar.id = uar.account_role_id
      WHERE uar.user_id = ? AND ar.name = 'important_settings_admin'
      LIMIT 1
    `).bind(user.id).first()

    if (!isImportantSettingsAdmin) {
      return Response.json(
        { error: maintenanceMode ? "Maintenance mode" : "Login is currently disabled for regular users" },
        { status: maintenanceMode ? 503 : 403 },
      )
    }
  }

  const sessionDurationMs = securitySettings.session_duration_hours * 60 * 60 * 1000
  const sessionId = await createSession(
    env,
    user.id,
    sessionDurationMs,
  )

  const access = await getAuthData(env, user.id)

  const secure = new URL(request.url).protocol === "https:"
  const headers = createLoginSessionHeaders(
    sessionId,
    secure,
    getSessionCookieDomain(request),
    sessionDurationMs,
  )

  return Response.json(
    {
      user: {
        id: user.id,
        student_number: user.student_number,
        name: user.name,
        nickname: user.nickname,
        avatar_key: user.avatar_key,
        must_change_password: securitySettings.force_password_change && !user.password_changed_at,
      },
      ...access,
    },
    { headers },
  )
}

async function handleLogout(
  request: Request,
  env: Env,
): Promise<Response> {
  await deleteSession(request, env)

  const secure = new URL(request.url).protocol === "https:"
  const headers = createLogoutSessionHeaders(
    secure,
    getSessionCookieDomain(request),
  )

  return Response.json(
    { message: "Logged out" },
    { headers },
  )
}

async function handleMe(
  request: Request,
  env: Env,
): Promise<Response> {
  const user = await getSessionUser(
    request,
    env,
  )

  if (!user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    )
  }

  const [access, securitySettings, passwordState] = await Promise.all([
    getAuthData(env, user.id),
    getSecuritySettings(env),
    env.DB.prepare("SELECT password_changed_at FROM users WHERE id = ?")
      .bind(user.id).first<{ password_changed_at: string | null }>(),
  ])

  return Response.json({
    user: {
      ...user,
      must_change_password: securitySettings.force_password_change && !passwordState?.password_changed_at,
    },
    ...access,
  })
}


async function handleUpdateProfile(
  request: Request,
  env: Env,
): Promise<Response> {
  const sessionUser = await getSessionUser(
    request,
    env,
  )

  if (!sessionUser) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    )
  }

  let body: UpdateProfileBody

  try {
    body = await request.json<UpdateProfileBody>()
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400 },
    )
  }

  if (typeof body.nickname !== "string") {
    return Response.json(
      { error: "nickname is required" },
      { status: 400 },
    )
  }

  const nickname = body.nickname.trim()

  if (nickname.length > 30) {
    return Response.json(
      { error: "nickname must be 30 characters or less" },
      { status: 400 },
    )
  }

  const updatedAt = new Date().toISOString()

  await env.DB
    .prepare(`
      UPDATE users
      SET
        nickname = ?,
        updated_at = ?
      WHERE id = ?
    `)
    .bind(
      nickname || null,
      updatedAt,
      sessionUser.id,
    )
    .run()

  const user = await env.DB
    .prepare(`
      SELECT
        id,
        student_number,
        name,
        nickname,
        avatar_key
      FROM users
      WHERE id = ?
    `)
    .bind(sessionUser.id)
    .first<{
      id: string
      student_number: string
      name: string
      nickname: string | null
      avatar_key: string | null
    }>()

  if (!user) {
    return Response.json(
      { error: "User not found" },
      { status: 404 },
    )
  }

  return Response.json({ user })
}

async function handleChangePassword(
  request: Request,
  env: Env,
): Promise<Response> {
  const sessionUser = await getSessionUser(
    request,
    env,
  )

  if (!sessionUser) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    )
  }

  const sessionId = getSessionId(request)

  if (!sessionId) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    )
  }

  let body: ChangePasswordBody

  try {
    body = await request.json<ChangePasswordBody>()
  } catch {
    return Response.json(
      { error: "Invalid JSON" },
      { status: 400 },
    )
  }

  if (
    typeof body.current_password !== "string" ||
    body.current_password === ""
  ) {
    return Response.json(
      { error: "current_password is required" },
      { status: 400 },
    )
  }

  if (
    typeof body.new_password !== "string" ||
    body.new_password === ""
  ) {
    return Response.json(
      { error: "new_password is required" },
      { status: 400 },
    )
  }

  if (
    typeof body.new_password_confirmation !== "string" ||
    body.new_password_confirmation === ""
  ) {
    return Response.json(
      { error: "new_password_confirmation is required" },
      { status: 400 },
    )
  }

  if (
    body.new_password !== body.new_password_confirmation
  ) {
    return Response.json(
      { error: "New passwords do not match" },
      { status: 400 },
    )
  }

  if (body.new_password.length < 8) {
    return Response.json(
      { error: "new_password must be at least 8 characters" },
      { status: 400 },
    )
  }

  if (body.current_password === body.new_password) {
    return Response.json(
      { error: "New password must be different from current password" },
      { status: 400 },
    )
  }

  const user = await env.DB
    .prepare(`
      SELECT
        id,
        password_hash
      FROM users
      WHERE id = ?
    `)
    .bind(sessionUser.id)
    .first<{
      id: string
      password_hash: string | null
    }>()

  if (!user || !user.password_hash) {
    return Response.json(
      { error: "Password is not set" },
      { status: 400 },
    )
  }

  const isCurrentPasswordValid = await verifyPassword(
    body.current_password,
    user.password_hash,
  )

  if (!isCurrentPasswordValid) {
    return Response.json(
      { error: "Current password is incorrect" },
      { status: 400 },
    )
  }

  const newPasswordHash = await hashPassword(
    body.new_password,
  )

  await env.DB
    .prepare(`
      UPDATE users
      SET
        password_hash = ?,
        password_changed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(newPasswordHash, user.id)
    .run()

  await deleteOtherSessions(
    env,
    user.id,
    sessionId,
  )

  return Response.json({
    message: "Password changed successfully",
  })
}


export async function handleAdminSetPassword(
  request: Request,
  env: Env,
  userId: string,
): Promise<Response> {
  const auth = await requireAccountRole(request, env, "admin")
  if (auth instanceof Response) {
    return auth
  }

  const body = await request.json<{
    password?: unknown
  }>()

  if (
    typeof body.password !== "string" ||
    body.password.length < 8
  ) {
    return Response.json(
      {
        error: "パスワードは8文字以上で入力してください",
      },
      { status: 400 },
    )
  }

  const user = await env.DB
    .prepare(
      `
        SELECT id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
    )
    .bind(userId)
    .first<{ id: string }>()

  if (!user) {
    return Response.json(
      { error: "User not found" },
      { status: 404 },
    )
  }

  const passwordHash = await hashPassword(body.password)

  await env.DB
    .prepare(
      `
        UPDATE users
        SET password_hash = ?,
            password_changed_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
    .bind(passwordHash, userId)
    .run()

  await env.DB
    .prepare(
      `
        DELETE FROM sessions
        WHERE user_id = ?
      `,
    )
    .bind(userId)
    .run()

  return Response.json({
    message: "Password updated",
  })
}
