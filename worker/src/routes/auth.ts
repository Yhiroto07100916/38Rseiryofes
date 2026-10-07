import {
  getUserPermissions,
  requireAccountRole,
} from "../lib/authz"
import { hashPassword, verifyPassword } from "../lib/password"
import {
  createExpiredSessionCookie,
  createSession,
  createSessionCookie,
  deleteOtherSessions,
  deleteSession,
  getSessionId,
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

  const user = await env.DB
    .prepare(`
      SELECT
        id,
        student_number,
        name,
        nickname,
        password_hash
      FROM users
      WHERE student_number = ?
    `)
    .bind(studentNumber)
    .first<{
      id: string
      student_number: string
      name: string
      nickname: string | null
      password_hash: string | null
    }>()

  if (
    !user ||
    !user.password_hash ||
    !(await verifyPassword(body.password, user.password_hash))
  ) {
    return Response.json(
      { error: "Invalid student number or password" },
      { status: 401 },
    )
  }

  const sessionId = await createSession(
    env,
    user.id,
  )

  const permissions = await getUserPermissions(
    env,
    user.id,
  )

  const secure = new URL(request.url).protocol === "https:"

  return Response.json(
    {
      user: {
        id: user.id,
        student_number: user.student_number,
        name: user.name,
        nickname: user.nickname,
      },
      permissions,
    },
    {
      headers: {
        "Set-Cookie": createSessionCookie(
          sessionId,
          secure,
        ),
      },
    },
  )
}

async function handleLogout(
  request: Request,
  env: Env,
): Promise<Response> {
  await deleteSession(request, env)

  const secure = new URL(request.url).protocol === "https:"

  return Response.json(
    { message: "Logged out" },
    {
      headers: {
        "Set-Cookie": createExpiredSessionCookie(
          secure,
        ),
      },
    },
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

  const permissions = await getUserPermissions(
    env,
    user.id,
  )

  const roles = await env.DB
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
    .bind(user.id)
    .all<{
      id: string
      name: string
      description: string | null
      created_at: string
    }>()

  const accountRoles = await env.DB
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
    .bind(user.id)
    .all<{
      id: string
      name: string
      description: string | null
      created_at: string
    }>()

  return Response.json({
    user,
    permissions,
    roles: roles.results,
    account_roles: accountRoles.results,
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
        nickname
      FROM users
      WHERE id = ?
    `)
    .bind(sessionUser.id)
    .first<{
      id: string
      student_number: string
      name: string
      nickname: string | null
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
