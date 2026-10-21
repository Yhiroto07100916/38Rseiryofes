import { hasPermission, requireAuth } from "../lib/authz"

interface Decision {
  id: string
  title: string
  content: string
  rationale: string | null
  decided_at: string
  decision_maker: string | null
  meeting_name: string | null
  survey_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface DecisionBody {
  title?: unknown
  content?: unknown
  rationale?: unknown
  decided_at?: unknown
  decision_maker?: unknown
  meeting_name?: unknown
  survey_id?: unknown
  task_ids?: unknown
  file_ids?: unknown
}

function generateId(): string {
  return crypto.randomUUID()
}

function responseError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status })
}

async function readBody(request: Request): Promise<DecisionBody | null> {
  try {
    return await request.json<DecisionBody>()
  } catch {
    return null
  }
}

function requiredString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const result = value.trim()
  return result ? result : null
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  if (typeof value !== "string") return undefined
  return value.trim() || null
}

function parseIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every((item) => typeof item === "string" && item.trim())) {
    return null
  }
  const ids = value.map((item: string) => item.trim())
  if (new Set(ids).size !== ids.length) return null
  return ids
}

async function getDecision(
  env: Env,
  decisionId: string,
): Promise<Decision | null> {
  return env.DB.prepare(`
    SELECT id, title, content, rationale, decided_at, decision_maker,
           meeting_name, survey_id, created_by, created_at, updated_at
    FROM decisions
    WHERE id = ?
  `).bind(decisionId).first<Decision>()
}

async function validateIds(
  env: Env,
  table: "tasks" | "files",
  ids: string[],
): Promise<boolean> {
  if (ids.length === 0) return true

  const placeholders = ids.map(() => "?").join(",")
  const activeFileFilter = table === "files" ? "AND archived_at IS NULL" : ""
  const result = await env.DB.prepare(`
    SELECT id FROM ${table}
    WHERE id IN (${placeholders})
      ${activeFileFilter}
  `).bind(...ids).all<{ id: string }>()

  return result.results.length === ids.length
}

async function getLinks(env: Env, decisionId: string) {
  const tasks = await env.DB.prepare(`
    SELECT t.id, t.title, t.status, t.due_at
    FROM decision_tasks dt
    INNER JOIN tasks t ON t.id = dt.task_id
    WHERE dt.decision_id = ?
    ORDER BY t.title, t.id
  `).bind(decisionId).all()

  const files = await env.DB.prepare(`
    SELECT f.id, f.original_name, f.content_type, f.size, f.category
    FROM decision_files df
    INNER JOIN files f ON f.id = df.file_id
    WHERE df.decision_id = ?
      AND f.archived_at IS NULL
    ORDER BY f.original_name, f.id
  `).bind(decisionId).all()

  return { tasks: tasks.results, files: files.results }
}

async function getHistory(env: Env, decisionId: string) {
  const result = await env.DB.prepare(`
    SELECT h.id, h.action, h.before_data, h.after_data, h.created_at,
           u.id AS actor_id, u.name AS actor_name
    FROM decision_history h
    INNER JOIN users u ON u.id = h.actor_id
    WHERE COALESCE(h.decision_id, h.original_decision_id) = ?
    ORDER BY h.created_at DESC, h.id DESC
  `).bind(decisionId).all()

  return result.results
}

async function validateSurvey(
  env: Env,
  surveyId: string | null,
): Promise<boolean> {
  if (surveyId === null) return true
  const row = await env.DB.prepare(
    "SELECT id FROM surveys WHERE id = ?",
  ).bind(surveyId).first<{ id: string }>()
  return Boolean(row)
}

async function validateLinks(
  env: Env,
  taskIds: string[],
  fileIds: string[],
  surveyId: string | null,
): Promise<Response | null> {
  if (!(await validateIds(env, "tasks", taskIds))) {
    return responseError("One or more tasks were not found")
  }
  if (!(await validateIds(env, "files", fileIds))) {
    return responseError("One or more files were not found")
  }
  if (!(await validateSurvey(env, surveyId))) {
    return responseError("Survey not found")
  }
  return null
}

function historyStatement(
  env: Env,
  decisionId: string,
  actorId: string,
  action: "created" | "updated" | "deleted",
  before: Decision | null,
  after: Record<string, unknown> | Decision | null,
) {
  return env.DB.prepare(`
    INSERT INTO decision_history
      (id, decision_id, original_decision_id, actor_id, action, before_data, after_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    generateId(),
    decisionId,
    decisionId,
    actorId,
    action,
    before === null ? null : JSON.stringify(before),
    after === null ? null : JSON.stringify(after),
  )
}

export async function handleDecisions(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const userId = auth.user.id
  const method = request.method
  const decisionId = pathParts[0]
  const subresource = pathParts[1]

  if (pathParts.length > 2) return responseError("Not Found", 404)

  if (method === "GET" && pathParts.length === 0) {
    if (!(await hasPermission(env, userId, "decisions.view"))) {
      return responseError("Forbidden", 403)
    }

    const result = await env.DB.prepare(`
      SELECT d.id, d.title, d.content, d.rationale, d.decided_at,
             d.decision_maker, d.meeting_name, d.survey_id,
             d.created_by, d.created_at, d.updated_at
      FROM decisions d
      ORDER BY d.decided_at DESC, d.created_at DESC, d.id
    `).all<Decision>()

    return Response.json({ decisions: result.results })
  }

  if (!decisionId) {
    if (method !== "POST") return responseError("Not Found", 404)
    if (!(await hasPermission(env, userId, "decisions.create"))) {
      return responseError("Forbidden", 403)
    }

    const body = await readBody(request)
    if (!body) return responseError("Invalid JSON body")

    const title = requiredString(body.title)
    const content = requiredString(body.content)
    const decidedAt = requiredString(body.decided_at)
    if (!title || title.length > 200) return responseError("Invalid title")
    if (!content || content.length > 20000) return responseError("Invalid content")
    if (!decidedAt || !Number.isFinite(Date.parse(decidedAt))) {
      return responseError("Invalid decided_at")
    }

    const rationale = optionalString(body.rationale)
    const decisionMaker = optionalString(body.decision_maker)
    const meetingName = optionalString(body.meeting_name)
    const surveyId = optionalString(body.survey_id)
    if (
      (body.rationale !== undefined && rationale === undefined) ||
      (body.decision_maker !== undefined && decisionMaker === undefined) ||
      (body.meeting_name !== undefined && meetingName === undefined) ||
      (body.survey_id !== undefined && surveyId === undefined)
    ) {
      return responseError("Invalid optional field")
    }

    const taskIds = body.task_ids === undefined ? [] : parseIds(body.task_ids)
    const fileIds = body.file_ids === undefined ? [] : parseIds(body.file_ids)
    if (taskIds === null || fileIds === null) {
      return responseError("Invalid task_ids or file_ids")
    }

    const validationError = await validateLinks(
      env, taskIds, fileIds, surveyId ?? null,
    )
    if (validationError) return validationError

    const now = new Date().toISOString()
    const newDecision: Decision = {
      id: generateId(),
      title,
      content,
      rationale: rationale ?? null,
      decided_at: decidedAt,
      decision_maker: decisionMaker ?? null,
      meeting_name: meetingName ?? null,
      survey_id: surveyId ?? null,
      created_by: userId,
      created_at: now,
      updated_at: now,
    }

    const statements = [
      env.DB.prepare(`
        INSERT INTO decisions (
          id, title, content, rationale, decided_at, decision_maker,
          meeting_name, survey_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newDecision.id, newDecision.title, newDecision.content,
        newDecision.rationale, newDecision.decided_at,
        newDecision.decision_maker, newDecision.meeting_name,
        newDecision.survey_id, newDecision.created_by,
        newDecision.created_at, newDecision.updated_at,
      ),
      ...taskIds.map((taskId) => env.DB.prepare(`
        INSERT INTO decision_tasks (decision_id, task_id) VALUES (?, ?)
      `).bind(newDecision.id, taskId)),
      ...fileIds.map((fileId) => env.DB.prepare(`
        INSERT INTO decision_files (decision_id, file_id) VALUES (?, ?)
      `).bind(newDecision.id, fileId)),
      historyStatement(env, newDecision.id, userId, "created", null, newDecision),
    ]

    await env.DB.batch(statements)
    return Response.json({
      decision: await getDecision(env, newDecision.id),
      ...(await getLinks(env, newDecision.id)),
    }, { status: 201 })
  }

  if (!decisionId) return responseError("Not Found", 404)

  if (method === "GET" && subresource === "history") {
    if (!(await hasPermission(env, userId, "decisions.view"))) {
      return responseError("Forbidden", 403)
    }

    return Response.json({
      history: await getHistory(env, decisionId),
    })
  }

  const decision = await getDecision(env, decisionId)
  if (!decision) return responseError("Decision not found", 404)

  if (method === "GET" && pathParts.length === 1) {
    if (!(await hasPermission(env, userId, "decisions.view"))) {
      return responseError("Forbidden", 403)
    }

    return Response.json({
      decision,
      ...(await getLinks(env, decisionId)),
      history: await getHistory(env, decisionId),
    })
  }

  if (subresource !== undefined) return responseError("Not Found", 404)

  if (method === "PATCH" || method === "PUT") {
    if (!(await hasPermission(env, userId, "decisions.edit"))) {
      return responseError("Forbidden", 403)
    }

    const body = await readBody(request)
    if (!body) return responseError("Invalid JSON body")

    const title = body.title === undefined ? decision.title : requiredString(body.title)
    const content = body.content === undefined ? decision.content : requiredString(body.content)
    const decidedAt = body.decided_at === undefined
      ? decision.decided_at
      : requiredString(body.decided_at)

    if (!title || title.length > 200) return responseError("Invalid title")
    if (!content || content.length > 20000) return responseError("Invalid content")
    if (!decidedAt || !Number.isFinite(Date.parse(decidedAt))) {
      return responseError("Invalid decided_at")
    }

    const rationale = optionalString(body.rationale)
    const decisionMaker = optionalString(body.decision_maker)
    const meetingName = optionalString(body.meeting_name)
    const surveyId = optionalString(body.survey_id)

    if (
      (body.rationale !== undefined && rationale === undefined) ||
      (body.decision_maker !== undefined && decisionMaker === undefined) ||
      (body.meeting_name !== undefined && meetingName === undefined) ||
      (body.survey_id !== undefined && surveyId === undefined)
    ) {
      return responseError("Invalid optional field")
    }

    const nextRationale = body.rationale === undefined ? decision.rationale : rationale ?? null
    const nextDecisionMaker = body.decision_maker === undefined
      ? decision.decision_maker : decisionMaker ?? null
    const nextMeetingName = body.meeting_name === undefined
      ? decision.meeting_name : meetingName ?? null
    const nextSurveyId = body.survey_id === undefined
      ? decision.survey_id : surveyId ?? null

    const taskIds = body.task_ids === undefined ? null : parseIds(body.task_ids)
    const fileIds = body.file_ids === undefined ? null : parseIds(body.file_ids)
    if ((body.task_ids !== undefined && taskIds === null) ||
        (body.file_ids !== undefined && fileIds === null)) {
      return responseError("Invalid task_ids or file_ids")
    }

    const currentTaskIds = taskIds ?? (
      await env.DB.prepare(
        "SELECT task_id AS id FROM decision_tasks WHERE decision_id = ?",
      ).bind(decisionId).all<{ id: string }>()
    ).results.map((row) => row.id)

    const currentFileIds = fileIds ?? (
      await env.DB.prepare(`
        SELECT df.file_id AS id
        FROM decision_files df
        INNER JOIN files f ON f.id = df.file_id
        WHERE df.decision_id = ?
          AND f.archived_at IS NULL
      `).bind(decisionId).all<{ id: string }>()
    ).results.map((row) => row.id)

    const validationError = await validateLinks(
      env, currentTaskIds, currentFileIds, nextSurveyId,
    )
    if (validationError) return validationError

    const updated: Decision = {
      ...decision,
      title,
      content,
      rationale: nextRationale,
      decided_at: decidedAt,
      decision_maker: nextDecisionMaker,
      meeting_name: nextMeetingName,
      survey_id: nextSurveyId,
      updated_at: new Date().toISOString(),
    }

    const statements = [
      env.DB.prepare(`
        UPDATE decisions
        SET title = ?, content = ?, rationale = ?, decided_at = ?,
            decision_maker = ?, meeting_name = ?, survey_id = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        updated.title, updated.content, updated.rationale,
        updated.decided_at, updated.decision_maker, updated.meeting_name,
        updated.survey_id, updated.updated_at, decisionId,
      ),
    ]

    if (taskIds !== null) {
      statements.push(
        env.DB.prepare("DELETE FROM decision_tasks WHERE decision_id = ?")
          .bind(decisionId),
      )
      for (const taskId of taskIds) {
        statements.push(env.DB.prepare(`
          INSERT INTO decision_tasks (decision_id, task_id) VALUES (?, ?)
        `).bind(decisionId, taskId))
      }
    }

    if (fileIds !== null) {
      statements.push(
        env.DB.prepare("DELETE FROM decision_files WHERE decision_id = ?")
          .bind(decisionId),
      )
      for (const fileId of fileIds) {
        statements.push(env.DB.prepare(`
          INSERT INTO decision_files (decision_id, file_id) VALUES (?, ?)
        `).bind(decisionId, fileId))
      }
    }

    statements.push(
      historyStatement(env, decisionId, userId, "updated", decision, updated),
    )

    await env.DB.batch(statements)
    return Response.json({
      decision: await getDecision(env, decisionId),
      ...(await getLinks(env, decisionId)),
    })
  }

  if (method === "DELETE") {
    if (!(await hasPermission(env, userId, "decisions.delete"))) {
      return responseError("Forbidden", 403)
    }

    await env.DB.batch([
      historyStatement(env, decisionId, userId, "deleted", decision, null),
      env.DB.prepare("DELETE FROM decisions WHERE id = ?").bind(decisionId),
    ])

    return Response.json({ deleted: true })
  }

  return responseError("Method Not Allowed", 405)
}
