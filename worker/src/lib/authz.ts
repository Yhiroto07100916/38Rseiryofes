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

export async function getUserPermissions(
  env: Env,
  userId: string,
): Promise<string[]> {
  if (await isAdmin(env, userId)) {
    const result = await env.DB
      .prepare(`
        SELECT key
        FROM permissions
        ORDER BY key
      `)
      .all<{ key: string }>()

    return result.results.map((row) => row.key)
  }

  const result = await env.DB
    .prepare(`
      SELECT
        p.key,
        CASE
          WHEN MAX(
            CASE
              WHEN up.effect = 'deny' THEN 3
              WHEN up.effect = 'allow' THEN 2
              ELSE 0
            END
          ) = 3 THEN 'deny'

          WHEN MAX(
            CASE
              WHEN up.effect = 'allow' THEN 2
              ELSE 0
            END
          ) = 2 THEN 'allow'

          ELSE NULL
        END AS user_effect,

        CASE
          WHEN MAX(
            CASE
              WHEN rp.effect = 'deny' THEN 3
              WHEN rp.effect = 'allow' THEN 2
              ELSE 0
            END
          ) = 3 THEN 'deny'

          WHEN MAX(
            CASE
              WHEN rp.effect = 'allow' THEN 2
              ELSE 0
            END
          ) = 2 THEN 'allow'

          ELSE NULL
        END AS role_effect,

        CASE
          WHEN MAX(
            CASE
              WHEN arp.effect = 'deny' THEN 3
              WHEN arp.effect = 'allow' THEN 2
              ELSE 0
            END
          ) = 3 THEN 'deny'

          WHEN MAX(
            CASE
              WHEN arp.effect = 'allow' THEN 2
              ELSE 0
            END
          ) = 2 THEN 'allow'

          ELSE NULL
        END AS account_role_effect

      FROM permissions p

      LEFT JOIN user_permissions up
        ON up.permission_id = p.id
        AND up.user_id = ?

      LEFT JOIN role_permissions rp
        ON rp.permission_id = p.id
        AND rp.role_id IN (
          SELECT role_id
          FROM user_roles
          WHERE user_id = ?
        )

      LEFT JOIN account_role_permissions arp
        ON arp.permission_id = p.id
        AND arp.account_role_id IN (
          SELECT account_role_id
          FROM user_account_roles
          WHERE user_id = ?
        )

      GROUP BY p.id, p.key
      ORDER BY p.key
    `)
    .bind(userId, userId, userId)
    .all<{
      key: string
      user_effect: PermissionEffect | null
      role_effect: PermissionEffect | null
      account_role_effect: PermissionEffect | null
    }>()

  return result.results
    .filter((row) => {
      if (row.user_effect) {
        return row.user_effect === "allow"
      }

      if (row.role_effect) {
        return row.role_effect === "allow"
      }

      if (row.account_role_effect) {
        return row.account_role_effect === "allow"
      }

      return false
    })
    .map((row) => row.key)
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
