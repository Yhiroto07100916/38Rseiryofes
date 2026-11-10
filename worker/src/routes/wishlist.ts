import { hasPermission, requireAuth } from "../lib/authz"
import { createNotificationsForUsers } from "../lib/notifications"

interface WishlistItem {
  id: string
  title: string
  description: string | null
  product_url: string | null
  quantity: number
  estimated_cost: number | null
  priority: string
  status: string
  memo: string | null
  created_by: string
  created_by_name: string | null
  created_by_nickname: string | null
  created_at: string
  updated_at: string
}

const priorities = new Set(["low", "normal", "high", "urgent"])
const statuses = new Set(["requested", "planned", "purchased"])

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text || null
}

function validateInteger(
  value: unknown,
  fallback: number | null,
  minimum: number,
): number | null {
  if (value === undefined) return fallback
  if (value === null || value === "") return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < minimum) {
    throw new Error(`数値は${minimum}以上の整数で指定してください`)
  }
  return number
}

async function getWishlistItem(
  env: Env,
  id: string,
): Promise<WishlistItem | null> {
  return env.DB.prepare(`
    SELECT
      w.id,
      w.title,
      w.description,
      w.product_url,
      w.quantity,
      w.estimated_cost,
      w.priority,
      w.status,
      w.memo,
      w.created_by,
      u.name AS created_by_name,
      u.nickname AS created_by_nickname,
      w.created_at,
      w.updated_at
    FROM wishlist_items w
    INNER JOIN users u ON u.id = w.created_by
    WHERE w.id = ?
  `).bind(id).first<WishlistItem>()
}

async function canManageItem(
  env: Env,
  userId: string,
  item: WishlistItem,
  permission: "edit" | "delete",
): Promise<boolean> {
  if (await hasPermission(env, userId, `wishlist.${permission}`)) {
    return true
  }

  return item.created_by === userId &&
    await hasPermission(env, userId, `wishlist.${permission}_own`)
}

export async function handleWishlist(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const method = request.method.toUpperCase()
  if (method === "OPTIONS") return new Response(null, { status: 204 })

  const permission = method === "GET"
    ? "wishlist.view"
    : method === "POST"
      ? "wishlist.create"
      : null

  if (permission && !(await hasPermission(env, auth.user.id, permission))) {
    return json({ error: "Forbidden", permission }, 403)
  }

  if (!["GET", "POST", "PATCH", "DELETE"].includes(method)) {
    return json({ error: "Method Not Allowed" }, 405)
  }

  const itemId = pathParts[0] || null

  if (method === "GET") {
    if (itemId) {
      const item = await getWishlistItem(env, itemId)
      return item ? json(item) : json({ error: "Wishlist item not found" }, 404)
    }

    const result = await env.DB.prepare(`
      SELECT
        w.id,
        w.title,
        w.description,
        w.product_url,
        w.quantity,
        w.estimated_cost,
        w.priority,
        w.status,
        w.memo,
        w.created_by,
        u.name AS created_by_name,
        u.nickname AS created_by_nickname,
        w.created_at,
        w.updated_at
      FROM wishlist_items w
      INNER JOIN users u ON u.id = w.created_by
      ORDER BY
        CASE w.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          ELSE 4
        END,
        w.updated_at DESC,
        w.title COLLATE NOCASE ASC
    `).all<WishlistItem>()

    const canCreate = await hasPermission(env, auth.user.id, "wishlist.create")
    const canReview = await hasPermission(env, auth.user.id, "wishlist.review")
    const canEditAll = await hasPermission(env, auth.user.id, "wishlist.edit")
    const canEditOwn = await hasPermission(env, auth.user.id, "wishlist.edit_own")
    const canDeleteAll = await hasPermission(env, auth.user.id, "wishlist.delete")
    const canDeleteOwn = await hasPermission(env, auth.user.id, "wishlist.delete_own")

    const items = result.results.map((item) => ({
      ...item,
      can_edit: canEditAll || (canEditOwn && item.created_by === auth.user.id),
      can_delete: canDeleteAll || (canDeleteOwn && item.created_by === auth.user.id),
    }))

    return json({
      items,
      capabilities: {
        can_create: canCreate,
        can_review: canReview,
      },
    })
  }

  if (method === "POST") {
    if (itemId) return json({ error: "Invalid wishlist path" }, 400)

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return json({ error: "Invalid JSON" }, 400)
    }

    const title = String(body.title ?? "").trim()
    const priority = String(body.priority ?? "normal")
    const status = "requested"
    if (!title) return json({ error: "品名は必須です" }, 400)
    if (!priorities.has(priority)) return json({ error: "優先度が不正です" }, 400)
    if (!statuses.has(status)) return json({ error: "状態が不正です" }, 400)

    let quantity: number
    let estimatedCost: number | null
    try {
      quantity = validateInteger(body.quantity, 1, 1) as number
      estimatedCost = validateInteger(body.estimated_cost, null, 0)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "数値が不正です" }, 400)
    }

    const id = crypto.randomUUID()
    await env.DB.prepare(`
      INSERT INTO wishlist_items (
        id, title, description, product_url, quantity,
        estimated_cost, priority, status, memo, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      title,
      optionalText(body.description),
      optionalText(body.product_url),
      quantity,
      estimatedCost,
      priority,
      status,
      optionalText(body.memo),
      auth.user.id,
    ).run()

    const item = await getWishlistItem(env, id)

    try {
      const users = await env.DB.prepare("SELECT id FROM users").all<{ id: string }>()
      const eligible = await Promise.all(users.results.map(async user => ({
        id: user.id,
        allowed: await hasPermission(env, user.id, "wishlist.review") &&
          await hasPermission(env, user.id, "wishlist.view"),
      })))
      await createNotificationsForUsers(env, {
        recipientUserIds: eligible.filter(user => user.allowed).map(user => user.id),
        eventKey: "wishlist.created",
        category: "wishlist",
        title: "ほしい物リストに新しい品目が登録されました",
        body: title,
        targetUrl: "/wishlist?open=" + encodeURIComponent(id),
        requiredPermission: "wishlist.view",
        actorUserId: auth.user.id,
        entityType: "wishlist_item",
        entityId: id,
        dedupeKey: "wishlist.created:" + id,
      })
    } catch (notificationError) {
      console.error("Failed to create wishlist notifications:", notificationError)
    }

    return json(item, 201)
  }

  if (!itemId) return json({ error: "Wishlist item ID is required" }, 400)

  const existing = await getWishlistItem(env, itemId)
  if (!existing) return json({ error: "Wishlist item not found" }, 404)

  if (method === "DELETE") {
    if (!(await canManageItem(env, auth.user.id, existing, "delete"))) {
      return json({ error: "Forbidden", permission: "wishlist.delete_own" }, 403)
    }

    await env.DB.prepare("DELETE FROM wishlist_items WHERE id = ?")
      .bind(itemId)
      .run()
    return json({ success: true })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ error: "Invalid JSON" }, 400)
  }

  const contentFields = [
    "title",
    "description",
    "product_url",
    "quantity",
    "estimated_cost",
    "priority",
    "memo",
  ]
  const hasContentChanges = contentFields.some((field) =>
    Object.prototype.hasOwnProperty.call(body, field),
  )

  if (
    hasContentChanges &&
    !(await canManageItem(env, auth.user.id, existing, "edit"))
  ) {
    return json({ error: "Forbidden", permission: "wishlist.edit_own" }, 403)
  }

  const title = body.title === undefined
    ? existing.title
    : String(body.title).trim()
  const priority = body.priority === undefined
    ? existing.priority
    : String(body.priority)
  const status = body.status === undefined
    ? existing.status
    : String(body.status)

  if (!title) return json({ error: "品名は必須です" }, 400)
  if (!priorities.has(priority)) return json({ error: "優先度が不正です" }, 400)
  if (!statuses.has(status)) return json({ error: "状態が不正です" }, 400)

  if (
    body.status !== undefined &&
    !(await hasPermission(env, auth.user.id, "wishlist.review"))
  ) {
    return json({ error: "Forbidden", permission: "wishlist.review" }, 403)
  }

  if (!hasContentChanges && body.status === undefined) {
    return json({ error: "更新内容がありません" }, 400)
  }

  let quantity: number
  let estimatedCost: number | null
  try {
    quantity = validateInteger(body.quantity, existing.quantity, 1) as number
    estimatedCost = validateInteger(body.estimated_cost, existing.estimated_cost, 0)
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "数値が不正です" }, 400)
  }

  await env.DB.prepare(`
    UPDATE wishlist_items
    SET
      title = ?,
      description = ?,
      product_url = ?,
      quantity = ?,
      estimated_cost = ?,
      priority = ?,
      status = ?,
      memo = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(
    title,
    body.description === undefined ? existing.description : optionalText(body.description),
    body.product_url === undefined ? existing.product_url : optionalText(body.product_url),
    quantity,
    estimatedCost,
    priority,
    status,
    body.memo === undefined ? existing.memo : optionalText(body.memo),
    itemId,
  ).run()

  const updated = await getWishlistItem(env, itemId)

  if (
    status !== existing.status &&
    (status === "planned" || status === "purchased")
  ) {
    try {
      await createNotificationsForUsers(env, {
        recipientUserIds: [existing.created_by],
        eventKey: "wishlist.status_changed",
        category: "wishlist",
        title: "ほしい物リストの状態が更新されました",
        body: title + "：" + (status === "planned" ? "購入予定" : "購入済み"),
        targetUrl: "/wishlist?open=" + encodeURIComponent(itemId),
        requiredPermission: "wishlist.view",
        actorUserId: auth.user.id,
        entityType: "wishlist_item",
        entityId: itemId,
        dedupeKey: "wishlist.status_changed:" + itemId + ":" + crypto.randomUUID(),
      })
    } catch (notificationError) {
      console.error("Failed to create wishlist status notification:", notificationError)
    }
  }

  return json(updated)
}
