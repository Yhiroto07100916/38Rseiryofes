const SESSION_COOKIE_NAME = "session_id"
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export interface SessionUser {
  id: string
  student_number: string
  name: string
  nickname: string | null
}

function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("Cookie")

  if (!header) {
    return {}
  }

  const cookies: Record<string, string> = {}

  for (const part of header.split(";")) {
    const index = part.indexOf("=")

    if (index === -1) {
      continue
    }

    const name = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()

    if (name) {
      cookies[name] = decodeURIComponent(value)
    }
  }

  return cookies
}

export function getSessionId(request: Request): string | null {
  return parseCookies(request)[SESSION_COOKIE_NAME] ?? null
}

export async function createSession(
  env: Env,
  userId: string,
): Promise<string> {
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_MS,
  ).toISOString()

  await env.DB
    .prepare(`
      INSERT INTO sessions (
        id,
        user_id,
        expires_at
      )
      VALUES (?, ?, ?)
    `)
    .bind(sessionId, userId, expiresAt)
    .run()

  return sessionId
}

export function createSessionCookie(
  sessionId: string,
): string {
  const maxAge = Math.floor(
    SESSION_DURATION_MS / 1000,
  )

  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${maxAge}`,
  ].join("; ")
}

export function createExpiredSessionCookie(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ].join("; ")
}

export async function getSessionUser(
  request: Request,
  env: Env,
): Promise<SessionUser | null> {
  const sessionId = getSessionId(request)

  if (!sessionId) {
    return null
  }

  const session = await env.DB
    .prepare(`
      SELECT
        s.id,
        s.user_id,
        s.expires_at
      FROM sessions s
      WHERE s.id = ?
    `)
    .bind(sessionId)
    .first<{
      id: string
      user_id: string
      expires_at: string
    }>()

  if (!session) {
    return null
  }

  const expiresAt = new Date(session.expires_at).getTime()

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await env.DB
      .prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId)
      .run()

    return null
  }

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
    .bind(session.user_id)
    .first<SessionUser>()

  return user ?? null
}

export async function deleteSession(
  request: Request,
  env: Env,
): Promise<void> {
  const sessionId = getSessionId(request)

  if (!sessionId) {
    return
  }

  await env.DB
    .prepare("DELETE FROM sessions WHERE id = ?")
    .bind(sessionId)
    .run()
}


export async function deleteOtherSessions(
  env: Env,
  userId: string,
  currentSessionId: string,
): Promise<void> {
  await env.DB
    .prepare(`
      DELETE FROM sessions
      WHERE user_id = ?
        AND id != ?
    `)
    .bind(userId, currentSessionId)
    .run()
}
