import { requireAccountRole } from "../lib/authz"

export interface Role {
  id: string
  name: string
  description: string | null
  created_at: string
}

interface CreateRoleBody {
  name?: unknown
  description?: unknown
}

interface UpdateRoleBody {
  name?: unknown
  description?: unknown
}

function generateId(): string {
  return crypto.randomUUID()
}

export async function handleRoles(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {

  const auth = await requireAccountRole(
    request,
    env,
    "admin",
  )

  if (auth instanceof Response) {
    return auth
  }

  if (request.method === "GET") {
    if (pathParts.length === 0) {
      const result = await env.DB
        .prepare(`
          SELECT
            id,
            name,
            description,
            created_at
          FROM roles
          ORDER BY name
        `)
        .all<Role>()

      return Response.json({
        roles: result.results,
      })
    }

    if (pathParts.length === 1) {
      const id = pathParts[0]

      const role = await env.DB
        .prepare(`
          SELECT
            id,
            name,
            description,
            created_at
          FROM roles
          WHERE id = ?
        `)
        .bind(id)
        .first<Role>()

      if (!role) {
        return Response.json(
          { error: "Role not found" },
          { status: 404 },
        )
      }

      return Response.json(role)
    }
  }

  if (request.method === "POST" && pathParts.length === 0) {
    let body: CreateRoleBody

    try {
      body = await request.json<CreateRoleBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    if (
      typeof body.name !== "string" ||
      body.name.trim() === ""
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

    const id = generateId()
    const name = body.name.trim()
    const description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null

    try {
      await env.DB
        .prepare(`
          INSERT INTO roles (
            id,
            name,
            description
          )
          VALUES (?, ?, ?)
        `)
        .bind(id, name, description)
        .run()
    } catch (error) {
      console.error("Failed to create role:", error)

      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed: roles.name")
      ) {
        return Response.json(
          { error: "name already exists" },
          { status: 409 },
        )
      }

      return Response.json(
        { error: "Failed to create role" },
        { status: 500 },
      )
    }

    const role = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          description,
          created_at
        FROM roles
        WHERE id = ?
      `)
      .bind(id)
      .first<Role>()

    return Response.json(role, { status: 201 })
  }

  if (request.method === "PATCH" && pathParts.length === 1) {
    const id = pathParts[0]

    let body: UpdateRoleBody

    try {
      body = await request.json<UpdateRoleBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    const existingRole = await env.DB
      .prepare("SELECT id FROM roles WHERE id = ?")
      .bind(id)
      .first<{ id: string }>()

    if (!existingRole) {
      return Response.json(
        { error: "Role not found" },
        { status: 404 },
      )
    }

    const updates: string[] = []
    const values: (string | null)[] = []

    if (body.name !== undefined) {
      if (
        typeof body.name !== "string" ||
        body.name.trim() === ""
      ) {
        return Response.json(
          { error: "name must be a non-empty string" },
          { status: 400 },
        )
      }

      updates.push("name = ?")
      values.push(body.name.trim())
    }

    if (body.description !== undefined) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        return Response.json(
          { error: "description must be a string or null" },
          { status: 400 },
        )
      }

      updates.push("description = ?")
      values.push(
        typeof body.description === "string"
          ? body.description.trim() || null
          : null,
      )
    }

    if (updates.length === 0) {
      return Response.json(
        { error: "No fields to update" },
        { status: 400 },
      )
    }

    try {
      await env.DB
        .prepare(`
          UPDATE roles
          SET ${updates.join(", ")}
          WHERE id = ?
        `)
        .bind(...values, id)
        .run()
    } catch (error) {
      console.error("Failed to update role:", error)

      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed: roles.name")
      ) {
        return Response.json(
          { error: "name already exists" },
          { status: 409 },
        )
      }

      return Response.json(
        { error: "Failed to update role" },
        { status: 500 },
      )
    }

    const role = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          description,
          created_at
        FROM roles
        WHERE id = ?
      `)
      .bind(id)
      .first<Role>()

    return Response.json(role)
  }

  if (request.method === "DELETE" && pathParts.length === 1) {
    const id = pathParts[0]

    const existingRole = await env.DB
      .prepare("SELECT id FROM roles WHERE id = ?")
      .bind(id)
      .first<{ id: string }>()

    if (!existingRole) {
      return Response.json(
        { error: "Role not found" },
        { status: 404 },
      )
    }

    try {
      await env.DB
        .prepare("DELETE FROM roles WHERE id = ?")
        .bind(id)
        .run()
    } catch (error) {
      console.error("Failed to delete role:", error)

      return Response.json(
        { error: "Failed to delete role" },
        { status: 500 },
      )
    }

    return new Response(null, { status: 204 })
  }

  return Response.json(
    { error: "Method Not Allowed" },
    { status: 405 },
  )
}

export async function handleUserRoles(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  if (pathParts.length !== 1) {
    return Response.json(
      { error: "Not Found" },
      { status: 404 },
    )
  }

  const userId = pathParts[0]

  const user = await env.DB
    .prepare("SELECT id FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string }>()

  if (!user) {
    return Response.json(
      { error: "User not found" },
      { status: 404 },
    )
  }

  if (request.method === "GET") {
    const result = await env.DB
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
      .all<Role>()

    return Response.json({
      roles: result.results,
    })
  }

  if (request.method === "POST") {
    let body: { role_id?: unknown }

    try {
      body = await request.json()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    if (
      typeof body.role_id !== "string" ||
      body.role_id.trim() === ""
    ) {
      return Response.json(
        { error: "role_id is required" },
        { status: 400 },
      )
    }

    const roleId = body.role_id.trim()

    const role = await env.DB
      .prepare("SELECT id FROM roles WHERE id = ?")
      .bind(roleId)
      .first<{ id: string }>()

    if (!role) {
      return Response.json(
        { error: "Role not found" },
        { status: 404 },
      )
    }

    try {
      await env.DB
        .prepare(`
          INSERT INTO user_roles (
            user_id,
            role_id
          )
          VALUES (?, ?)
        `)
        .bind(userId, roleId)
        .run()
    } catch (error) {
      console.error("Failed to assign role:", error)

      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed: user_roles")
      ) {
        return Response.json(
          { error: "Role already assigned to user" },
          { status: 409 },
        )
      }

      return Response.json(
        { error: "Failed to assign role" },
        { status: 500 },
      )
    }

    const assignedRole = await env.DB
      .prepare(`
        SELECT
          r.id,
          r.name,
          r.description,
          r.created_at
        FROM roles r
        WHERE r.id = ?
      `)
      .bind(roleId)
      .first<Role>()

    return Response.json(assignedRole, { status: 201 })
  }

  return Response.json(
    { error: "Method Not Allowed" },
    { status: 405 },
  )
}

export async function handleUserRole(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  if (pathParts.length !== 2) {
    return Response.json(
      { error: "Not Found" },
      { status: 404 },
    )
  }

  const userId = pathParts[0]
  const roleId = pathParts[1]

  if (request.method !== "DELETE") {
    return Response.json(
      { error: "Method Not Allowed" },
      { status: 405 },
    )
  }

  const result = await env.DB
    .prepare(`
      DELETE FROM user_roles
      WHERE user_id = ?
        AND role_id = ?
    `)
    .bind(userId, roleId)
    .run()

  if (result.meta.changes === 0) {
    return Response.json(
      { error: "User role assignment not found" },
      { status: 404 },
    )
  }

  return new Response(null, { status: 204 })
}
