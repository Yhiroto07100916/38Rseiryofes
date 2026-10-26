import { hasPermission, requireAuth } from "../lib/authz"

interface Minute {
  id: string
  title: string
  meeting_at: string
  location: string | null
  attendees: string
  absentees: string
  agenda: string
  discussion: string
  decisions: string
  next_meeting_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface MinuteBody {
  title?: unknown
  meeting_at?: unknown
  location?: unknown
  attendees?: unknown
  absentees?: unknown
  agenda?: unknown
  discussion?: unknown
  decisions?: unknown
  next_meeting_at?: unknown
  task_ids?: unknown
}

function errorResponse(message: string, status = 400): Response {
  return Response.json({ error: message }, { status })
}

function readRequired(value: unknown): string | null {
  if (typeof value !== "string") return null
  const result = value.trim()
  return result.length > 0 ? result : null
}

function readOptional(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  if (typeof value !== "string") return undefined
  return value.trim() || null
}

function readText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  return value.trim()
}

// リッチテキストJSONの本文は、空白を含めてそのまま保存する。
function readDiscussion(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  return value
}

function parseTaskIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every((item) => typeof item === "string" && item.trim())) {
    return null
  }
  const ids = value.map((item: string) => item.trim())
  return new Set(ids).size === ids.length ? ids : null
}

async function readBody(request: Request): Promise<MinuteBody | null> {
  try {
    return await request.json<MinuteBody>()
  } catch {
    return null
  }
}

async function getMinute(env: Env, id: string): Promise<Minute | null> {
  return env.DB.prepare(`
    SELECT id, title, meeting_at, location, attendees, absentees,
           agenda, discussion, decisions, next_meeting_at,
           created_by, created_at, updated_at
    FROM minutes
    WHERE id = ?
  `).bind(id).first<Minute>()
}

async function getTaskIds(env: Env, minuteId: string): Promise<string[]> {
  const result = await env.DB.prepare(`
    SELECT task_id
    FROM minute_tasks
    WHERE minute_id = ?
    ORDER BY task_id
  `).bind(minuteId).all<{ task_id: string }>()
  return result.results.map((row) => row.task_id)
}

async function validateTasks(env: Env, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return true
  const placeholders = ids.map(() => "?").join(",")
  const result = await env.DB.prepare(`
    SELECT id FROM tasks WHERE id IN (${placeholders})
  `).bind(...ids).all<{ id: string }>()
  return result.results.length === ids.length
}

async function setTasks(
  env: Env,
  minuteId: string,
  ids: string[],
): Promise<void> {
  const statements = [
    env.DB.prepare("DELETE FROM minute_tasks WHERE minute_id = ?")
      .bind(minuteId),
    ...ids.map((taskId) => env.DB.prepare(`
      INSERT INTO minute_tasks (minute_id, task_id)
      VALUES (?, ?)
    `).bind(minuteId, taskId)),
  ]
  await env.DB.batch(statements)
}

async function detail(env: Env, minute: Minute) {
  return {
    minute,
    task_ids: await getTaskIds(env, minute.id),
  }
}

function validDate(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

export async function handleMinutes(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const userId = auth.user.id
  const method = request.method
  const minuteId = pathParts[0]

  if (pathParts.length > 1) return errorResponse("Not Found", 404)

  if (method === "GET" && pathParts.length === 0) {
    if (!(await hasPermission(env, userId, "minutes.view"))) {
      return errorResponse("Forbidden", 403)
    }

    const result = await env.DB.prepare(`
      SELECT id, title, meeting_at, location, attendees, absentees,
             agenda, discussion, decisions, next_meeting_at,
             created_by, created_at, updated_at
      FROM minutes
      ORDER BY meeting_at DESC, created_at DESC, id
    `).all<Minute>()

    return Response.json({ minutes: result.results })
  }

  if (!minuteId) {
    if (method !== "POST") return errorResponse("Not Found", 404)
    if (!(await hasPermission(env, userId, "minutes.create"))) {
      return errorResponse("Forbidden", 403)
    }

    const body = await readBody(request)
    if (!body) return errorResponse("Invalid JSON body")

    const title = readRequired(body.title)
    const meetingAt = readRequired(body.meeting_at)
    if (!title || title.length > 200) return errorResponse("Invalid title")
    if (!meetingAt || !validDate(meetingAt)) {
      return errorResponse("Invalid meeting_at")
    }

    const location = body.location === undefined ? null : readOptional(body.location)
    const nextMeetingAt = body.next_meeting_at === undefined
      ? null : readOptional(body.next_meeting_at)
    const attendees = body.attendees === undefined ? "" : readText(body.attendees)
    const absentees = body.absentees === undefined ? "" : readText(body.absentees)
    const agenda = body.agenda === undefined ? "" : readText(body.agenda)
    const discussion = body.discussion === undefined ? "" : readDiscussion(body.discussion)
    const decisions = body.decisions === undefined ? "" : readText(body.decisions)

    if (
      location === undefined ||
      nextMeetingAt === undefined ||
      attendees === undefined ||
      absentees === undefined ||
      agenda === undefined ||
      discussion === undefined ||
      decisions === undefined
    ) return errorResponse("Invalid optional field")

    if (
      attendees.length > 10000 ||
      absentees.length > 10000 ||
      agenda.length > 20000 ||
      discussion.length > 50000 ||
      decisions.length > 20000
    ) return errorResponse("Text field is too long")

    if (nextMeetingAt !== null && nextMeetingAt !== undefined &&
        !validDate(nextMeetingAt)) {
      return errorResponse("Invalid next_meeting_at")
    }

    const taskIds = body.task_ids === undefined ? [] : parseTaskIds(body.task_ids)
    if (taskIds === null) return errorResponse("Invalid task_ids")
    if (!(await validateTasks(env, taskIds))) {
      return errorResponse("One or more tasks were not found")
    }

    const now = new Date().toISOString()
    const minute: Minute = {
      id: crypto.randomUUID(),
      title,
      meeting_at: meetingAt,
      location: location ?? null,
      attendees,
      absentees,
      agenda,
      discussion,
      decisions,
      next_meeting_at: nextMeetingAt ?? null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    }

    const statements = [
      env.DB.prepare(`
        INSERT INTO minutes (
          id, title, meeting_at, location, attendees, absentees,
          agenda, discussion, decisions, next_meeting_at,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        minute.id, minute.title, minute.meeting_at, minute.location,
        minute.attendees, minute.absentees, minute.agenda,
        minute.discussion, minute.decisions, minute.next_meeting_at,
        minute.created_by, minute.created_at, minute.updated_at,
      ),
      ...taskIds.map((taskId) => env.DB.prepare(`
        INSERT INTO minute_tasks (minute_id, task_id) VALUES (?, ?)
      `).bind(minute.id, taskId)),
    ]

    await env.DB.batch(statements)
    const created = await getMinute(env, minute.id)
    if (!created) return errorResponse("Failed to create minute", 500)
    return Response.json(await detail(env, created), { status: 201 })
  }

  if (method === "GET") {
    if (!(await hasPermission(env, userId, "minutes.view"))) {
      return errorResponse("Forbidden", 403)
    }
    const minute = await getMinute(env, minuteId)
    if (!minute) return errorResponse("Minute not found", 404)
    return Response.json(await detail(env, minute))
  }

  if (method === "PATCH" || method === "PUT") {
    if (!(await hasPermission(env, userId, "minutes.edit"))) {
      return errorResponse("Forbidden", 403)
    }

    const minute = await getMinute(env, minuteId)
    if (!minute) return errorResponse("Minute not found", 404)

    const body = await readBody(request)
    if (!body) return errorResponse("Invalid JSON body")

    const title = body.title === undefined ? minute.title : readRequired(body.title)
    const meetingAt = body.meeting_at === undefined
      ? minute.meeting_at : readRequired(body.meeting_at)

    if (!title || title.length > 200) return errorResponse("Invalid title")
    if (!meetingAt || !validDate(meetingAt)) {
      return errorResponse("Invalid meeting_at")
    }

    const location = readOptional(body.location)
    const nextMeetingAt = readOptional(body.next_meeting_at)
    const attendees = body.attendees === undefined ? minute.attendees : readText(body.attendees)
    const absentees = body.absentees === undefined ? minute.absentees : readText(body.absentees)
    const agenda = body.agenda === undefined ? minute.agenda : readText(body.agenda)
    const discussion = body.discussion === undefined ? minute.discussion : readDiscussion(body.discussion)
    const decisions = body.decisions === undefined ? minute.decisions : readText(body.decisions)

    if (
      (body.location !== undefined && location === undefined) ||
      (body.next_meeting_at !== undefined && nextMeetingAt === undefined) ||
      attendees === undefined ||
      absentees === undefined ||
      agenda === undefined ||
      discussion === undefined ||
      decisions === undefined
    ) return errorResponse("Invalid optional field")

    const nextLocation = body.location === undefined ? minute.location : location ?? null
    const nextMeeting = body.next_meeting_at === undefined
      ? minute.next_meeting_at : nextMeetingAt ?? null

    if (
      attendees.length > 10000 ||
      absentees.length > 10000 ||
      agenda.length > 20000 ||
      discussion.length > 50000 ||
      decisions.length > 20000
    ) return errorResponse("Text field is too long")

    if (nextMeeting !== null && !validDate(nextMeeting)) {
      return errorResponse("Invalid next_meeting_at")
    }

    const taskIds = body.task_ids === undefined ? null : parseTaskIds(body.task_ids)
    if (body.task_ids !== undefined && taskIds === null) {
      return errorResponse("Invalid task_ids")
    }
    if (taskIds !== null && !(await validateTasks(env, taskIds))) {
      return errorResponse("One or more tasks were not found")
    }

    const updatedAt = new Date().toISOString()
    await env.DB.prepare(`
      UPDATE minutes
      SET title = ?, meeting_at = ?, location = ?, attendees = ?,
          absentees = ?, agenda = ?, discussion = ?, decisions = ?,
          next_meeting_at = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      title, meetingAt, nextLocation, attendees, absentees, agenda,
      discussion, decisions, nextMeeting, updatedAt, minuteId,
    ).run()

    if (taskIds !== null) {
      await setTasks(env, minuteId, taskIds)
    }

    const updated = await getMinute(env, minuteId)
    if (!updated) return errorResponse("Minute not found", 404)
    return Response.json(await detail(env, updated))
  }

  if (method === "DELETE") {
    if (!(await hasPermission(env, userId, "minutes.delete"))) {
      return errorResponse("Forbidden", 403)
    }

    const minute = await getMinute(env, minuteId)
    if (!minute) return errorResponse("Minute not found", 404)

    await env.DB.prepare("DELETE FROM minutes WHERE id = ?")
      .bind(minuteId).run()
    return Response.json({ deleted: true })
  }

  return errorResponse("Method Not Allowed", 405)
}
