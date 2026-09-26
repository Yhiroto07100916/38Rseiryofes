import { hasPermission, requireAuth } from "../lib/authz"

export interface Task {
  id: string
  title: string
  description: string | null
  scope: "class_representative" | "class"
  status: "todo" | "in_progress" | "review" | "done"
  priority: "low" | "medium" | "high" | "urgent"
  due_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface CreateTaskBody {
  title?: unknown
  description?: unknown
  scope?: unknown
  status?: unknown
  priority?: unknown
  due_at?: unknown
  assignee_user_ids?: unknown
  assignee_role_ids?: unknown
}

interface UpdateTaskBody {
  title?: unknown
  description?: unknown
  scope?: unknown
  status?: unknown
  priority?: unknown
  due_at?: unknown
  assignee_user_ids?: unknown
  assignee_role_ids?: unknown
}

const VALID_SCOPES = [
  "class_representative",
  "class",
] as const

const VALID_STATUSES = [
  "todo",
  "in_progress",
  "review",
  "done",
] as const

const VALID_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const

function generateId(): string {
  return crypto.randomUUID()
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.trim() !== "",
    )
  )
}

async function getTask(
  env: Env,
  taskId: string,
): Promise<Task | null> {
  return await env.DB
    .prepare(`
      SELECT
        id,
        title,
        description,
        scope,
        status,
        priority,
        due_at,
        created_by,
        created_at,
        updated_at
      FROM tasks
      WHERE id = ?
    `)
    .bind(taskId)
    .first<Task>()
}

async function getTaskAssignments(
  env: Env,
  taskId: string,
) {
  const assignees = await env.DB
    .prepare(`
      SELECT
        u.id,
        u.student_number,
        u.name,
        u.nickname
      FROM task_assignees ta
      INNER JOIN users u
        ON u.id = ta.user_id
      WHERE ta.task_id = ?
      ORDER BY u.student_number
    `)
    .bind(taskId)
    .all<{
      id: string
      student_number: string
      name: string
      nickname: string | null
    }>()

  const roles = await env.DB
    .prepare(`
      SELECT
        r.id,
        r.name,
        r.description
      FROM task_roles tr
      INNER JOIN roles r
        ON r.id = tr.role_id
      WHERE tr.task_id = ?
      ORDER BY r.name
    `)
    .bind(taskId)
    .all<{
      id: string
      name: string
      description: string | null
    }>()

  return {
    users: assignees.results,
    roles: roles.results,
  }
}

async function replaceAssignments(
  env: Env,
  taskId: string,
  userIds: string[],
  roleIds: string[],
): Promise<Response | null> {
  const uniqueUserIds = [...new Set(userIds)]
  const uniqueRoleIds = [...new Set(roleIds)]

  if (uniqueUserIds.length > 0) {
    const placeholders = uniqueUserIds
      .map(() => "?")
      .join(", ")

    const result = await env.DB
      .prepare(`
        SELECT id
        FROM users
        WHERE id IN (${placeholders})
      `)
      .bind(...uniqueUserIds)
      .all<{ id: string }>()

    if (result.results.length !== uniqueUserIds.length) {
      return Response.json(
        { error: "One or more users not found" },
        { status: 404 },
      )
    }
  }

  if (uniqueRoleIds.length > 0) {
    const placeholders = uniqueRoleIds
      .map(() => "?")
      .join(", ")

    const result = await env.DB
      .prepare(`
        SELECT id
        FROM roles
        WHERE id IN (${placeholders})
      `)
      .bind(...uniqueRoleIds)
      .all<{ id: string }>()

    if (result.results.length !== uniqueRoleIds.length) {
      return Response.json(
        { error: "One or more roles not found" },
        { status: 404 },
      )
    }
  }

  await env.DB
    .prepare(`
      DELETE FROM task_assignees
      WHERE task_id = ?
    `)
    .bind(taskId)
    .run()

  await env.DB
    .prepare(`
      DELETE FROM task_roles
      WHERE task_id = ?
    `)
    .bind(taskId)
    .run()

  for (const userId of uniqueUserIds) {
    await env.DB
      .prepare(`
        INSERT INTO task_assignees (
          task_id,
          user_id
        )
        VALUES (?, ?)
      `)
      .bind(taskId, userId)
      .run()
  }

  for (const roleId of uniqueRoleIds) {
    await env.DB
      .prepare(`
        INSERT INTO task_roles (
          task_id,
          role_id
        )
        VALUES (?, ?)
      `)
      .bind(taskId, roleId)
      .run()
  }

  return null
}

export async function handleTasks(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  if (request.method === "GET" && pathParts.length === 0) {
    if (!(await hasPermission(env, auth.user.id, "tasks.view"))) {
      return Response.json(
        { error: "Forbidden", permission: "tasks.view" },
        { status: 403 },
      )
    }

    const scope = new URL(request.url).searchParams.get("scope")

    if (
      scope !== null &&
      !VALID_SCOPES.includes(
        scope as typeof VALID_SCOPES[number],
      )
    ) {
      return Response.json(
        { error: "Invalid scope" },
        { status: 400 },
      )
    }

    const params: string[] = [auth.user.id]

    let query = `
      SELECT DISTINCT
        t.id,
        t.title,
        t.description,
        t.scope,
        t.status,
        t.priority,
        t.due_at,
        t.created_by,
        t.created_at,
        t.updated_at
      FROM tasks t
      LEFT JOIN task_assignees ta
        ON ta.task_id = t.id
      LEFT JOIN task_roles tr
        ON tr.task_id = t.id
      LEFT JOIN user_roles ur
        ON ur.role_id = tr.role_id
        AND ur.user_id = ?
      WHERE (
        ta.user_id = ?
        OR ur.user_id IS NOT NULL
        OR t.created_by = ?
      )
    `

    params.push(auth.user.id, auth.user.id)

    if (scope !== null) {
      query += ` AND t.scope = ?`
      params.push(scope)
    }

    query += `
      ORDER BY
        CASE t.status
          WHEN 'todo' THEN 1
          WHEN 'in_progress' THEN 2
          WHEN 'review' THEN 3
          WHEN 'done' THEN 4
          ELSE 5
        END,
        CASE
          WHEN t.due_at IS NULL THEN 1
          ELSE 0
        END,
        t.due_at ASC,
        t.created_at DESC
    `

    const result = await env.DB
      .prepare(query)
      .bind(...params)
      .all<Task>()

    const tasks = await Promise.all(
      result.results.map(async (task) => ({
        ...task,
        assignments: await getTaskAssignments(
          env,
          task.id,
        ),
      })),
    )

    return Response.json({ tasks })
  }

  if (request.method === "GET" && pathParts.length === 1) {
    if (!(await hasPermission(env, auth.user.id, "tasks.view"))) {
      return Response.json(
        { error: "Forbidden", permission: "tasks.view" },
        { status: 403 },
      )
    }

    const task = await getTask(env, pathParts[0])

    if (!task) {
      return Response.json(
        { error: "Task not found" },
        { status: 404 },
      )
    }

    const assignment = await getTaskAssignments(
      env,
      task.id,
    )

    const access = await env.DB
      .prepare(`
        SELECT 1
        FROM tasks t
        LEFT JOIN task_assignees ta
          ON ta.task_id = t.id
        LEFT JOIN task_roles tr
          ON tr.task_id = t.id
        LEFT JOIN user_roles ur
          ON ur.role_id = tr.role_id
          AND ur.user_id = ?
        WHERE t.id = ?
          AND (
            ta.user_id = ?
            OR ur.user_id IS NOT NULL
            OR t.created_by = ?
          )
        LIMIT 1
      `)
      .bind(
        auth.user.id,
        task.id,
        auth.user.id,
        auth.user.id,
      )
      .first<{ 1: number }>()

    if (!access) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403 },
      )
    }

    return Response.json({
      ...task,
      assignments: assignment,
    })
  }

  if (request.method === "POST" && pathParts.length === 0) {
    if (!(await hasPermission(env, auth.user.id, "tasks.create"))) {
      return Response.json(
        { error: "Forbidden", permission: "tasks.create" },
        { status: 403 },
      )
    }

    let body: CreateTaskBody

    try {
      body = await request.json<CreateTaskBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    if (
      typeof body.title !== "string" ||
      body.title.trim() === ""
    ) {
      return Response.json(
        { error: "title is required" },
        { status: 400 },
      )
    }

    if (
      typeof body.scope !== "string" ||
      !VALID_SCOPES.includes(
        body.scope as typeof VALID_SCOPES[number],
      )
    ) {
      return Response.json(
        { error: "Invalid scope" },
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

    if (
      body.status !== undefined &&
      (
        typeof body.status !== "string" ||
        !VALID_STATUSES.includes(
          body.status as typeof VALID_STATUSES[number],
        )
      )
    ) {
      return Response.json(
        { error: "Invalid status" },
        { status: 400 },
      )
    }

    if (
      body.priority !== undefined &&
      (
        typeof body.priority !== "string" ||
        !VALID_PRIORITIES.includes(
          body.priority as typeof VALID_PRIORITIES[number],
        )
      )
    ) {
      return Response.json(
        { error: "Invalid priority" },
        { status: 400 },
      )
    }

    if (
      body.due_at !== undefined &&
      body.due_at !== null &&
      typeof body.due_at !== "string"
    ) {
      return Response.json(
        { error: "due_at must be a string or null" },
        { status: 400 },
      )
    }

    if (
      body.assignee_user_ids !== undefined &&
      !isStringArray(body.assignee_user_ids)
    ) {
      return Response.json(
        { error: "assignee_user_ids must be an array of strings" },
        { status: 400 },
      )
    }

    if (
      body.assignee_role_ids !== undefined &&
      !isStringArray(body.assignee_role_ids)
    ) {
      return Response.json(
        { error: "assignee_role_ids must be an array of strings" },
        { status: 400 },
      )
    }

    const id = generateId()
    const title = body.title.trim()
    const description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null
    const scope = body.scope
    const status =
      typeof body.status === "string"
        ? body.status
        : "todo"
    const priority =
      typeof body.priority === "string"
        ? body.priority
        : "medium"
    const dueAt =
      typeof body.due_at === "string"
        ? body.due_at.trim() || null
        : null
    const userIds =
      body.assignee_user_ids === undefined
        ? []
        : body.assignee_user_ids
    const roleIds =
      body.assignee_role_ids === undefined
        ? []
        : body.assignee_role_ids

    try {
      await env.DB
        .prepare(`
          INSERT INTO tasks (
            id,
            title,
            description,
            scope,
            status,
            priority,
            due_at,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          id,
          title,
          description,
          scope,
          status,
          priority,
          dueAt,
          auth.user.id,
        )
        .run()

      const assignmentError = await replaceAssignments(
        env,
        id,
        userIds,
        roleIds,
      )

      if (assignmentError) {
        await env.DB
          .prepare("DELETE FROM tasks WHERE id = ?")
          .bind(id)
          .run()

        return assignmentError
      }
    } catch (error) {
      console.error("Failed to create task:", error)

      await env.DB
        .prepare("DELETE FROM tasks WHERE id = ?")
        .bind(id)
        .run()

      return Response.json(
        { error: "Failed to create task" },
        { status: 500 },
      )
    }

    const task = await getTask(env, id)

    return Response.json(
      {
        ...task,
        assignments: await getTaskAssignments(env, id),
      },
      { status: 201 },
    )
  }

  if (request.method === "PATCH" && pathParts.length === 1) {
    const id = pathParts[0]

    const existingTask = await getTask(env, id)

    if (!existingTask) {
      return Response.json(
        { error: "Task not found" },
        { status: 404 },
      )
    }

    const access = await env.DB
      .prepare(`
        SELECT 1
        FROM tasks t
        LEFT JOIN task_assignees ta
          ON ta.task_id = t.id
        LEFT JOIN task_roles tr
          ON tr.task_id = t.id
        LEFT JOIN user_roles ur
          ON ur.role_id = tr.role_id
          AND ur.user_id = ?
        WHERE t.id = ?
          AND (
            t.created_by = ?
            OR ta.user_id = ?
            OR ur.user_id IS NOT NULL
          )
        LIMIT 1
      `)
      .bind(
        auth.user.id,
        id,
        auth.user.id,
        auth.user.id,
      )
      .first<{ 1: number }>()

    if (!access) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403 },
      )
    }

    let body: UpdateTaskBody

    try {
      body = await request.json<UpdateTaskBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    if (
      body.title !== undefined &&
      (
        typeof body.title !== "string" ||
        body.title.trim() === ""
      )
    ) {
      return Response.json(
        { error: "title must be a non-empty string" },
        { status: 400 },
      )
    }

    if (
      body.scope !== undefined &&
      (
        typeof body.scope !== "string" ||
        !VALID_SCOPES.includes(
          body.scope as typeof VALID_SCOPES[number],
        )
      )
    ) {
      return Response.json(
        { error: "Invalid scope" },
        { status: 400 },
      )
    }

    if (
      body.status !== undefined &&
      (
        typeof body.status !== "string" ||
        !VALID_STATUSES.includes(
          body.status as typeof VALID_STATUSES[number],
        )
      )
    ) {
      return Response.json(
        { error: "Invalid status" },
        { status: 400 },
      )
    }

    if (
      body.priority !== undefined &&
      (
        typeof body.priority !== "string" ||
        !VALID_PRIORITIES.includes(
          body.priority as typeof VALID_PRIORITIES[number],
        )
      )
    ) {
      return Response.json(
        { error: "Invalid priority" },
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

    if (
      body.due_at !== undefined &&
      body.due_at !== null &&
      typeof body.due_at !== "string"
    ) {
      return Response.json(
        { error: "due_at must be a string or null" },
        { status: 400 },
      )
    }

    if (
      body.assignee_user_ids !== undefined &&
      !isStringArray(body.assignee_user_ids)
    ) {
      return Response.json(
        { error: "assignee_user_ids must be an array of strings" },
        { status: 400 },
      )
    }

    if (
      body.assignee_role_ids !== undefined &&
      !isStringArray(body.assignee_role_ids)
    ) {
      return Response.json(
        { error: "assignee_role_ids must be an array of strings" },
        { status: 400 },
      )
    }

    const updates: string[] = []
    const values: (string | null)[] = []

    if (body.title !== undefined) {
      updates.push("title = ?")
      values.push(body.title.trim())
    }

    if (body.description !== undefined) {
      updates.push("description = ?")
      values.push(
        typeof body.description === "string"
          ? body.description.trim() || null
          : null,
      )
    }

    if (body.scope !== undefined) {
      updates.push("scope = ?")
      values.push(body.scope)
    }

    if (body.status !== undefined) {
      updates.push("status = ?")
      values.push(body.status)
    }

    if (body.priority !== undefined) {
      updates.push("priority = ?")
      values.push(body.priority)
    }

    if (body.due_at !== undefined) {
      updates.push("due_at = ?")
      values.push(
        typeof body.due_at === "string"
          ? body.due_at.trim() || null
          : null,
      )
    }

    const hasAssignmentUpdate =
      body.assignee_user_ids !== undefined ||
      body.assignee_role_ids !== undefined

    if (updates.length > 0) {
      if (!(await hasPermission(env, auth.user.id, "tasks.edit"))) {
        return Response.json(
          { error: "Forbidden", permission: "tasks.edit" },
          { status: 403 },
        )
      }
    }

    if (hasAssignmentUpdate) {
      if (!(await hasPermission(env, auth.user.id, "tasks.assign"))) {
        return Response.json(
          { error: "Forbidden", permission: "tasks.assign" },
          { status: 403 },
        )
      }
    }

    if (
      updates.length === 0 &&
      !hasAssignmentUpdate
    ) {
      return Response.json(
        { error: "No fields to update" },
        { status: 400 },
      )
    }

    try {
      if (updates.length > 0) {
        updates.push("updated_at = CURRENT_TIMESTAMP")

        await env.DB
          .prepare(`
            UPDATE tasks
            SET ${updates.join(", ")}
            WHERE id = ?
          `)
          .bind(...values, id)
          .run()
      }

      if (hasAssignmentUpdate) {
        const currentAssignments =
          await getTaskAssignments(env, id)

        const userIds =
          body.assignee_user_ids !== undefined
            ? body.assignee_user_ids
            : currentAssignments.users.map(
                (user) => user.id,
              )

        const roleIds =
          body.assignee_role_ids !== undefined
            ? body.assignee_role_ids
            : currentAssignments.roles.map(
                (role) => role.id,
              )

        const assignmentError =
          await replaceAssignments(
            env,
            id,
            userIds,
            roleIds,
          )

        if (assignmentError) {
          return assignmentError
        }

        await env.DB
          .prepare(`
            UPDATE tasks
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `)
          .bind(id)
          .run()
      }
    } catch (error) {
      console.error("Failed to update task:", error)

      return Response.json(
        { error: "Failed to update task" },
        { status: 500 },
      )
    }

    const task = await getTask(env, id)

    return Response.json({
      ...task,
      assignments: await getTaskAssignments(env, id),
    })
  }

  if (
    request.method === "GET" &&
    pathParts.length === 2 &&
    pathParts[1] === "comments"
  ) {
    if (!(await hasPermission(env, auth.user.id, "tasks.comment"))) {
      return Response.json(
        { error: "Forbidden", permission: "tasks.comment" },
        { status: 403 },
      )
    }

    const taskId = pathParts[0]

    const task = await getTask(env, taskId)

    if (!task) {
      return Response.json(
        { error: "Task not found" },
        { status: 404 },
      )
    }

    const access = await env.DB
      .prepare(`
        SELECT 1
        FROM tasks t
        LEFT JOIN task_assignees ta
          ON ta.task_id = t.id
        LEFT JOIN task_roles tr
          ON tr.task_id = t.id
        LEFT JOIN user_roles ur
          ON ur.role_id = tr.role_id
          AND ur.user_id = ?
        WHERE t.id = ?
          AND (
            ta.user_id = ?
            OR ur.user_id IS NOT NULL
            OR t.created_by = ?
          )
        LIMIT 1
      `)
      .bind(
        auth.user.id,
        taskId,
        auth.user.id,
        auth.user.id,
      )
      .first<{ 1: number }>()

    if (!access) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403 },
      )
    }

    const result = await env.DB
      .prepare(`
        SELECT
          tc.id,
          tc.task_id,
          tc.user_id,
          u.name AS user_name,
          u.nickname AS user_nickname,
          tc.content,
          tc.created_at,
          tc.updated_at
        FROM task_comments tc
        INNER JOIN users u
          ON u.id = tc.user_id
        WHERE tc.task_id = ?
        ORDER BY tc.created_at ASC
      `)
      .bind(taskId)
      .all<{
        id: string
        task_id: string
        user_id: string
        user_name: string
        user_nickname: string | null
        content: string
        created_at: string
        updated_at: string
      }>()

    return Response.json({
      comments: result.results,
    })
  }

  if (
    request.method === "POST" &&
    pathParts.length === 2 &&
    pathParts[1] === "comments"
  ) {
    if (!(await hasPermission(env, auth.user.id, "tasks.comment"))) {
      return Response.json(
        { error: "Forbidden", permission: "tasks.comment" },
        { status: 403 },
      )
    }

    const taskId = pathParts[0]

    const task = await getTask(env, taskId)

    if (!task) {
      return Response.json(
        { error: "Task not found" },
        { status: 404 },
      )
    }

    const access = await env.DB
      .prepare(`
        SELECT 1
        FROM tasks t
        LEFT JOIN task_assignees ta
          ON ta.task_id = t.id
        LEFT JOIN task_roles tr
          ON tr.task_id = t.id
        LEFT JOIN user_roles ur
          ON ur.role_id = tr.role_id
          AND ur.user_id = ?
        WHERE t.id = ?
          AND (
            ta.user_id = ?
            OR ur.user_id IS NOT NULL
            OR t.created_by = ?
          )
        LIMIT 1
      `)
      .bind(
        auth.user.id,
        taskId,
        auth.user.id,
        auth.user.id,
      )
      .first<{ 1: number }>()

    if (!access) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403 },
      )
    }

    let body: { content?: unknown }

    try {
      body = await request.json<{ content?: unknown }>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    if (
      typeof body.content !== "string" ||
      body.content.trim() === ""
    ) {
      return Response.json(
        { error: "content is required" },
        { status: 400 },
      )
    }

    const id = generateId()
    const content = body.content.trim()

    await env.DB
      .prepare(`
        INSERT INTO task_comments (
          id,
          task_id,
          user_id,
          content
        )
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        id,
        taskId,
        auth.user.id,
        content,
      )
      .run()

    const comment = await env.DB
      .prepare(`
        SELECT
          tc.id,
          tc.task_id,
          tc.user_id,
          u.name AS user_name,
          u.nickname AS user_nickname,
          tc.content,
          tc.created_at,
          tc.updated_at
        FROM task_comments tc
        INNER JOIN users u
          ON u.id = tc.user_id
        WHERE tc.id = ?
      `)
      .bind(id)
      .first<{
        id: string
        task_id: string
        user_id: string
        user_name: string
        user_nickname: string | null
        content: string
        created_at: string
        updated_at: string
      }>()

    return Response.json(
      comment,
      { status: 201 },
    )
  }

  if (
    request.method === "PATCH" &&
    pathParts.length === 3 &&
    pathParts[1] === "comments"
  ) {
    if (!(await hasPermission(env, auth.user.id, "tasks.comment"))) {
      return Response.json(
        { error: "Forbidden", permission: "tasks.comment" },
        { status: 403 },
      )
    }

    const taskId = pathParts[0]
    const commentId = pathParts[2]

    const comment = await env.DB
      .prepare(`
        SELECT
          id,
          task_id,
          user_id,
          content,
          created_at,
          updated_at
        FROM task_comments
        WHERE id = ?
          AND task_id = ?
      `)
      .bind(commentId, taskId)
      .first<{
        id: string
        task_id: string
        user_id: string
        content: string
        created_at: string
        updated_at: string
      }>()

    if (!comment) {
      return Response.json(
        { error: "Comment not found" },
        { status: 404 },
      )
    }

    if (comment.user_id !== auth.user.id) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403 },
      )
    }

    let body: { content?: unknown }

    try {
      body = await request.json<{ content?: unknown }>()
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400 },
      )
    }

    if (
      typeof body.content !== "string" ||
      body.content.trim() === ""
    ) {
      return Response.json(
        { error: "content is required" },
        { status: 400 },
      )
    }

    await env.DB
      .prepare(`
        UPDATE task_comments
        SET
          content = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        body.content.trim(),
        commentId,
      )
      .run()

    const updatedComment = await env.DB
      .prepare(`
        SELECT
          tc.id,
          tc.task_id,
          tc.user_id,
          u.name AS user_name,
          u.nickname AS user_nickname,
          tc.content,
          tc.created_at,
          tc.updated_at
        FROM task_comments tc
        INNER JOIN users u
          ON u.id = tc.user_id
        WHERE tc.id = ?
      `)
      .bind(commentId)
      .first<{
        id: string
        task_id: string
        user_id: string
        user_name: string
        user_nickname: string | null
        content: string
        created_at: string
        updated_at: string
      }>()

    return Response.json(updatedComment)
  }

  if (
    request.method === "DELETE" &&
    pathParts.length === 3 &&
    pathParts[1] === "comments"
  ) {
    if (!(await hasPermission(env, auth.user.id, "tasks.comment"))) {
      return Response.json(
        { error: "Forbidden", permission: "tasks.comment" },
        { status: 403 },
      )
    }

    const taskId = pathParts[0]
    const commentId = pathParts[2]

    const comment = await env.DB
      .prepare(`
        SELECT
          id,
          user_id
        FROM task_comments
        WHERE id = ?
          AND task_id = ?
      `)
      .bind(commentId, taskId)
      .first<{
        id: string
        user_id: string
      }>()

    if (!comment) {
      return Response.json(
        { error: "Comment not found" },
        { status: 404 },
      )
    }

    if (comment.user_id !== auth.user.id) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403 },
      )
    }

    await env.DB
      .prepare(`
        DELETE FROM task_comments
        WHERE id = ?
          AND task_id = ?
      `)
      .bind(commentId, taskId)
      .run()

    return new Response(null, { status: 204 })
  }

  if (request.method === "DELETE" && pathParts.length === 1) {
    if (!(await hasPermission(env, auth.user.id, "tasks.delete"))) {
      return Response.json(
        { error: "Forbidden", permission: "tasks.delete" },
        { status: 403 },
      )
    }

    const id = pathParts[0]

    const existingTask = await getTask(env, id)

    if (!existingTask) {
      return Response.json(
        { error: "Task not found" },
        { status: 404 },
      )
    }

    if (existingTask.created_by !== auth.user.id) {
      return Response.json(
        { error: "Forbidden" },
        { status: 403 },
      )
    }

    try {
      await env.DB
        .prepare(`
          DELETE FROM tasks
          WHERE id = ?
        `)
        .bind(id)
        .run()
    } catch (error) {
      console.error("Failed to delete task:", error)

      return Response.json(
        { error: "Failed to delete task" },
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
