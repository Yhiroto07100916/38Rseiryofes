import { hasPermission, requireAuth } from "../lib/authz"

export interface CalendarEvent {
  id: string
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
  is_all_day: number
  location: string | null
  color: string | null
  category_id: string | null
  category_name: string | null
  category_color: string | null
  created_by: string
  created_at: string
  updated_at: string
}

interface CreateCalendarEventBody {
  title?: unknown
  description?: unknown
  starts_at?: unknown
  ends_at?: unknown
  is_all_day?: unknown
  location?: unknown
  category_id?: unknown
  color?: unknown
}

interface UpdateCalendarEventBody {
  title?: unknown
  description?: unknown
  starts_at?: unknown
  ends_at?: unknown
  is_all_day?: unknown
  location?: unknown
  category_id?: unknown
  color?: unknown
}

interface CalendarCategoryRow {
  id: string
  name: string
  color: string
  is_active: number
}

function generateId(): string {
  return crypto.randomUUID()
}

function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    return false
  }

  return !Number.isNaN(Date.parse(value))
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  return typeof value === "string" ? value : null
}

function normalizeIsAllDay(value: unknown): number {
  if (value === true || value === 1 || value === "1") {
    return 1
  }

  return 0
}

async function getCalendarCategory(
  env: Env,
  categoryId: string,
): Promise<CalendarCategoryRow | null> {
  return await env.DB
    .prepare(`
      SELECT
        id,
        name,
        color,
        is_active
      FROM calendar_categories
      WHERE id = ?
    `)
    .bind(categoryId)
    .first<CalendarCategoryRow>()
}

async function getCalendarEvent(
  env: Env,
  eventId: string,
): Promise<CalendarEvent | null> {
  return await env.DB
    .prepare(`
      SELECT
        e.id,
        e.title,
        e.description,
        e.starts_at,
        e.ends_at,
        e.is_all_day,
        e.location,
        COALESCE(c.color, e.color) AS color,
        e.category_id,
        c.name AS category_name,
        c.color AS category_color,
        e.created_by,
        e.created_at,
        e.updated_at
      FROM calendar_events e
      LEFT JOIN calendar_categories c
        ON c.id = e.category_id
      WHERE e.id = ?
    `)
    .bind(eventId)
    .first<CalendarEvent>()
}

async function validateCategory(
  env: Env,
  categoryId: string | null,
): Promise<{ category: CalendarCategoryRow | null; error: Response | null }> {
  if (categoryId === null) {
    return { category: null, error: null }
  }

  const category = await getCalendarCategory(env, categoryId)

  if (!category) {
    return {
      category: null,
      error: Response.json(
        { error: "Calendar category not found" },
        { status: 400 },
      ),
    }
  }

  if (category.is_active !== 1) {
    return {
      category: null,
      error: Response.json(
        { error: "Calendar category is inactive" },
        { status: 400 },
      ),
    }
  }

  return { category, error: null }
}

export async function handleCalendar(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  if (
    request.method === "GET" &&
    pathParts.length === 1 &&
    pathParts[0] === "events"
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.view"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.view" },
        { status: 403 },
      )
    }

    const url = new URL(request.url)
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")

    if (!from || !to || !isValidDateString(from) || !isValidDateString(to)) {
      return Response.json(
        { error: "from and to are required valid dates" },
        { status: 400 },
      )
    }

    const result = await env.DB
      .prepare(`
        SELECT
          e.id,
          e.title,
          e.description,
          e.starts_at,
          e.ends_at,
          e.is_all_day,
          e.location,
          COALESCE(c.color, e.color) AS color,
          e.category_id,
          c.name AS category_name,
          c.color AS category_color,
          e.created_by,
          e.created_at,
          e.updated_at
        FROM calendar_events e
        LEFT JOIN calendar_categories c
          ON c.id = e.category_id
        WHERE e.starts_at < ?
          AND (e.ends_at IS NULL OR e.ends_at >= ?)
        ORDER BY e.starts_at ASC, e.id ASC
      `)
      .bind(to, from)
      .all<CalendarEvent>()

    return Response.json({
      events: result.results,
    })
  }

  if (
    request.method === "GET" &&
    pathParts.length === 3 &&
    pathParts[0] === "events" &&
    pathParts[2] === "attendance"
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.view"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.view" },
        { status: 403 },
      )
    }

    const eventId = pathParts[1]

    const event = await getCalendarEvent(env, eventId)

    if (!event) {
      return Response.json(
        { error: "Calendar event not found" },
        { status: 404 },
      )
    }

    const result = await env.DB
      .prepare(`
        SELECT
          status,
          COUNT(*) AS count
        FROM calendar_event_attendance
        WHERE event_id = ?
        GROUP BY status
      `)
      .bind(eventId)
      .all<{
        status: "attending" | "not_attending" | "undecided"
        count: number
      }>()

    const counts = {
      attending: 0,
      not_attending: 0,
      undecided: 0,
    }

    for (const row of result.results) {
      counts[row.status] = Number(row.count)
    }

    const mine = await env.DB
      .prepare(`
        SELECT status
        FROM calendar_event_attendance
        WHERE event_id = ?
          AND user_id = ?
        LIMIT 1
      `)
      .bind(eventId, auth.user.id)
      .first<{
        status: "attending" | "not_attending" | "undecided"
      }>()

    return Response.json({
      event_id: eventId,
      my_status: mine?.status ?? null,
      counts,
    })
  }

  if (
    request.method === "PUT" &&
    pathParts.length === 3 &&
    pathParts[0] === "events" &&
    pathParts[2] === "attendance"
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.attendance"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.attendance" },
        { status: 403 },
      )
    }

    const eventId = pathParts[1]

    const event = await getCalendarEvent(env, eventId)

    if (!event) {
      return Response.json(
        { error: "Calendar event not found" },
        { status: 404 },
      )
    }

    let body: {
      status?: unknown
    }

    try {
      body = await request.json<{
        status?: unknown
      }>()
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      )
    }

    const status = body.status

    if (
      status !== "attending" &&
      status !== "not_attending" &&
      status !== "undecided"
    ) {
      return Response.json(
        {
          error: "status must be attending, not_attending, or undecided",
        },
        { status: 400 },
      )
    }

    const now = new Date().toISOString()

    await env.DB
      .prepare(`
        INSERT INTO calendar_event_attendance (
          event_id,
          user_id,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(event_id, user_id)
        DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at
      `)
      .bind(
        eventId,
        auth.user.id,
        status,
        now,
        now,
      )
      .run()

    const result = await env.DB
      .prepare(`
        SELECT
          status,
          COUNT(*) AS count
        FROM calendar_event_attendance
        WHERE event_id = ?
        GROUP BY status
      `)
      .bind(eventId)
      .all<{
        status: "attending" | "not_attending" | "undecided"
        count: number
      }>()

    const counts = {
      attending: 0,
      not_attending: 0,
      undecided: 0,
    }

    for (const row of result.results) {
      counts[row.status] = Number(row.count)
    }

    return Response.json({
      event_id: eventId,
      my_status: status,
      counts,
    })
  }

  if (
    request.method === "GET" &&
    pathParts.length === 2 &&
    pathParts[0] === "events"
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.view"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.view" },
        { status: 403 },
      )
    }

    const event = await getCalendarEvent(env, pathParts[1])

    if (!event) {
      return Response.json(
        { error: "Calendar event not found" },
        { status: 404 },
      )
    }

    return Response.json(event)
  }

  if (
    request.method === "POST" &&
    pathParts.length === 1 &&
    pathParts[0] === "events"
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.create"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.create" },
        { status: 403 },
      )
    }

    let body: CreateCalendarEventBody

    try {
      body = await request.json<CreateCalendarEventBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      )
    }

    if (
      typeof body.title !== "string" ||
      body.title.trim() === "" ||
      !isValidDateString(body.starts_at)
    ) {
      return Response.json(
        { error: "title and starts_at are required" },
        { status: 400 },
      )
    }

    if (
      body.ends_at !== undefined &&
      body.ends_at !== null &&
      body.ends_at !== "" &&
      !isValidDateString(body.ends_at)
    ) {
      return Response.json(
        { error: "ends_at must be a valid date" },
        { status: 400 },
      )
    }

    if (
      body.ends_at &&
      Date.parse(body.ends_at as string) < Date.parse(body.starts_at)
    ) {
      return Response.json(
        { error: "ends_at must be after starts_at" },
        { status: 400 },
      )
    }

    const categoryId = normalizeNullableString(body.category_id)
    const { category, error: categoryError } = await validateCategory(
      env,
      categoryId,
    )

    if (categoryError) {
      return categoryError
    }

    const id = generateId()
    const now = new Date().toISOString()
    const description = normalizeNullableString(body.description)
    const endsAt = normalizeNullableString(body.ends_at)
    const location = normalizeNullableString(body.location)
    const legacyColor = normalizeNullableString(body.color)
    const color = category?.color ?? legacyColor
    const isAllDay = normalizeIsAllDay(body.is_all_day)

    await env.DB
      .prepare(`
        INSERT INTO calendar_events (
          id,
          title,
          description,
          starts_at,
          ends_at,
          is_all_day,
          location,
          color,
          category_id,
          created_by,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        body.title.trim(),
        description,
        body.starts_at,
        endsAt,
        isAllDay,
        location,
        color,
        categoryId,
        auth.user.id,
        now,
        now,
      )
      .run()

    const event = await getCalendarEvent(env, id)

    return Response.json(event, { status: 201 })
  }

  if (
    request.method === "PATCH" &&
    pathParts.length === 2 &&
    pathParts[0] === "events"
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.edit"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.edit" },
        { status: 403 },
      )
    }

    const eventId = pathParts[1]
    const existing = await getCalendarEvent(env, eventId)

    if (!existing) {
      return Response.json(
        { error: "Calendar event not found" },
        { status: 404 },
      )
    }

    let body: UpdateCalendarEventBody

    try {
      body = await request.json<UpdateCalendarEventBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      )
    }

    const title =
      body.title === undefined
        ? existing.title
        : typeof body.title === "string" && body.title.trim() !== ""
          ? body.title.trim()
          : null

    if (!title) {
      return Response.json(
        { error: "title must not be empty" },
        { status: 400 },
      )
    }

    const startsAt =
      body.starts_at === undefined
        ? existing.starts_at
        : body.starts_at

    if (!isValidDateString(startsAt)) {
      return Response.json(
        { error: "starts_at must be a valid date" },
        { status: 400 },
      )
    }

    const endsAt =
      body.ends_at === undefined
        ? existing.ends_at
        : normalizeNullableString(body.ends_at)

    if (endsAt !== null && !isValidDateString(endsAt)) {
      return Response.json(
        { error: "ends_at must be a valid date" },
        { status: 400 },
      )
    }

    if (
      endsAt !== null &&
      Date.parse(endsAt) < Date.parse(startsAt)
    ) {
      return Response.json(
        { error: "ends_at must be after starts_at" },
        { status: 400 },
      )
    }

    const description =
      body.description === undefined
        ? existing.description
        : normalizeNullableString(body.description)

    const location =
      body.location === undefined
        ? existing.location
        : normalizeNullableString(body.location)

    const categoryId =
      body.category_id === undefined
        ? existing.category_id
        : normalizeNullableString(body.category_id)

    const { category, error: categoryError } = await validateCategory(
      env,
      categoryId,
    )

    if (categoryError) {
      return categoryError
    }

    const legacyColor =
      body.color === undefined
        ? existing.color
        : normalizeNullableString(body.color)

    const color = category?.color ?? legacyColor

    const isAllDay =
      body.is_all_day === undefined
        ? existing.is_all_day
        : normalizeIsAllDay(body.is_all_day)

    const updatedAt = new Date().toISOString()

    await env.DB
      .prepare(`
        UPDATE calendar_events
        SET
          title = ?,
          description = ?,
          starts_at = ?,
          ends_at = ?,
          is_all_day = ?,
          location = ?,
          color = ?,
          category_id = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(
        title,
        description,
        startsAt,
        endsAt,
        isAllDay,
        location,
        color,
        categoryId,
        updatedAt,
        eventId,
      )
      .run()

    const event = await getCalendarEvent(env, eventId)

    return Response.json(event)
  }

  if (
    request.method === "DELETE" &&
    pathParts.length === 2 &&
    pathParts[0] === "events"
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.delete"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.delete" },
        { status: 403 },
      )
    }

    const eventId = pathParts[1]
    const existing = await getCalendarEvent(env, eventId)

    if (!existing) {
      return Response.json(
        { error: "Calendar event not found" },
        { status: 404 },
      )
    }

    await env.DB
      .prepare(`
        DELETE FROM calendar_events
        WHERE id = ?
      `)
      .bind(eventId)
      .run()

    return Response.json({
      success: true,
    })
  }

  return Response.json(
    { error: "Not Found" },
    { status: 404 },
  )
}
