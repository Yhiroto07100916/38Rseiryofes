import { requireAuth } from "../lib/authz"

const NOTIFICATION_CATEGORIES = [
  "tasks",
  "calendar",
  "submissions",
  "news",
  "surveys",
  "decisions",
  "equipment",
  "tool_rental",
  "accounting",
  "files",
  "milk_collection",
  "wishlist",
  "account_admin",
] as const

type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number]
type NotificationRow = {
  id: string
  event_key: string
  category: string
  title: string
  body: string
  target_url: string | null
  actor_user_id: string | null
  entity_type: string | null
  entity_id: string | null
  is_read: number
  read_updated_at: string
  read_version: number
  created_at: string
  expires_at: string
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

function isCategory(value: unknown): value is NotificationCategory {
  return typeof value === "string" &&
    NOTIFICATION_CATEGORIES.includes(value as NotificationCategory)
}

async function purgeExpiredNotifications(env: Env, userId: string): Promise<void> {
  await env.DB.prepare(
    "DELETE FROM notifications WHERE recipient_user_id = ? AND expires_at <= CURRENT_TIMESTAMP",
  ).bind(userId).run()
}

export async function purgeAllExpiredNotifications(env: Env): Promise<number> {
  const result = await env.DB.prepare(
    "DELETE FROM notifications WHERE expires_at <= CURRENT_TIMESTAMP",
  ).run()
  return result.meta?.changes ?? 0
}

export async function handleNotifications(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const userId = auth.user.id
  const method = request.method.toUpperCase()

  if (pathParts.length === 0 && method === "GET") {
    await purgeExpiredNotifications(env, userId)

    const url = new URL(request.url)
    const requestedLimit = Number(url.searchParams.get("limit") || 20)
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(20, Math.floor(requestedLimit)))
      : 20
    const categoryValues = [...new Set(url.searchParams.getAll("category")
      .flatMap(value => value.split(","))
      .map(value => value.trim())
      .filter(isCategory))]
    const readState = url.searchParams.get("read")
    const search = (url.searchParams.get("search") || "").trim().slice(0, 100)
    const beforeCreatedAt = url.searchParams.get("before_created_at")
    const beforeId = url.searchParams.get("before_id")
    const knownIds = [...new Set((url.searchParams.get("known_ids") ?? "").split(",").filter(id => id.length > 0 && id.length <= 64))].slice(0, 100)

    const conditions = ["recipient_user_id = ?"]
    const bindings: (string | number)[] = [userId]

    if (categoryValues.length > 0) {
      conditions.push("category IN (" + categoryValues.map(() => "?").join(", ") + ")")
      bindings.push(...Array.from(new Set(categoryValues)))
    }

    if (readState === "unread") conditions.push("is_read = 0")
    if (readState === "read") conditions.push("is_read = 1")

    if (search) {
      const categoryLabel = "CASE category " +
        "WHEN 'tasks' THEN 'タスク' " +
        "WHEN 'calendar' THEN 'カレンダー' " +
        "WHEN 'submissions' THEN '提出物' " +
        "WHEN 'news' THEN 'お知らせ' " +
        "WHEN 'surveys' THEN 'アンケート' " +
        "WHEN 'decisions' THEN '意思決定' " +
        "WHEN 'equipment' THEN '備品' " +
        "WHEN 'tool_rental' THEN '工具貸出' " +
        "WHEN 'accounting' THEN '会計' " +
        "WHEN 'files' THEN 'ファイル' " +
        "WHEN 'milk_collection' THEN '牛乳パック' " +
        "WHEN 'wishlist' THEN 'ほしい物リスト' " +
        "WHEN 'account_admin' THEN 'アカウント' ELSE category END"
      conditions.push("(LOWER(title) LIKE ? OR LOWER(body) LIKE ? OR LOWER(category) LIKE ? OR " + categoryLabel + " LIKE ?)")
      const pattern = "%" + search.toLocaleLowerCase() + "%"
      bindings.push(pattern, pattern, pattern, pattern)
    }

    if (beforeCreatedAt && beforeId) {
      conditions.push("(created_at < ? OR (created_at = ? AND id < ?))")
      bindings.push(beforeCreatedAt, beforeCreatedAt, beforeId)
    }

    const rows = await env.DB.prepare(
      "SELECT id, event_key, category, title, body, target_url, actor_user_id, entity_type, entity_id, is_read, " +
      "COALESCE(read_updated_at, created_at) AS read_updated_at, read_version, created_at, expires_at " +
      "FROM notifications WHERE " + conditions.join(" AND ") +
      " ORDER BY created_at DESC, id DESC LIMIT ?",
    ).bind(...bindings, limit + 1).all<NotificationRow>()

    const hasMore = rows.results.length > limit
    const notifications = rows.results.slice(0, limit)
    const last = notifications[notifications.length - 1]
    const unread = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notifications WHERE recipient_user_id = ? AND is_read = 0",
    ).bind(userId).first<{ count: number }>()
    const knownNotifications = knownIds.length > 0
      ? await env.DB.prepare(
          "SELECT id, is_read, COALESCE(read_updated_at, created_at) AS read_updated_at, read_version " +
          "FROM notifications WHERE recipient_user_id = ? AND id IN (" +
          knownIds.map(() => "?").join(", ") + ")",
        ).bind(userId, ...knownIds).all<{ id: string; is_read: number; read_updated_at: string; read_version: number }>()
      : { results: [] as { id: string; is_read: number; read_updated_at: string; read_version: number }[] }

    return Response.json({
      notifications,
      next_cursor: hasMore && last
        ? { created_at: last.created_at, id: last.id }
        : null,
      unread_count: unread?.count ?? 0,
      server_time: new Date().toISOString(),
      known_notifications: knownNotifications.results,
    })
  }

  if (pathParts.length === 1 && pathParts[0] === "unread-count" && method === "GET") {
    await purgeExpiredNotifications(env, userId)
    const result = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notifications WHERE recipient_user_id = ? AND is_read = 0",
    ).bind(userId).first<{ count: number }>()
    return Response.json({ unread_count: result?.count ?? 0, server_time: new Date().toISOString() })
  }

  if (pathParts.length === 1 && method === "GET" && pathParts[0] !== "settings") {
    await purgeExpiredNotifications(env, userId)
    const notification = await env.DB.prepare(
      "SELECT id, event_key, category, title, body, target_url, actor_user_id, entity_type, entity_id, " +
      "is_read, COALESCE(read_updated_at, created_at) AS read_updated_at, read_version, created_at, expires_at " +
      "FROM notifications WHERE id = ? AND recipient_user_id = ?",
    ).bind(pathParts[0], userId).first<NotificationRow>()
    if (!notification) return jsonError("Notification not found", 404)
    return Response.json({ notification })
  }

  if (pathParts.length === 1 && pathParts[0] === "read-all" && method === "POST") {
    await purgeExpiredNotifications(env, userId)

    // 1つのUPDATEで処理し、実行中に新着通知が割り込む余地と部分更新をなくす。
    const result = await env.DB.prepare(
      "UPDATE notifications SET is_read = 1, " +
      "read_updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), read_version = read_version + 1 " +
      "WHERE recipient_user_id = ? AND is_read = 0 RETURNING id, read_updated_at, read_version",
    ).bind(userId).all<{ id: string; read_updated_at: string; read_version: number }>()

    return Response.json({
      updated_count: result.results.length,
      updated_ids: result.results.map(row => row.id),
      updated_read_states: result.results,
    })
  }

  if (pathParts.length === 1 && pathParts[0] === "settings" && method === "GET") {
    const [globalSettings, categorySettings] = await Promise.all([
      env.DB.prepare(
        "SELECT global_push_enabled FROM notification_user_settings WHERE user_id = ?",
      ).bind(userId).first<{ global_push_enabled: number }>(),
      env.DB.prepare(
        "SELECT category, push_enabled FROM notification_category_settings WHERE user_id = ?",
      ).bind(userId).all<{ category: string; push_enabled: number }>(),
    ])

    const stored = new Map(categorySettings.results.map(row => [row.category, row.push_enabled === 1]))
    return Response.json({
      global_push_enabled: globalSettings?.global_push_enabled !== 0,
      categories: Object.fromEntries(
        NOTIFICATION_CATEGORIES.map(category => [category, stored.get(category) ?? true]),
      ),
    })
  }

  if (pathParts.length === 1 && pathParts[0] === "settings" && method === "PATCH") {
    let body: {
      global_push_enabled?: unknown
      categories?: Record<string, unknown>
    }

    try {
      body = await request.json()
    } catch {
      return jsonError("Invalid JSON body", 400)
    }

    if (
      body.global_push_enabled !== undefined &&
      typeof body.global_push_enabled !== "boolean"
    ) {
      return jsonError("global_push_enabled must be a boolean", 400)
    }

    if (
      body.categories !== undefined &&
      (!body.categories || typeof body.categories !== "object" || Array.isArray(body.categories))
    ) {
      return jsonError("categories must be an object", 400)
    }

    const statements: D1PreparedStatement[] = []

    if (body.global_push_enabled !== undefined) {
      statements.push(env.DB.prepare(
        "INSERT INTO notification_user_settings (user_id, global_push_enabled, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) " +
        "ON CONFLICT(user_id) DO UPDATE SET global_push_enabled = excluded.global_push_enabled, updated_at = CURRENT_TIMESTAMP",
      ).bind(userId, body.global_push_enabled ? 1 : 0))
    }

    for (const [category, enabled] of Object.entries(body.categories ?? {})) {
      if (!isCategory(category) || typeof enabled !== "boolean") {
        return jsonError("Invalid notification category setting", 400)
      }

      statements.push(env.DB.prepare(
        "INSERT INTO notification_category_settings (user_id, category, push_enabled, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) " +
        "ON CONFLICT(user_id, category) DO UPDATE SET push_enabled = excluded.push_enabled, updated_at = CURRENT_TIMESTAMP",
      ).bind(userId, category, enabled ? 1 : 0))
    }

    if (statements.length > 0) await env.DB.batch(statements)
    return Response.json({ success: true })
  }

  if (pathParts.length === 2 && pathParts[1] === "read" && method === "PATCH") {
    const notificationId = pathParts[0]
    let body: { is_read?: unknown }

    try {
      body = await request.json()
    } catch {
      return jsonError("Invalid JSON body", 400)
    }

    if (typeof body.is_read !== "boolean") {
      return jsonError("is_read must be a boolean", 400)
    }

    const result = await env.DB.prepare(
      "UPDATE notifications SET is_read = ?, " +
      "read_updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), read_version = read_version + 1 " +
      "WHERE id = ? AND recipient_user_id = ? RETURNING read_updated_at, read_version",
    ).bind(body.is_read ? 1 : 0, notificationId, userId).first<{ read_updated_at: string; read_version: number }>()

    if (!result) return jsonError("Notification not found", 404)

    return Response.json({
      success: true,
      is_read: body.is_read,
      read_updated_at: result.read_updated_at,
      read_version: result.read_version,
    })
  }

  return jsonError("Not Found", 404)
}
