import { hasPermission, requireAuth } from "../lib/authz"

type ResponseType = "single_choice" | "multiple_choice" | "free_text"
type SurveyStatus = "draft" | "published" | "closed"

interface Survey {
  id: string
  title: string
  description: string | null
  response_type: ResponseType
  is_anonymous: number
  status: SurveyStatus
  starts_at: string | null
  deadline_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface SurveyOption {
  id: string
  survey_id: string
  label: string
  sort_order: number
}

interface SurveyBody {
  title?: unknown
  description?: unknown
  response_type?: unknown
  is_anonymous?: unknown
  status?: unknown
  starts_at?: unknown
  deadline_at?: unknown
  options?: unknown
}

interface AnswerBody {
  text_answer?: unknown
  option_ids?: unknown
}

function id(): string {
  return crypto.randomUUID()
}

function requiredString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const result = value.trim()
  return result.length > 0 ? result : null
}

function optionalString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === "") return null
  if (typeof value !== "string") return undefined
  return value.trim() || null
}

function validDate(value: string | null | undefined): boolean {
  return value == null || (
    value.length > 0 && Number.isFinite(Date.parse(value))
  )
}

function parseOptions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  if (!value.every((item) => typeof item === "string" && item.trim())) {
    return null
  }
  const options = value.map((item: string) => item.trim())
  if (options.some((item) => item.length > 200)) return null
  if (new Set(options).size !== options.length) return null
  return options
}

function error(message: string, status = 400): Response {
  return Response.json({ error: message }, { status })
}

async function permitted(
  env: Env,
  userId: string,
  permission: string,
): Promise<boolean> {
  return hasPermission(env, userId, permission)
}

async function getSurvey(
  env: Env,
  surveyId: string,
): Promise<Survey | null> {
  return env.DB.prepare(`
    SELECT id, title, description, response_type, is_anonymous, status,
           starts_at, deadline_at, created_by, created_at, updated_at
    FROM surveys
    WHERE id = ?
  `).bind(surveyId).first<Survey>()
}

async function getOptions(
  env: Env,
  surveyId: string,
): Promise<SurveyOption[]> {
  const result = await env.DB.prepare(`
    SELECT id, survey_id, label, sort_order
    FROM survey_options
    WHERE survey_id = ?
    ORDER BY sort_order, id
  `).bind(surveyId).all<SurveyOption>()
  return result.results
}

async function readBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json<T>()
  } catch {
    return null
  }
}

async function canManage(
  env: Env,
  userId: string,
): Promise<boolean> {
  return (
    await permitted(env, userId, "surveys.create") ||
    await permitted(env, userId, "surveys.edit") ||
    await permitted(env, userId, "surveys.delete")
  )
}

export async function handleSurveys(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const userId = auth.user.id
  const method = request.method
  const surveyId = pathParts[0]
  const subresource = pathParts[1]

  if (method === "GET" && pathParts.length === 0) {
    if (!(await permitted(env, userId, "surveys.view"))) {
      return error("Forbidden", 403)
    }

    const manager = await canManage(env, userId)
    const result = await env.DB.prepare(`
      SELECT s.id, s.title, s.description, s.response_type,
             s.is_anonymous, s.status, s.starts_at, s.deadline_at,
             s.created_by, s.created_at, s.updated_at,
             (SELECT COUNT(*) FROM survey_participation p
              WHERE p.survey_id = s.id) AS response_count
      FROM surveys s
      ${manager ? "" : "WHERE s.status = 'published'"}
      ORDER BY s.created_at DESC, s.id
    `).all()

    return Response.json({ surveys: result.results })
  }

  if (!surveyId) {
    if (method !== "POST") return error("Not Found", 404)
    if (!(await permitted(env, userId, "surveys.create"))) {
      return error("Forbidden", 403)
    }

    const body = await readBody<SurveyBody>(request)
    if (!body) return error("Invalid JSON body")

    const title = requiredString(body.title)
    if (!title || title.length > 200) return error("Invalid title")

    const description = optionalString(body.description)
    if (description === undefined) return error("Invalid description")

    const responseType = body.response_type ?? "single_choice"
    if (!["single_choice", "multiple_choice", "free_text"].includes(String(responseType))) {
      return error("Invalid response_type")
    }

    const anonymous = body.is_anonymous === true || body.is_anonymous === 1
      ? 1
      : body.is_anonymous === false || body.is_anonymous === 0 || body.is_anonymous === undefined
        ? 0
        : -1
    if (anonymous === -1) return error("Invalid is_anonymous")

    const status = body.status ?? "draft"
    if (!["draft", "published", "closed"].includes(String(status))) {
      return error("Invalid status")
    }

    const startsAt = optionalString(body.starts_at)
    const deadlineAt = optionalString(body.deadline_at)
    if (
      (body.starts_at !== undefined && startsAt === undefined) ||
      (body.deadline_at !== undefined && deadlineAt === undefined)
    ) {
      return error("Invalid date")
    }
    if (
      (startsAt !== undefined && startsAt !== null && !validDate(startsAt)) ||
      (deadlineAt !== undefined && deadlineAt !== null && !validDate(deadlineAt))
    ) {
      return error("Invalid date")
    }
    if (startsAt && deadlineAt && Date.parse(startsAt) > Date.parse(deadlineAt)) {
      return error("starts_at must be before deadline_at")
    }

    const options = body.options === undefined ? [] : parseOptions(body.options)
    if (options === null) return error("Invalid options")
    if (responseType === "free_text" && options.length > 0) {
      return error("Free-text surveys cannot have options")
    }
    if (responseType !== "free_text" && options.length < 2) {
      return error("Choice surveys require at least two options")
    }

    const surveyId = id()
    const now = new Date().toISOString()
    const statements = [
      env.DB.prepare(`
        INSERT INTO surveys (
          id, title, description, response_type, is_anonymous, status,
          starts_at, deadline_at, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        surveyId, title, description ?? null, responseType, anonymous,
        status, startsAt ?? null, deadlineAt ?? null, userId, now, now,
      ),
      ...options.map((label, index) =>
        env.DB.prepare(`
          INSERT INTO survey_options (id, survey_id, label, sort_order)
          VALUES (?, ?, ?, ?)
        `).bind(id(), surveyId, label, index),
      ),
    ]
    await env.DB.batch(statements)

    return Response.json({
      survey: await getSurvey(env, surveyId),
      options: await getOptions(env, surveyId),
    }, { status: 201 })
  }

  if (!surveyId || pathParts.length > 2) return error("Not Found", 404)

  const survey = await getSurvey(env, surveyId)
  if (!survey) return error("Survey not found", 404)

  if (subresource === "responses" && pathParts.length === 2 && (method === "POST" || method === "PATCH")) {
    if (!(await permitted(env, userId, "surveys.respond"))) {
      return error("Forbidden", 403)
    }

    if (survey.status !== "published") return error("Survey is not open", 409)

    const nowMs = Date.now()
    if (survey.starts_at && Date.parse(survey.starts_at) > nowMs) {
      return error("Survey has not started", 409)
    }
    if (survey.deadline_at && Date.parse(survey.deadline_at) < nowMs) {
      return error("Survey deadline has passed", 409)
    }

    const body = await readBody<AnswerBody>(request)
    if (!body) return error("Invalid JSON body")

    const textAnswer = body.text_answer === undefined
      ? null
      : requiredString(body.text_answer)
    if (body.text_answer !== undefined && (!textAnswer || textAnswer.length > 10000)) {
      return error("Invalid text_answer")
    }

    const optionIds = body.option_ids === undefined ? [] : body.option_ids
    if (!Array.isArray(optionIds) ||
        !optionIds.every((value) => typeof value === "string") ||
        new Set(optionIds).size !== optionIds.length) {
      return error("Invalid option_ids")
    }

    if (survey.response_type === "free_text") {
      if (!textAnswer || optionIds.length !== 0) {
        return error("A text answer is required")
      }
    } else {
      if (textAnswer !== null || optionIds.length === 0) {
        return error("Select an option")
      }
      if (survey.response_type === "single_choice" && optionIds.length !== 1) {
        return error("Select exactly one option")
      }
      const valid = await env.DB.prepare(`
        SELECT COUNT(*) AS count
        FROM survey_options
        WHERE survey_id = ?
          AND id IN (${optionIds.map(() => "?").join(",")})
      `).bind(surveyId, ...optionIds).first<{ count: number }>()
      if (valid?.count !== optionIds.length) {
        return error("One or more options do not belong to this survey")
      }
    }

    if (method === "PATCH") {
      const participation = await env.DB.prepare(`
        SELECT response_id
        FROM survey_participation
        WHERE survey_id = ? AND user_id = ?
      `).bind(surveyId, userId).first<{ response_id: string | null }>()

      if (!participation) return error("No existing response to edit", 404)

      let responseId = participation.response_id
      if (!responseId && !survey.is_anonymous) {
        const legacyResponse = await env.DB.prepare(`
          SELECT id
          FROM survey_responses
          WHERE survey_id = ? AND respondent_id = ?
          ORDER BY submitted_at DESC
          LIMIT 1
        `).bind(surveyId, userId).first<{ id: string }>()
        responseId = legacyResponse?.id ?? null
      }

      if (!responseId) {
        return error("This historical response cannot be edited", 409)
      }

      const existingResponse = await env.DB.prepare(`
        SELECT id
        FROM survey_responses
        WHERE id = ? AND survey_id = ?
      `).bind(responseId, surveyId).first<{ id: string }>()

      if (!existingResponse) {
        return error("Existing response not found", 404)
      }

      try {
        await env.DB.batch([
          env.DB.prepare(`
            UPDATE survey_responses
            SET text_answer = ?
            WHERE id = ? AND survey_id = ?
          `).bind(textAnswer, responseId, surveyId),
          env.DB.prepare(`
            DELETE FROM survey_response_options
            WHERE response_id = ?
          `).bind(responseId),
          ...optionIds.map((optionId: string) =>
            env.DB.prepare(`
              INSERT INTO survey_response_options (response_id, option_id)
              VALUES (?, ?)
            `).bind(responseId, optionId),
          ),
        ])
      } catch {
        return error("Could not update response", 500)
      }

      return Response.json({ submitted: true, updated: true })
    }

    const responseId = id()
    const respondentId = survey.is_anonymous ? null : userId
    const submittedAt = new Date().toISOString()

    try {
      await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO survey_responses
            (id, survey_id, respondent_id, text_answer, submitted_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(
          responseId, surveyId, respondentId, textAnswer, submittedAt,
        ),
        env.DB.prepare(`
          INSERT INTO survey_participation
            (survey_id, user_id, submitted_at, response_id)
          VALUES (?, ?, ?, ?)
        `).bind(surveyId, userId, submittedAt, responseId),
        ...optionIds.map((optionId: string) =>
          env.DB.prepare(`
            INSERT INTO survey_response_options (response_id, option_id)
            VALUES (?, ?)
          `).bind(responseId, optionId),
        ),
      ])
    } catch {
      try {
        const participation = await env.DB.prepare(`
          SELECT 1 AS submitted
          FROM survey_participation
          WHERE survey_id = ? AND user_id = ?
        `).bind(surveyId, userId).first<{ submitted: number }>()

        if (participation) {
          return error("You have already responded", 409)
        }
      } catch {
        // The database state could not be checked; return a generic failure.
      }

      return error("Could not save response", 500)
    }

    return Response.json({ submitted: true }, { status: 201 })
  }

  if (subresource === "results" && pathParts.length === 2 && method === "GET") {
    if (!(await permitted(env, userId, "surveys.results.view"))) {
      return error("Forbidden", 403)
    }

    const total = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM survey_participation
      WHERE survey_id = ?
    `).bind(surveyId).first<{ count: number }>()

    const options = await env.DB.prepare(`
      SELECT o.id, o.label, o.sort_order, COUNT(ro.response_id) AS count
      FROM survey_options o
      LEFT JOIN survey_response_options ro ON ro.option_id = o.id
      LEFT JOIN survey_responses r
        ON r.id = ro.response_id AND r.survey_id = ?
      WHERE o.survey_id = ?
      GROUP BY o.id, o.label, o.sort_order
      ORDER BY o.sort_order, o.id
    `).bind(surveyId, surveyId).all<{
      id: string
      label: string
      sort_order: number
      count: number
    }>()

    const votersByOption = new Map<string, string[]>()

    if (!survey.is_anonymous && survey.response_type !== "free_text") {
      const voterRows = await env.DB.prepare(`
        SELECT ro.option_id, u.name AS voter_name
        FROM survey_response_options ro
        JOIN survey_responses r
          ON r.id = ro.response_id AND r.survey_id = ?
        JOIN users u ON u.id = r.respondent_id
        WHERE r.survey_id = ?
        ORDER BY ro.option_id, u.name
      `).bind(surveyId, surveyId).all<{
        option_id: string
        voter_name: string
      }>()

      for (const row of voterRows.results) {
        const names = votersByOption.get(row.option_id) ?? []
        names.push(row.voter_name)
        votersByOption.set(row.option_id, names)
      }
    }

    const textAnswers = survey.response_type === "free_text"
      ? await env.DB.prepare(`
          SELECT text_answer
          FROM survey_responses
          WHERE survey_id = ? AND text_answer IS NOT NULL
          ORDER BY submitted_at
        `).bind(surveyId).all<{ text_answer: string }>()
      : { results: [] as { text_answer: string }[] }

    return Response.json({
      survey: {
        id: survey.id,
        title: survey.title,
        response_type: survey.response_type,
        is_anonymous: survey.is_anonymous,
      },
      response_count: total?.count ?? 0,
      options: options.results.map((option) => ({
        ...option,
        ...(!survey.is_anonymous && survey.response_type !== "free_text"
          ? { voters: votersByOption.get(option.id) ?? [] }
          : {}),
      })),
      text_answers: textAnswers.results.map((row) => row.text_answer),
    })
  }

  if (subresource !== undefined) return error("Not Found", 404)

  if (method === "GET" && pathParts.length === 1) {
    if (!(await permitted(env, userId, "surveys.view"))) {
      return error("Forbidden", 403)
    }
    if (survey.status !== "published" && !(await canManage(env, userId))) {
      return error("Survey not found", 404)
    }

    const options = await getOptions(env, surveyId)
    const participation = await env.DB.prepare(`
      SELECT response_id
      FROM survey_participation
      WHERE survey_id = ? AND user_id = ?
    `).bind(surveyId, userId).first<{ response_id: string | null }>()

    let responseId = participation?.response_id ?? null
    if (participation && !responseId && !survey.is_anonymous) {
      const legacyResponse = await env.DB.prepare(`
        SELECT id
        FROM survey_responses
        WHERE survey_id = ? AND respondent_id = ?
        ORDER BY submitted_at DESC
        LIMIT 1
      `).bind(surveyId, userId).first<{ id: string }>()
      responseId = legacyResponse?.id ?? null
    }

    let myResponse: { text_answer: string | null; option_ids: string[] } | null = null
    if (responseId) {
      const responseRow = await env.DB.prepare(`
        SELECT text_answer
        FROM survey_responses
        WHERE id = ? AND survey_id = ?
      `).bind(responseId, surveyId).first<{ text_answer: string | null }>()

      if (responseRow) {
        const selected = await env.DB.prepare(`
          SELECT option_id
          FROM survey_response_options
          WHERE response_id = ?
        `).bind(responseId).all<{ option_id: string }>()

        myResponse = {
          text_answer: responseRow.text_answer,
          option_ids: selected.results.map(row => row.option_id),
        }
      }
    }

    return Response.json({
      survey,
      options,
      has_responded: Boolean(participation),
      response_editable: Boolean(myResponse),
      my_response: myResponse,
    })
  }

  if (method === "PATCH" || method === "PUT") {
    if (!(await permitted(env, userId, "surveys.edit"))) {
      return error("Forbidden", 403)
    }

    const body = await readBody<SurveyBody>(request)
    if (!body) return error("Invalid JSON body")

    const title = body.title === undefined ? survey.title : requiredString(body.title)
    if (!title || title.length > 200) return error("Invalid title")

    const description = optionalString(body.description)
    if (body.description !== undefined && description === undefined) {
      return error("Invalid description")
    }

    const responseType = body.response_type ?? survey.response_type
    if (!["single_choice", "multiple_choice", "free_text"].includes(String(responseType))) {
      return error("Invalid response_type")
    }

    const status = body.status ?? survey.status
    if (!["draft", "published", "closed"].includes(String(status))) {
      return error("Invalid status")
    }

    const anonymous = body.is_anonymous === undefined
      ? survey.is_anonymous
      : body.is_anonymous === true || body.is_anonymous === 1
        ? 1
        : body.is_anonymous === false || body.is_anonymous === 0
          ? 0
          : -1
    if (anonymous === -1) return error("Invalid is_anonymous")

    const startsAt = optionalString(body.starts_at)
    const deadlineAt = optionalString(body.deadline_at)
    if (body.starts_at === undefined && body.deadline_at === undefined) {
      // Keep existing dates when neither field was supplied.
    } else {
      const start = body.starts_at === undefined ? survey.starts_at : startsAt
      const deadline = body.deadline_at === undefined ? survey.deadline_at : deadlineAt
      if (start === undefined || deadline === undefined ||
          !validDate(start) || !validDate(deadline)) {
        return error("Invalid date")
      }
      if (start && deadline && Date.parse(start) > Date.parse(deadline)) {
        return error("starts_at must be before deadline_at")
      }
    }

    const existingResponses = await env.DB.prepare(`
      SELECT COUNT(*) AS count FROM survey_responses WHERE survey_id = ?
    `).bind(surveyId).first<{ count: number }>()
    const hasResponses = (existingResponses?.count ?? 0) > 0

    if (hasResponses && responseType !== survey.response_type) {
      return error("Cannot change response type after responses exist", 409)
    }

    let options: string[] | undefined
    let currentOptions: SurveyOption[] = []
    if (body.options !== undefined) {
      const parsed = parseOptions(body.options)
      if (!parsed) return error("Invalid options")
      options = parsed
      if (responseType === "free_text" && options.length > 0) {
        return error("Free-text surveys cannot have options")
      }
      if (responseType !== "free_text" && options.length < 2) {
        return error("Choice surveys require at least two options")
      }

      if (hasResponses) {
        currentOptions = await getOptions(env, surveyId)
        const currentLabels = currentOptions.map(option => option.label)
        if (
          options.length < currentLabels.length ||
          currentLabels.some((label, index) => options![index] !== label)
        ) {
          return error(
            "Existing options cannot be changed or removed; new options may only be appended",
            409,
          )
        }
      }
    }

    const startValue = body.starts_at === undefined
      ? survey.starts_at
      : startsAt ?? null
    const deadlineValue = body.deadline_at === undefined
      ? survey.deadline_at
      : deadlineAt ?? null

    const statements = [
      env.DB.prepare(`
        UPDATE surveys
        SET title = ?, description = ?, response_type = ?, is_anonymous = ?,
            status = ?, starts_at = ?, deadline_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        title, body.description === undefined ? survey.description : description ?? null,
        responseType, anonymous, status, startValue, deadlineValue,
        new Date().toISOString(), surveyId,
      ),
    ]

    if (options !== undefined) {
      if (hasResponses) {
        for (let index = currentOptions.length; index < options.length; index++) {
          statements.push(env.DB.prepare(`
            INSERT INTO survey_options (id, survey_id, label, sort_order)
            VALUES (?, ?, ?, ?)
          `).bind(id(), surveyId, options[index], index))
        }
      } else {
        statements.push(
          env.DB.prepare("DELETE FROM survey_options WHERE survey_id = ?").bind(surveyId),
        )
        for (let index = 0; index < options.length; index++) {
          statements.push(env.DB.prepare(`
            INSERT INTO survey_options (id, survey_id, label, sort_order)
            VALUES (?, ?, ?, ?)
          `).bind(id(), surveyId, options[index], index))
        }
      }
    }

    await env.DB.batch(statements)
    return Response.json({
      survey: await getSurvey(env, surveyId),
      options: await getOptions(env, surveyId),
    })
  }

  if (method === "DELETE") {
    if (!(await permitted(env, userId, "surveys.delete"))) {
      return error("Forbidden", 403)
    }
    await env.DB.prepare("DELETE FROM surveys WHERE id = ?")
      .bind(surveyId).run()
    return Response.json({ deleted: true })
  }

  return error("Method Not Allowed", 405)
}
