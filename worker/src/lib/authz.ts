import { getSessionId, getSessionUser, type SessionUser } from "./session"

export interface AuthContext {
  user: SessionUser
  sessionId: string
}

type PermissionEffect = "allow" | "deny"

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

async function isAdmin(
  env: Env,
  userId: string,
): Promise<boolean> {
  const result = await env.DB
    .prepare(`
      SELECT 1
      FROM user_account_roles uar
      INNER JOIN account_roles ar
        ON ar.id = uar.account_role_id
      WHERE uar.user_id = ?
        AND ar.name = 'admin'
      LIMIT 1
    `)
    .bind(userId)
    .first<{ 1: number }>()

  return Boolean(result)
}

async function getPermissionEffect(
  env: Env,
  userId: string,
  permissionKey: string,
): Promise<PermissionEffect | null> {
  const result = await env.DB
    .prepare(`
      SELECT effect
      FROM user_permissions up
      INNER JOIN permissions p
        ON p.id = up.permission_id
      WHERE up.user_id = ?
        AND p.key = ?
      LIMIT 1
    `)
    .bind(userId, permissionKey)
    .first<{ effect: PermissionEffect }>()

  if (result) {
    return result.effect
  }

  const roleResult = await env.DB
    .prepare(`
      SELECT
        CASE
          WHEN MAX(CASE WHEN rp.effect = 'deny' THEN 1 ELSE 0 END) = 1
            THEN 'deny'
          WHEN MAX(CASE WHEN rp.effect = 'allow' THEN 1 ELSE 0 END) = 1
            THEN 'allow'
          ELSE NULL
        END AS effect
      FROM user_roles ur
      INNER JOIN role_permissions rp
        ON rp.role_id = ur.role_id
      INNER JOIN permissions p
        ON p.id = rp.permission_id
      WHERE ur.user_id = ?
        AND p.key = ?
    `)
    .bind(userId, permissionKey)
    .first<{ effect: PermissionEffect | null }>()

  if (roleResult?.effect) {
    return roleResult.effect
  }

  const accountRoleResult = await env.DB
    .prepare(`
      SELECT
        CASE
          WHEN MAX(CASE WHEN arp.effect = 'deny' THEN 1 ELSE 0 END) = 1
            THEN 'deny'
          WHEN MAX(CASE WHEN arp.effect = 'allow' THEN 1 ELSE 0 END) = 1
            THEN 'allow'
          ELSE NULL
        END AS effect
      FROM user_account_roles uar
      INNER JOIN account_role_permissions arp
        ON arp.account_role_id = uar.account_role_id
      INNER JOIN permissions p
        ON p.id = arp.permission_id
      WHERE uar.user_id = ?
        AND p.key = ?
    `)
    .bind(userId, permissionKey)
    .first<{ effect: PermissionEffect | null }>()

  return accountRoleResult?.effect ?? null
}

export async function hasPermission(
  env: Env,
  userId: string,
  permissionKey: string,
): Promise<boolean> {
  if (await isAdmin(env, userId)) {
    return true
  }

  const effect = await getPermissionEffect(
    env,
    userId,
    permissionKey,
  )

  return effect === "allow"
}

export async function requirePermission(
  request: Request,
  env: Env,
  permissionKey: string,
): Promise<AuthContext | Response> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  const allowed = await hasPermission(
    env,
    auth.user.id,
    permissionKey,
  )

  if (!allowed) {
    return Response.json(
      {
        error: "Forbidden",
        permission: permissionKey,
      },
      { status: 403 },
    )
  }

  return auth
}
