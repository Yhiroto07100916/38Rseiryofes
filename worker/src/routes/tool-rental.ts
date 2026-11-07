import { hasPermission, requireAuth } from "../lib/authz"

interface ToolRow {
  id: string
  name: string
  category: string
  description: string | null
  total_quantity: number
  is_active: number
  external_tool_id: string | null
  created_at: string
  updated_at: string
  checked_out_quantity?: number
  available_quantity?: number
}

interface LoanRow {
  id: string
  tool_id: string
  tool_name: string
  borrower_name: string
  borrower_note: string | null
  quantity: number
  status: "checked_out" | "returned"
  checked_out_by: string
  checked_out_by_name: string | null
  checked_out_at: string
  returned_by: string | null
  returned_by_name: string | null
  returned_at: string | null
  checkout_note: string | null
  return_note: string | null
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text || null
}

function positiveInteger(value: unknown): number | null {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

async function allowed(env: Env, userId: string, permission: string) {
  return hasPermission(env, userId, permission)
}

async function getTool(env: Env, id: string): Promise<ToolRow | null> {
  return env.DB.prepare(`
    SELECT
      t.id, t.name, t.category, t.description, t.total_quantity,
      t.is_active, t.external_tool_id, t.created_at, t.updated_at,
      COALESCE(SUM(CASE WHEN l.status = 'checked_out' THEN l.quantity ELSE 0 END), 0)
        AS checked_out_quantity,
      t.total_quantity - COALESCE(SUM(CASE WHEN l.status = 'checked_out' THEN l.quantity ELSE 0 END), 0)
        AS available_quantity
    FROM tool_rental_tools t
    LEFT JOIN tool_rental_loans l ON l.tool_id = t.id
    WHERE t.id = ?
    GROUP BY t.id
  `).bind(id).first<ToolRow>()
}

async function getLoan(env: Env, id: string): Promise<LoanRow | null> {
  return env.DB.prepare(`
    SELECT
      l.id, l.tool_id, t.name AS tool_name, l.borrower_name,
      l.borrower_note, l.quantity, l.status, l.checked_out_by,
      checkout_user.name AS checked_out_by_name, l.checked_out_at,
      l.returned_by, return_user.name AS returned_by_name,
      l.returned_at, l.checkout_note, l.return_note
    FROM tool_rental_loans l
    INNER JOIN tool_rental_tools t ON t.id = l.tool_id
    LEFT JOIN users checkout_user ON checkout_user.id = l.checked_out_by
    LEFT JOIN users return_user ON return_user.id = l.returned_by
    WHERE l.id = ?
  `).bind(id).first<LoanRow>()
}

async function requirePermission(
  env: Env,
  userId: string,
  permission: string,
): Promise<Response | null> {
  return await allowed(env, userId, permission)
    ? null
    : json({ error: "Forbidden", permission }, 403)
}

export async function handleToolRental(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const method = request.method.toUpperCase()
  const [resource, resourceId, action] = pathParts

  if (method === "GET" && !resource) {
    const denied = await requirePermission(env, auth.user.id, "tool_rental.view")
    if (denied) return denied

    const result = await env.DB.prepare(`
      SELECT
        t.id, t.name, t.category, t.description, t.total_quantity,
        t.is_active, t.external_tool_id, t.created_at, t.updated_at,
        COALESCE(SUM(CASE WHEN l.status = 'checked_out' THEN l.quantity ELSE 0 END), 0)
          AS checked_out_quantity,
        t.total_quantity - COALESCE(SUM(CASE WHEN l.status = 'checked_out' THEN l.quantity ELSE 0 END), 0)
          AS available_quantity
      FROM tool_rental_tools t
      LEFT JOIN tool_rental_loans l ON l.tool_id = t.id
      GROUP BY t.id
      ORDER BY t.is_active DESC, t.category COLLATE NOCASE, t.name COLLATE NOCASE
    `).all<ToolRow>()

    return json({ tools: result.results })
  }

  if (method === "GET" && resource === "active" && !resourceId) {
    const denied = await requirePermission(env, auth.user.id, "tool_rental.return")
    if (denied) return denied

    const result = await env.DB.prepare(`
      SELECT
        l.id, l.tool_id, t.name AS tool_name, l.borrower_name,
        l.borrower_note, l.quantity, l.status, l.checked_out_by,
        checkout_user.name AS checked_out_by_name, l.checked_out_at,
        l.returned_by, return_user.name AS returned_by_name,
        l.returned_at, l.checkout_note, l.return_note
      FROM tool_rental_loans l
      INNER JOIN tool_rental_tools t ON t.id = l.tool_id
      LEFT JOIN users checkout_user ON checkout_user.id = l.checked_out_by
      LEFT JOIN users return_user ON return_user.id = l.returned_by
      WHERE l.status = 'checked_out'
      ORDER BY l.checked_out_at ASC
    `).all<LoanRow>()

    return json({ loans: result.results })
  }

  if (method === "GET" && resource === "history" && !resourceId) {
    const denied = await requirePermission(env, auth.user.id, "tool_rental.history")
    if (denied) return denied

    const url = new URL(request.url)
    const limit = Math.min(200, Math.max(1, Math.floor(Number(url.searchParams.get("limit")) || 100)))
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get("offset")) || 0))
    const result = await env.DB.prepare(`
      SELECT
        l.id, l.tool_id, t.name AS tool_name, l.borrower_name,
        l.borrower_note, l.quantity, l.status, l.checked_out_by,
        checkout_user.name AS checked_out_by_name, l.checked_out_at,
        l.returned_by, return_user.name AS returned_by_name,
        l.returned_at, l.checkout_note, l.return_note
      FROM tool_rental_loans l
      INNER JOIN tool_rental_tools t ON t.id = l.tool_id
      LEFT JOIN users checkout_user ON checkout_user.id = l.checked_out_by
      LEFT JOIN users return_user ON return_user.id = l.returned_by
      ORDER BY l.checked_out_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all<LoanRow>()

    return json({ loans: result.results, limit, offset })
  }

  if (method === "POST" && resource === "tools" && !resourceId) {
    const denied = await requirePermission(env, auth.user.id, "tool_rental.manage")
    if (denied) return denied

    let body: Record<string, unknown>
    try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }

    const name = String(body.name ?? "").trim()
    const category = String(body.category ?? "").trim()
    const quantity = positiveInteger(body.total_quantity)
    if (!name) return json({ error: "工具名は必須です" }, 400)
    if (!category) return json({ error: "カテゴリは必須です" }, 400)
    if (!quantity) return json({ error: "数量は1以上の整数で指定してください" }, 400)

    const id = crypto.randomUUID()
    await env.DB.prepare(`
      INSERT INTO tool_rental_tools (
        id, name, category, description, total_quantity, external_tool_id, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, name, category, optionalText(body.description), quantity,
      optionalText(body.external_tool_id), auth.user.id,
    ).run()

    return json(await getTool(env, id), 201)
  }

  if (method === "PATCH" && resource === "tools" && resourceId) {
    const denied = await requirePermission(env, auth.user.id, "tool_rental.manage")
    if (denied) return denied

    let body: Record<string, unknown>
    try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }

    const existing = await getTool(env, resourceId)
    if (!existing) return json({ error: "Tool not found" }, 404)

    const name = body.name === undefined ? existing.name : String(body.name).trim()
    const category = body.category === undefined ? existing.category : String(body.category).trim()
    const quantity = body.total_quantity === undefined
      ? existing.total_quantity
      : positiveInteger(body.total_quantity)

    if (!name || !category) return json({ error: "工具名とカテゴリは必須です" }, 400)
    if (!quantity) return json({ error: "数量は1以上の整数で指定してください" }, 400)
    if (quantity < (existing.checked_out_quantity ?? 0)) {
      return json({ error: "貸出中の数量を下回る在庫数には変更できません" }, 409)
    }

    const isActive = body.is_active === undefined
      ? existing.is_active
      : body.is_active === false || body.is_active === 0 ? 0 : 1

    const updated = await env.DB.prepare(`
      UPDATE tool_rental_tools
      SET name = ?, category = ?, description = ?, total_quantity = ?,
          is_active = ?, external_tool_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND ? >= COALESCE((
          SELECT SUM(quantity)
          FROM tool_rental_loans
          WHERE tool_id = ? AND status = 'checked_out'
        ), 0)
    `).bind(
      name, category,
      body.description === undefined ? existing.description : optionalText(body.description),
      quantity, isActive,
      body.external_tool_id === undefined ? existing.external_tool_id : optionalText(body.external_tool_id),
      resourceId, quantity, resourceId,
    ).run()

    if (updated.meta.changes !== 1) {
      return json({ error: "貸出中の数量を下回る在庫数には変更できません" }, 409)
    }

    return json(await getTool(env, resourceId))
  }

  if (method === "POST" && resource === "checkout" && !resourceId) {
    const denied = await requirePermission(env, auth.user.id, "tool_rental.checkout")
    if (denied) return denied

    let body: Record<string, unknown>
    try { body = await request.json() } catch { return json({ error: "Invalid JSON" }, 400) }

    const toolId = String(body.tool_id ?? "").trim()
    const borrowerName = String(body.borrower_name ?? "").trim()
    const quantity = positiveInteger(body.quantity)
    if (!toolId || !borrowerName || !quantity) {
      return json({ error: "工具・借用者名・1以上の数量を指定してください" }, 400)
    }

    const id = crypto.randomUUID()
    const inserted = await env.DB.prepare(`
      INSERT INTO tool_rental_loans (
        id, tool_id, borrower_name, borrower_note, quantity,
        checked_out_by, checkout_note
      )
      SELECT ?, t.id, ?, ?, ?, ?, ?
      FROM tool_rental_tools t
      WHERE t.id = ?
        AND t.is_active = 1
        AND t.total_quantity - COALESCE((
          SELECT SUM(l.quantity)
          FROM tool_rental_loans l
          WHERE l.tool_id = t.id AND l.status = 'checked_out'
        ), 0) >= ?
    `).bind(
      id, borrowerName, optionalText(body.borrower_note), quantity,
      auth.user.id, optionalText(body.checkout_note), toolId, quantity,
    ).run()

    if (inserted.meta.changes !== 1) {
      const tool = await getTool(env, toolId)
      if (!tool) return json({ error: "Tool not found" }, 404)
      if (!tool.is_active) return json({ error: "この工具は貸出停止中です" }, 409)
      return json({ error: "貸出可能な数量が不足しています", available_quantity: tool.available_quantity }, 409)
    }

    return json(await getLoan(env, id), 201)
  }

  if (method === "POST" && resource === "loans" && resourceId && action === "return") {
    const denied = await requirePermission(env, auth.user.id, "tool_rental.return")
    if (denied) return denied

    let body: Record<string, unknown> = {}
    try { body = await request.json() } catch { /* empty body is accepted */ }

    const updated = await env.DB.prepare(`
      UPDATE tool_rental_loans
      SET status = 'returned', returned_by = ?, returned_at = CURRENT_TIMESTAMP,
          return_note = ?
      WHERE id = ? AND status = 'checked_out'
    `).bind(auth.user.id, optionalText(body.return_note), resourceId).run()

    if (updated.meta.changes !== 1) {
      const existing = await getLoan(env, resourceId)
      if (!existing) return json({ error: "Loan not found" }, 404)
      return json({ error: "この貸出記録はすでに返却済みです" }, 409)
    }

    return json(await getLoan(env, resourceId))
  }

  return json({ error: "Not Found" }, 404)
}
