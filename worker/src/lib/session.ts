type SessionEnv = Pick<Env, "DB">

const SESSION_COOKIE_NAME = "session_id"
const DEFAULT_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const PRODUCTION_COOKIE_DOMAIN = ".38r-seiryofes.com"

export interface SessionUser {
  id: string
  student_number: string
  name: string
  nickname: string | null
  avatar_key: string | null
  password_changed_at: string | null
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
      try {
        cookies[name] = decodeURIComponent(value)
      } catch {
        // Ignore malformed cookie values rather than failing the whole request.
        continue
      }
    }
  }

  return cookies
}

export function getSessionId(request: Request): string | null {
  return parseCookies(request)[SESSION_COOKIE_NAME] ?? null
}

export function getSessionCookieDomain(request: Request): string | undefined {
  const hostname = new URL(request.url).hostname.toLowerCase()

  if (hostname === "api.38r-seiryofes.com") {
    return PRODUCTION_COOKIE_DOMAIN
  }

  return undefined
}

export async function createSession(
  env: SessionEnv,
  userId: string,
  durationMs = DEFAULT_SESSION_DURATION_MS,
): Promise<string> {
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(
    Date.now() + durationMs,
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
  secure: boolean,
  domain?: string,
  durationMs = DEFAULT_SESSION_DURATION_MS,
): string {
  const maxAge = Math.floor(
    durationMs / 1000,
  )

  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    "Path=/",
    ...(domain ? [`Domain=${domain}`] : []),
    `Max-Age=${maxAge}`,
  ].join("; ")
}

export function createExpiredSessionCookie(
  secure: boolean,
  domain?: string,
): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    ...(secure ? ["Secure"] : []),
    "SameSite=Lax",
    "Path=/",
    ...(domain ? [`Domain=${domain}`] : []),
    "Max-Age=0",
  ].join("; ")
}

export function createLoginSessionHeaders(
  sessionId: string,
  secure: boolean,
  domain?: string,
  durationMs = DEFAULT_SESSION_DURATION_MS,
): Headers {
  const headers = new Headers()
  headers.append("Set-Cookie", createExpiredSessionCookie(secure))
  headers.append(
    "Set-Cookie",
    createSessionCookie(sessionId, secure, domain, durationMs),
  )
  return headers
}

export function createLogoutSessionHeaders(
  secure: boolean,
  domain?: string,
): Headers {
  const headers = new Headers()
  headers.append("Set-Cookie", createExpiredSessionCookie(secure))
  headers.append(
    "Set-Cookie",
    createExpiredSessionCookie(secure, domain),
  )
  return headers
}

const sessionUserCache = new WeakMap<Request, Promise<SessionUser | null>>()

export function getSessionUser(
  request: Request,
  env: SessionEnv,
): Promise<SessionUser | null> {
  const cached = sessionUserCache.get(request)
  if (cached) return cached

  const pending = loadSessionUser(request, env)
  sessionUserCache.set(request, pending)
  return pending
}

async function loadSessionUser(
  request: Request,
  env: SessionEnv,
): Promise<SessionUser | null> {
  const sessionId = getSessionId(request)

  if (!sessionId) {
    return null
  }

  const session = await env.DB
    .prepare(`
      SELECT
        s.expires_at,
        u.id,
        u.student_number,
        u.name,
        u.nickname,
        u.avatar_key,
        u.password_changed_at
      FROM sessions s
      INNER JOIN users u
        ON u.id = s.user_id
      WHERE s.id = ?
      LIMIT 1
    `)
    .bind(sessionId)
    .first<SessionUser & { expires_at: string }>()

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

  const { expires_at: _expiresAt, ...user } = session
  return user
}

export async function deleteSession(
  request: Request,
  env: SessionEnv,
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
  env: SessionEnv,
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
