import { requireAccountRole } from "../lib/authz"

type PermissionEffect = "allow" | "deny"

interface Permission {
  id: string
  key: string
  name: string
  description: string | null
  category: string
}

interface Assignment {
  permission_id: string
  effect: PermissionEffect
}

async function requireAdmin(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const auth = await requireAccountRole(request, env, "admin")

  if (auth instanceof Response) {
    return auth
  }

  return null
}

function isEffect(value: unknown): value is PermissionEffect {
  return value === "allow" || value === "deny"
}

async function getPermissions(env: Env) {
  const result = await env.DB
    .prepare(`
      SELECT
        id,
        key,
        name,
        description,
        category
      FROM permissions
      ORDER BY category, key
    `)
    .all<Permission>()

  return result.results
}

export async function handlePermissions(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const authError = await requireAdmin(request, env)

  if (authError) {
    return authError
  }

  if (request.method === "GET" && pathParts.length === 0) {
    const permissions = await getPermissions(env)

    return Response.json({
      permissions,
    })
  }

  if (
    request.method === "GET" &&
    pathParts.length === 1 &&
    pathParts[0] === "users"
  ) {
    const result = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          nickname,
          student_number AS user_id
        FROM users
        ORDER BY
          COALESCE(NULLIF(nickname, ''), NULLIF(name, ''), student_number),
          student_number
      `)
      .all<{
        id: string
        name: string | null
        nickname: string | null
        user_id: string
      }>()

    return Response.json({
      users: result.results,
    })
  }

  if (
    request.method === "GET" &&
    pathParts.length === 2 &&
    ["account-roles", "roles", "users"].includes(pathParts[0])
  ) {
    const targetType = pathParts[0]
    const targetId = pathParts[1]

    let result

    if (targetType === "account-roles") {
      result = await env.DB
        .prepare(`
          SELECT
            permission_id,
            effect
          FROM account_role_permissions
          WHERE account_role_id = ?
        `)
        .bind(targetId)
        .all<Assignment>()
    } else if (targetType === "roles") {
      result = await env.DB
        .prepare(`
          SELECT
            permission_id,
            effect
          FROM role_permissions
          WHERE role_id = ?
        `)
        .bind(targetId)
        .all<Assignment>()
    } else {
      result = await env.DB
        .prepare(`
          SELECT
            permission_id,
            effect
          FROM user_permissions
          WHERE user_id = ?
        `)
        .bind(targetId)
        .all<Assignment>()
    }

    return Response.json({
      assignments: result.results,
    })
  }

  if (
    (request.method === "PUT" || request.method === "DELETE") &&
    pathParts.length === 3 &&
    ["account-roles", "roles", "users"].includes(pathParts[0])
  ) {
    const targetType = pathParts[0]
    const targetId = pathParts[1]
    const permissionId = pathParts[2]

    const permission = await env.DB
      .prepare(`
        SELECT id
        FROM permissions
        WHERE id = ?
      `)
      .bind(permissionId)
      .first<{ id: string }>()

    if (!permission) {
      return Response.json(
        { error: "Permission not found" },
        { status: 404 },
      )
    }

    if (request.method === "DELETE") {
      if (targetType === "account-roles") {
        await env.DB
          .prepare(`
            DELETE FROM account_role_permissions
            WHERE account_role_id = ?
              AND permission_id = ?
          `)
          .bind(targetId, permissionId)
          .run()
      } else if (targetType === "roles") {
        await env.DB
          .prepare(`
            DELETE FROM role_permissions
            WHERE role_id = ?
              AND permission_id = ?
          `)
          .bind(targetId, permissionId)
          .run()
      } else {
        await env.DB
          .prepare(`
            DELETE FROM user_permissions
            WHERE user_id = ?
              AND permission_id = ?
          `)
          .bind(targetId, permissionId)
          .run()
      }

      return new Response(null, { status: 204 })
    }

    let body: { effect?: unknown }

    try {
      body = await request.json<{ effect?: unknown }>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    if (!isEffect(body.effect)) {
      return Response.json(
        { error: "effect must be allow or deny" },
        { status: 400 },
      )
    }

    if (targetType === "account-roles") {
      await env.DB
        .prepare(`
          INSERT INTO account_role_permissions (
            account_role_id,
            permission_id,
            effect
          )
          VALUES (?, ?, ?)
          ON CONFLICT(account_role_id, permission_id)
          DO UPDATE SET effect = excluded.effect
        `)
        .bind(targetId, permissionId, body.effect)
        .run()
    } else if (targetType === "roles") {
      await env.DB
        .prepare(`
          INSERT INTO role_permissions (
            role_id,
            permission_id,
            effect
          )
          VALUES (?, ?, ?)
          ON CONFLICT(role_id, permission_id)
          DO UPDATE SET effect = excluded.effect
        `)
        .bind(targetId, permissionId, body.effect)
        .run()
    } else {
      await env.DB
        .prepare(`
          INSERT INTO user_permissions (
            user_id,
            permission_id,
            effect
          )
          VALUES (?, ?, ?)
          ON CONFLICT(user_id, permission_id)
          DO UPDATE SET effect = excluded.effect
        `)
        .bind(targetId, permissionId, body.effect)
        .run()
    }

    return Response.json({
      permission_id: permissionId,
      effect: body.effect,
    })
  }

  return Response.json(
    { error: "Not Found" },
    { status: 404 },
  )
}
