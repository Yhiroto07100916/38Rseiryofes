import { getSessionId, getSessionUser, type SessionUser } from "./session"

export interface AuthContext {
  user: SessionUser
  sessionId: string
}

export async function requireAuth(
  request: Request,
  env: Env,
): Promise<AuthContext | Response> {
  const sessionId = getSessionId(request)

  if (!sessionId) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    )
  }

  const user = await getSessionUser(request, env)

  if (!user) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 },
    )
  }

  return {
    user,
    sessionId,
  }
}

export async function requireAccountRole(
  request: Request,
  env: Env,
  roleName: string,
): Promise<AuthContext | Response> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  const role = await env.DB
    .prepare(`
      SELECT 1
      FROM user_account_roles uar
      INNER JOIN account_roles ar
        ON ar.id = uar.account_role_id
      WHERE uar.user_id = ?
        AND ar.name = ?
      LIMIT 1
    `)
    .bind(auth.user.id, roleName)
    .first<{ 1: number }>()

  if (!role) {
    return Response.json(
      { error: "Forbidden" },
      { status: 403 },
    )
  }

  return auth
}
