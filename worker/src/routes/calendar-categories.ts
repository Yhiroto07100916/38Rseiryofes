import { hasPermission, requireAuth } from "../lib/authz"

export interface CalendarCategory {
  id: string
  name: string
  color: string
  sort_order: number
  is_active: number
  created_at: string
  updated_at: string
}

interface CreateCalendarCategoryBody {
  name?: unknown
  color?: unknown
  sort_order?: unknown
  is_active?: unknown
}

interface UpdateCalendarCategoryBody {
  name?: unknown
  color?: unknown
  sort_order?: unknown
  is_active?: unknown
}

function generateId(): string {
  return crypto.randomUUID()
}

function isValidColor(value: unknown): value is string {
  if (typeof value !== "string") {
    return false
  }

  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

function normalizeIsActive(value: unknown): number {
  if (value === false || value === 0 || value === "0") {
    return 0
  }

  return 1
}

function normalizeSortOrder(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)

    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed)
    }
  }

  return 0
}

async function getCategory(
  env: Env,
  categoryId: string,
): Promise<CalendarCategory | null> {
  return await env.DB
    .prepare(`
      SELECT
        id,
        name,
        color,
        sort_order,
        is_active,
        created_at,
        updated_at
      FROM calendar_categories
      WHERE id = ?
    `)
    .bind(categoryId)
    .first<CalendarCategory>()
}

export async function handleCalendarCategories(
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
    pathParts.length === 0
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.view"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.view" },
        { status: 403 },
      )
    }

    const result = await env.DB
      .prepare(`
        SELECT
          id,
          name,
          color,
          sort_order,
          is_active,
          created_at,
          updated_at
        FROM calendar_categories
        ORDER BY sort_order ASC, name ASC, id ASC
      `)
      .all<CalendarCategory>()

    return Response.json({
      categories: result.results,
    })
  }

  if (
    request.method === "GET" &&
    pathParts.length === 1
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.view"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.view" },
        { status: 403 },
      )
    }

    const category = await getCategory(env, pathParts[0])

    if (!category) {
      return Response.json(
        { error: "Calendar category not found" },
        { status: 404 },
      )
    }

    return Response.json(category)
  }

  if (
    request.method === "POST" &&
    pathParts.length === 0
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.edit"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.edit" },
        { status: 403 },
      )
    }

    let body: CreateCalendarCategoryBody

    try {
      body = await request.json<CreateCalendarCategoryBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
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

    if (!isValidColor(body.color)) {
      return Response.json(
        { error: "color must be a valid hex color" },
        { status: 400 },
      )
    }

    const id = generateId()
    const now = new Date().toISOString()
    const sortOrder = normalizeSortOrder(body.sort_order)
    const isActive = normalizeIsActive(body.is_active)

    await env.DB
      .prepare(`
        INSERT INTO calendar_categories (
          id,
          name,
          color,
          sort_order,
          is_active,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        body.name.trim(),
        body.color,
        sortOrder,
        isActive,
        now,
        now,
      )
      .run()

    const category = await getCategory(env, id)

    return Response.json(category, { status: 201 })
  }

  if (
    request.method === "PATCH" &&
    pathParts.length === 1
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.edit"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.edit" },
        { status: 403 },
      )
    }

    const categoryId = pathParts[0]
    const existing = await getCategory(env, categoryId)

    if (!existing) {
      return Response.json(
        { error: "Calendar category not found" },
        { status: 404 },
      )
    }

    let body: UpdateCalendarCategoryBody

    try {
      body = await request.json<UpdateCalendarCategoryBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      )
    }

    const name =
      body.name === undefined
        ? existing.name
        : typeof body.name === "string" && body.name.trim() !== ""
          ? body.name.trim()
          : null

    if (!name) {
      return Response.json(
        { error: "name must not be empty" },
        { status: 400 },
      )
    }

    const color =
      body.color === undefined
        ? existing.color
        : body.color

    if (!isValidColor(color)) {
      return Response.json(
        { error: "color must be a valid hex color" },
        { status: 400 },
      )
    }

    const sortOrder =
      body.sort_order === undefined
        ? existing.sort_order
        : normalizeSortOrder(body.sort_order)

    const isActive =
      body.is_active === undefined
        ? existing.is_active
        : normalizeIsActive(body.is_active)

    const now = new Date().toISOString()

    await env.DB
      .prepare(`
        UPDATE calendar_categories
        SET
          name = ?,
          color = ?,
          sort_order = ?,
          is_active = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(
        name,
        color,
        sortOrder,
        isActive,
        now,
        categoryId,
      )
      .run()

    const category = await getCategory(env, categoryId)

    return Response.json(category)
  }

  if (
    request.method === "DELETE" &&
    pathParts.length === 1
  ) {
    if (!(await hasPermission(env, auth.user.id, "schedule.delete"))) {
      return Response.json(
        { error: "Forbidden", permission: "schedule.delete" },
        { status: 403 },
      )
    }

    const categoryId = pathParts[0]
    const existing = await getCategory(env, categoryId)

    if (!existing) {
      return Response.json(
        { error: "Calendar category not found" },
        { status: 404 },
      )
    }

    const eventCount = await env.DB
      .prepare(`
        SELECT COUNT(*) AS count
        FROM calendar_events
        WHERE category_id = ?
      `)
      .bind(categoryId)
      .first<{ count: number }>()

    if ((eventCount?.count ?? 0) > 0) {
      return Response.json(
        {
          error: "Calendar category is in use",
          event_count: eventCount?.count ?? 0,
        },
        { status: 409 },
      )
    }

    await env.DB
      .prepare(`
        DELETE FROM calendar_categories
        WHERE id = ?
      `)
      .bind(categoryId)
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
