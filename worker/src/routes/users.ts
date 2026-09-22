export interface User {
  id: string
  student_number: string
  name: string
  nickname: string | null
  created_at: string
  updated_at: string
}

interface CreateUserBody {
  student_number?: unknown
  name?: unknown
  nickname?: unknown
}

function generateId(): string {
  return crypto.randomUUID()
}

export async function handleUsers(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  if (request.method === "GET") {
    if (pathParts.length === 0) {
      const result = await env.DB
        .prepare(`
          SELECT
            id,
            student_number,
            name,
            nickname,
            created_at,
            updated_at
          FROM users
          ORDER BY student_number
        `)
        .all<User>()

      return Response.json({
        users: result.results,
      })
    }

    if (pathParts.length === 1) {
      const id = pathParts[0]

      const user = await env.DB
        .prepare(`
          SELECT
            id,
            student_number,
            name,
            nickname,
            created_at,
            updated_at
          FROM users
          WHERE id = ?
        `)
        .bind(id)
        .first<User>()

      if (!user) {
        return Response.json(
          { error: "User not found" },
          { status: 404 },
        )
      }

      return Response.json(user)
    }
  }

  if (request.method === "POST" && pathParts.length === 0) {
    let body: CreateUserBody

    try {
      body = await request.json<CreateUserBody>()
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
      typeof body.name !== "string" ||
      body.name.trim() === ""
    ) {
      return Response.json(
        { error: "name is required" },
        { status: 400 },
      )
    }

    if (
      body.nickname !== undefined &&
      body.nickname !== null &&
      typeof body.nickname !== "string"
    ) {
      return Response.json(
        { error: "nickname must be a string or null" },
        { status: 400 },
      )
    }

    const id = generateId()
    const studentNumber = body.student_number.trim()
    const name = body.name.trim()
    const nickname =
      typeof body.nickname === "string"
        ? body.nickname.trim() || null
        : null

    try {
      await env.DB
        .prepare(`
          INSERT INTO users (
            id,
            student_number,
            name,
            nickname
          )
          VALUES (?, ?, ?, ?)
        `)
        .bind(id, studentNumber, name, nickname)
        .run()
    } catch (error) {
      console.error("Failed to create user:", error)

      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed: users.student_number")
      ) {
        return Response.json(
          { error: "student_number already exists" },
          { status: 409 },
        )
      }

      return Response.json(
        { error: "Failed to create user" },
        { status: 500 },
      )
    }

    const user = await env.DB
      .prepare(`
        SELECT
          id,
          student_number,
          name,
          nickname,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
      `)
      .bind(id)
      .first<User>()

    return Response.json(user, { status: 201 })
  }

  if (request.method === "PATCH" && pathParts.length === 1) {
    const id = pathParts[0]
  
    let body: {
      student_number?: unknown
      name?: unknown
      nickname?: unknown
    }
  
    try {
      body = await request.json()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }
  
    const existingUser = await env.DB
      .prepare("SELECT id FROM users WHERE id = ?")
      .bind(id)
      .first<{ id: string }>()
  
    if (!existingUser) {
      return Response.json(
        { error: "User not found" },
        { status: 404 },
      )
    }
  
    const updates: string[] = []
    const values: (string | null)[] = []
  
    if (body.student_number !== undefined) {
      if (
        typeof body.student_number !== "string" ||
        body.student_number.trim() === ""
      ) {
        return Response.json(
          { error: "student_number must be a non-empty string" },
          { status: 400 },
        )
      }
  
      updates.push("student_number = ?")
      values.push(body.student_number.trim())
    }
  
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
  
    if (body.nickname !== undefined) {
      if (
        body.nickname !== null &&
        typeof body.nickname !== "string"
      ) {
        return Response.json(
          { error: "nickname must be a string or null" },
          { status: 400 },
        )
      }
  
      updates.push("nickname = ?")
      values.push(
        typeof body.nickname === "string"
          ? body.nickname.trim() || null
          : null,
      )
    }
  
    if (updates.length === 0) {
      return Response.json(
        { error: "No fields to update" },
        { status: 400 },
      )
    }
  
    updates.push("updated_at = CURRENT_TIMESTAMP")
  
    try {
      await env.DB
        .prepare(`
          UPDATE users
          SET ${updates.join(", ")}
          WHERE id = ?
        `)
        .bind(...values, id)
        .run()
    } catch (error) {
      console.error("Failed to update user:", error)
  
      if (
        error instanceof Error &&
        error.message.includes("UNIQUE constraint failed: users.student_number")
      ) {
        return Response.json(
          { error: "student_number already exists" },
          { status: 409 },
        )
      }
  
      return Response.json(
        { error: "Failed to update user" },
        { status: 500 },
      )
    }
  
    const user = await env.DB
      .prepare(`
        SELECT
          id,
          student_number,
          name,
          nickname,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
      `)
      .bind(id)
      .first<User>()
  
    return Response.json(user)
  }

  if (request.method === "DELETE" && pathParts.length === 1) {
    const id = pathParts[0]

    const existingUser = await env.DB
      .prepare("SELECT id FROM users WHERE id = ?")
      .bind(id)
      .first<{ id: string }>()

    if (!existingUser) {
      return Response.json(
        { error: "User not found" },
        { status: 404 },
      )
    }

    try {
      await env.DB
        .prepare("DELETE FROM users WHERE id = ?")
        .bind(id)
        .run()
    } catch (error) {
      console.error("Failed to delete user:", error)

      return Response.json(
        { error: "Failed to delete user" },
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
