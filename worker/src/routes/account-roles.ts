import { requireAccountRole } from "../lib/authz"

export interface AccountRole {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
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

async function requireAdmin(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const auth = await requireAccountRole(
    request,
    env,
    "admin",
  )

  if (auth instanceof Response) {
    return auth
  }

  return null
}

export async function handleAccountRoles(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const authError = await requireAdmin(request, env)

  if (authError) {
    return authError
  }

  if (request.method === "GET") {
    if (pathParts.length === 0) {
      const result = await env.DB
        .prepare(`
          SELECT
            id,
            name,
            description,
            created_at,
            updated_at
          FROM account_roles
          ORDER BY name ASC
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
  const authError = await requireAdmin(request, env)

  if (authError) {
    return authError
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
        SELECT id
        FROM account_roles
        WHERE id = ?
      `)
      .bind(body.account_role_id)
      .first<{ id: string }>()

    if (!accountRole) {
      return Response.json(
        { error: "Account role not found" },
        { status: 404 },
      )
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

    await env.DB
      .prepare(`
        DELETE FROM user_account_roles
        WHERE user_id = ?
          AND account_role_id = ?
      `)
      .bind(userId, accountRoleId)
      .run()

    return new Response(null, { status: 204 })
  }

  return Response.json(
    { error: "Not Found" },
    { status: 404 },
  )
}
