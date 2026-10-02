import { hasPermission, requireAuth } from "../lib/authz"

export interface News {
  id: string
  title: string
  detail: string
  author: string
  is_important: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface NewsCalendarEvent {
  id: string
  title: string
  starts_at: string
  ends_at: string | null
  is_all_day: number
  location: string | null
  color: string | null
  category_id: string | null
  category_name: string | null
  category_color: string | null
}

export interface NewsTask {
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

export interface NewsAttachment {
  id: string
  news_id: string
  file_name: string
  file_key: string
  content_type: string | null
  file_size: number | null
  created_at: string
}

interface NewsWithCalendarEvents extends News {
  calendar_events: NewsCalendarEvent[]
  tasks: NewsTask[]
  attachments: NewsAttachment[]
}

interface CreateNewsBody {
  title?: unknown
  detail?: unknown
  author?: unknown
  is_important?: unknown
  calendar_event_ids?: unknown
  task_ids?: unknown
}

interface UpdateNewsBody {
  title?: unknown
  detail?: unknown
  author?: unknown
  is_important?: unknown
  calendar_event_ids?: unknown
  task_ids?: unknown
}

function generateId(): string {
  return crypto.randomUUID()
}

function normalizeRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()

  return normalized === "" ? null : normalized
}

function normalizeBooleanNumber(value: unknown): number {
  if (value === true || value === 1 || value === "1") {
    return 1
  }

  return 0
}

function normalizeCalendarEventIds(
  value: unknown,
): string[] | null {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return null
  }

  const ids = value
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean)

  if (ids.length !== value.length) {
    return null
  }

  return [...new Set(ids)]
}

function normalizeTaskIds(
  value: unknown,
): string[] | null {
  if (value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    return null
  }

  const ids = value
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean)

  if (ids.length !== value.length) {
    return null
  }

  return [...new Set(ids)]
}

async function getNews(
  env: Env,
  newsId: string,
): Promise<NewsWithCalendarEvents | null> {
  const news = await env.DB
    .prepare(`
      SELECT
        id,
        title,
        detail,
        author,
        is_important,
        created_by,
        created_at,
        updated_at
      FROM news
      WHERE id = ?
    `)
    .bind(newsId)
    .first<News>()

  if (!news) {
    return null
  }

  const calendarEvents = await env.DB
    .prepare(`
      SELECT
        e.id,
        e.title,
        e.starts_at,
        e.ends_at,
        e.is_all_day,
        e.location,
        COALESCE(c.color, e.color) AS color,
        e.category_id,
        c.name AS category_name,
        c.color AS category_color
      FROM news_calendar_events nce
      INNER JOIN calendar_events e
        ON e.id = nce.event_id
      LEFT JOIN calendar_categories c
        ON c.id = e.category_id
      WHERE nce.news_id = ?
      ORDER BY e.starts_at ASC, e.id ASC
    `)
    .bind(newsId)
    .all<NewsCalendarEvent>()

  const tasks = await env.DB
    .prepare(`
      SELECT
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
      FROM news_tasks nt
      INNER JOIN tasks t
        ON t.id = nt.task_id
      WHERE nt.news_id = ?
      ORDER BY
        CASE t.status
          WHEN 'todo' THEN 0
          WHEN 'in_progress' THEN 1
          WHEN 'review' THEN 2
          WHEN 'done' THEN 3
          ELSE 4
        END,
        CASE t.due_at
          WHEN NULL THEN 1
          ELSE 0
        END,
        t.due_at ASC,
        t.id ASC
    `)
    .bind(newsId)
    .all<NewsTask>()

  const attachments = await env.DB
    .prepare(`
      SELECT
        id,
        news_id,
        file_name,
        file_key,
        content_type,
        file_size,
        created_at
      FROM news_attachments
      WHERE news_id = ?
      ORDER BY created_at ASC, id ASC
    `)
    .bind(newsId)
    .all<NewsAttachment>()

  return {
    ...news,
    calendar_events: calendarEvents.results,
    tasks: tasks.results,
    attachments: attachments.results,
  }
}

async function validateCalendarEventIds(
  env: Env,
  eventIds: string[],
): Promise<Response | null> {
  if (eventIds.length === 0) {
    return null
  }

  const placeholders = eventIds.map(() => "?").join(", ")

  const result = await env.DB
    .prepare(`
      SELECT id
      FROM calendar_events
      WHERE id IN (${placeholders})
    `)
    .bind(...eventIds)
    .all<{ id: string }>()

  const existingIds = new Set(
    result.results.map((row) => row.id),
  )

  const missingIds = eventIds.filter(
    (id) => !existingIds.has(id),
  )

  if (missingIds.length > 0) {
    return Response.json(
      {
        error: "Calendar event not found",
        event_ids: missingIds,
      },
      { status: 400 },
    )
  }

  return null
}

async function validateTaskIds(
  env: Env,
  taskIds: string[],
): Promise<Response | null> {
  if (taskIds.length === 0) {
    return null
  }

  const placeholders = taskIds.map(() => "?").join(", ")

  const result = await env.DB
    .prepare(`
      SELECT id
      FROM tasks
      WHERE id IN (${placeholders})
    `)
    .bind(...taskIds)
    .all<{ id: string }>()

  const existingIds = new Set(
    result.results.map((row) => row.id),
  )

  const missingIds = taskIds.filter(
    (id) => !existingIds.has(id),
  )

  if (missingIds.length > 0) {
    return Response.json(
      {
        error: "Task not found",
        task_ids: missingIds,
      },
      { status: 400 },
    )
  }

  return null
}

async function replaceTaskLinks(
  env: Env,
  newsId: string,
  taskIds: string[],
): Promise<void> {
  const statements = [
    env.DB
      .prepare(`
        DELETE FROM news_tasks
        WHERE news_id = ?
      `)
      .bind(newsId),
  ]

  for (const taskId of taskIds) {
    statements.push(
      env.DB
        .prepare(`
          INSERT INTO news_tasks (
            news_id,
            task_id
          )
          VALUES (?, ?)
        `)
        .bind(newsId, taskId),
    )
  }

  await env.DB.batch(statements)
}

async function replaceCalendarEventLinks(
  env: Env,
  newsId: string,
  eventIds: string[],
): Promise<void> {
  const statements = [
    env.DB
      .prepare(`
        DELETE FROM news_calendar_events
        WHERE news_id = ?
      `)
      .bind(newsId),
  ]

  for (const eventId of eventIds) {
    statements.push(
      env.DB
        .prepare(`
          INSERT INTO news_calendar_events (
            news_id,
            event_id
          )
          VALUES (?, ?)
        `)
        .bind(newsId, eventId),
    )
  }

  await env.DB.batch(statements)
}

export async function handleNews(
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
    if (!(await hasPermission(env, auth.user.id, "news.view"))) {
      return Response.json(
        {
          error: "Forbidden",
          permission: "news.view",
        },
        { status: 403 },
      )
    }

    const result = await env.DB
      .prepare(`
        SELECT
          id,
          title,
          detail,
          author,
          is_important,
          created_by,
          created_at,
          updated_at
        FROM news
        ORDER BY created_at DESC, id DESC
      `)
      .all<News>()

    return Response.json({
      news: result.results,
    })
  }

  if (
    request.method === "GET" &&
    pathParts.length === 1
  ) {
    if (!(await hasPermission(env, auth.user.id, "news.view"))) {
      return Response.json(
        {
          error: "Forbidden",
          permission: "news.view",
        },
        { status: 403 },
      )
    }

    const newsId = pathParts[0]
    const news = await getNews(env, newsId)

    if (!news) {
      return Response.json(
        { error: "News not found" },
        { status: 404 },
      )
    }

    return Response.json(news)
  }

  if (
    request.method === "POST" &&
    pathParts.length === 0
  ) {
    if (!(await hasPermission(env, auth.user.id, "news.create"))) {
      return Response.json(
        {
          error: "Forbidden",
          permission: "news.create",
        },
        { status: 403 },
      )
    }

    let body: CreateNewsBody

    try {
      body = await request.json<CreateNewsBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      )
    }

    const title = normalizeRequiredString(body.title)
    const detail = normalizeRequiredString(body.detail)
    const author = normalizeRequiredString(body.author)
    const isImportant = normalizeBooleanNumber(body.is_important)
    const calendarEventIds = normalizeCalendarEventIds(
      body.calendar_event_ids,
    )
    const taskIds = normalizeTaskIds(body.task_ids)

    if (!title || !detail || !author) {
      return Response.json(
        {
          error: "title, detail and author are required",
        },
        { status: 400 },
      )
    }

    if (title.length > 100) {
      return Response.json(
        { error: "title must be 100 characters or less" },
        { status: 400 },
      )
    }

    if (author.length > 100) {
      return Response.json(
        { error: "author must be 100 characters or less" },
        { status: 400 },
      )
    }

    if (detail.length > 10000) {
      return Response.json(
        { error: "detail must be 10000 characters or less" },
        { status: 400 },
      )
    }

    if (calendarEventIds === null) {
      return Response.json(
        {
          error: "calendar_event_ids must be an array of strings",
        },
        { status: 400 },
      )
    }

    if (taskIds === null) {
      return Response.json(
        {
          error: "task_ids must be an array of strings",
        },
        { status: 400 },
      )
    }

    const taskValidationError =
      await validateTaskIds(
        env,
        taskIds,
      )

    if (taskValidationError) {
      return taskValidationError
    }

    const calendarValidationError =
      await validateCalendarEventIds(
        env,
        calendarEventIds,
      )

    if (calendarValidationError) {
      return calendarValidationError
    }

    const newsId = generateId()

    await env.DB
      .prepare(`
        INSERT INTO news (
          id,
          title,
          detail,
          author,
          is_important,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        newsId,
        title,
        detail,
        author,
        isImportant,
        auth.user.id,
      )
      .run()

    await replaceCalendarEventLinks(
      env,
      newsId,
      calendarEventIds,
    )

    await replaceTaskLinks(
      env,
      newsId,
      taskIds,
    )

    const news = await getNews(env, newsId)

    return Response.json(news, { status: 201 })
  }

  if (
    request.method === "PATCH" &&
    pathParts.length === 1
  ) {
    if (!(await hasPermission(env, auth.user.id, "news.edit"))) {
      return Response.json(
        {
          error: "Forbidden",
          permission: "news.edit",
        },
        { status: 403 },
      )
    }

    const newsId = pathParts[0]

    const existingNews = await getNews(env, newsId)

    if (!existingNews) {
      return Response.json(
        { error: "News not found" },
        { status: 404 },
      )
    }

    let body: UpdateNewsBody

    try {
      body = await request.json<UpdateNewsBody>()
    } catch {
      return Response.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      )
    }

    const title =
      body.title === undefined
        ? existingNews.title
        : normalizeRequiredString(body.title)

    const detail =
      body.detail === undefined
        ? existingNews.detail
        : normalizeRequiredString(body.detail)

    const author =
      body.author === undefined
        ? existingNews.author
        : normalizeRequiredString(body.author)

    const isImportant =
      body.is_important === undefined
        ? existingNews.is_important
        : normalizeBooleanNumber(body.is_important)

    const calendarEventIds =
      body.calendar_event_ids === undefined
        ? existingNews.calendar_events.map(
            (event) => event.id,
          )
        : normalizeCalendarEventIds(
            body.calendar_event_ids,
          )

    const taskIds =
      body.task_ids === undefined
        ? existingNews.tasks.map(
            (task) => task.id,
          )
        : normalizeTaskIds(body.task_ids)

    if (!title || !detail || !author) {
      return Response.json(
        {
          error: "title, detail and author are required",
        },
        { status: 400 },
      )
    }

    if (title.length > 100) {
      return Response.json(
        { error: "title must be 100 characters or less" },
        { status: 400 },
      )
    }

    if (author.length > 100) {
      return Response.json(
        { error: "author must be 100 characters or less" },
        { status: 400 },
      )
    }

    if (detail.length > 10000) {
      return Response.json(
        { error: "detail must be 10000 characters or less" },
        { status: 400 },
      )
    }

    if (calendarEventIds === null) {
      return Response.json(
        {
          error: "calendar_event_ids must be an array of strings",
        },
        { status: 400 },
      )
    }

    if (taskIds === null) {
      return Response.json(
        {
          error: "task_ids must be an array of strings",
        },
        { status: 400 },
      )
    }

    const taskValidationError =
      await validateTaskIds(
        env,
        taskIds,
      )

    if (taskValidationError) {
      return taskValidationError
    }

    const calendarValidationError =
      await validateCalendarEventIds(
        env,
        calendarEventIds,
      )

    if (calendarValidationError) {
      return calendarValidationError
    }

    await env.DB
      .prepare(`
        UPDATE news
        SET
          title = ?,
          detail = ?,
          author = ?,
          is_important = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .bind(
        title,
        detail,
        author,
        isImportant,
        newsId,
      )
      .run()

    await replaceCalendarEventLinks(
      env,
      newsId,
      calendarEventIds,
    )

    await replaceTaskLinks(
      env,
      newsId,
      taskIds,
    )

    const news = await getNews(env, newsId)

    return Response.json(news)
  }

  if (
    request.method === "DELETE" &&
    pathParts.length === 1
  ) {
    if (!(await hasPermission(env, auth.user.id, "news.delete"))) {
      return Response.json(
        {
          error: "Forbidden",
          permission: "news.delete",
        },
        { status: 403 },
      )
    }

    const newsId = pathParts[0]

    const existingNews = await getNews(env, newsId)

    if (!existingNews) {
      return Response.json(
        { error: "News not found" },
        { status: 404 },
      )
    }

    await env.DB
      .prepare(`
        DELETE FROM news
        WHERE id = ?
      `)
      .bind(newsId)
      .run()

    return Response.json({
      success: true,
      id: newsId,
    })
  }

  return Response.json(
    { error: "Not Found" },
    { status: 404 },
  )
}
