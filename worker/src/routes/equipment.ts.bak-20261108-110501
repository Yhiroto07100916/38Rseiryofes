import { hasPermission, requireAuth } from "../lib/authz"

interface EquipmentItem {
  id: string
  name: string
  category: string
  description: string | null
  required_quantity: number
  prepared_quantity: number
  status: string
  owner_user_id: string | null
  owner_name: string | null
  owner_nickname: string | null
  role_id: string | null
  role_name: string | null
  storage_location: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
  updated_at: string
}

const categories = new Set([
  "equipment",
  "prop",
  "material",
  "costume",
  "other",
])

const statuses = new Set([
  "not_started",
  "preparing",
  "ready",
  "in_use",
  "broken",
  "unneeded",
])

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  })
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : null
}

function validateQuantity(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") {
    return fallback
  }

  const quantity = Number(value)

  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error("数量は0以上の整数で指定してください")
  }

  return quantity
}

async function getEquipmentItem(
  env: Env,
  id: string,
): Promise<EquipmentItem | null> {
  return env.DB.prepare(
    `
      SELECT
        e.id,
        e.name,
        e.category,
        e.description,
        e.required_quantity,
        e.prepared_quantity,
        e.status,
        e.owner_user_id,
        owner.name AS owner_name,
        owner.nickname AS owner_nickname,
        e.role_id,
        r.name AS role_name,
        e.storage_location,
        e.created_by,
        creator.name AS created_by_name,
        e.created_at,
        e.updated_at
      FROM equipment_items e
      LEFT JOIN users owner
        ON owner.id = e.owner_user_id
      LEFT JOIN roles r
        ON r.id = e.role_id
      LEFT JOIN users creator
        ON creator.id = e.created_by
      WHERE e.id = ?
    `,
  )
    .bind(id)
    .first<EquipmentItem>()
}

export async function handleEquipment(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  const method = request.method.toUpperCase()

  if (method === "OPTIONS") {
    return new Response(null, { status: 204 })
  }

  const permission = method === "GET"
    ? "equipment.view"
    : method === "POST"
      ? "equipment.create"
      : method === "PATCH"
        ? "equipment.edit"
        : method === "DELETE"
          ? "equipment.delete"
          : null

  if (!permission) {
    return json({ error: "Method Not Allowed" }, 405)
  }

  if (!(await hasPermission(env, auth.user.id, permission))) {
    return json(
      {
        error: "Forbidden",
        permission,
      },
      403,
    )
  }

  const equipmentId = pathParts.length > 0 ? pathParts[0] : null

  if (method === "GET") {
    if (equipmentId) {
      const item = await getEquipmentItem(env, equipmentId)

      if (!item) {
        return json({ error: "Equipment not found" }, 404)
      }

      return json(item)
    }

    const url = new URL(request.url)
    const category = url.searchParams.get("category")
    const status = url.searchParams.get("status")
    const search = url.searchParams.get("search")?.trim() ?? ""

    const conditions: string[] = []
    const values: string[] = []

    if (category && categories.has(category)) {
      conditions.push("e.category = ?")
      values.push(category)
    }

    if (status && statuses.has(status)) {
      conditions.push("e.status = ?")
      values.push(status)
    }

    if (search) {
      conditions.push(
        "(e.name LIKE ? OR e.description LIKE ? OR e.storage_location LIKE ?)",
      )
      const keyword = `%${search}%`
      values.push(keyword, keyword, keyword)
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

    const result = await env.DB.prepare(
      `
        SELECT
          e.id,
          e.name,
          e.category,
          e.description,
          e.required_quantity,
          e.prepared_quantity,
          e.status,
          e.owner_user_id,
          owner.name AS owner_name,
          owner.nickname AS owner_nickname,
          e.role_id,
          r.name AS role_name,
          e.storage_location,
          e.created_by,
          creator.name AS created_by_name,
          e.created_at,
          e.updated_at
        FROM equipment_items e
        LEFT JOIN users owner
          ON owner.id = e.owner_user_id
        LEFT JOIN roles r
          ON r.id = e.role_id
        LEFT JOIN users creator
          ON creator.id = e.created_by
        ${whereClause}
        ORDER BY
          CASE e.status
            WHEN 'not_started' THEN 1
            WHEN 'preparing' THEN 2
            WHEN 'ready' THEN 3
            WHEN 'in_use' THEN 4
            WHEN 'broken' THEN 5
            WHEN 'unneeded' THEN 6
            ELSE 7
          END,
          e.updated_at DESC,
          e.name COLLATE NOCASE ASC
      `,
    )
      .bind(...values)
      .all<EquipmentItem>()

    return json({
      equipment: result.results,
    })
  }

  if (method === "POST") {
    if (equipmentId) {
      return json({ error: "Cannot create under an equipment item" }, 400)
    }

    let body: Record<string, unknown>

    try {
      body = await request.json()
    } catch {
      return json({ error: "Invalid JSON" }, 400)
    }

    const name = String(body.name ?? "").trim()
    const category = String(body.category ?? "equipment").trim()
    const description = normalizeOptionalString(body.description)
    const storageLocation = normalizeOptionalString(body.storage_location)
    const ownerUserId = normalizeOptionalString(body.owner_user_id)
    const roleId = normalizeOptionalString(body.role_id)
    const status = String(body.status ?? "not_started").trim()

    if (!name) {
      return json({ error: "備品名は必須です" }, 400)
    }

    if (!categories.has(category)) {
      return json({ error: "不正なカテゴリです" }, 400)
    }

    if (!statuses.has(status)) {
      return json({ error: "不正な状態です" }, 400)
    }

    let requiredQuantity: number
    let preparedQuantity: number

    try {
      requiredQuantity = validateQuantity(body.required_quantity, 1)
      preparedQuantity = validateQuantity(body.prepared_quantity, 0)
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "数量が不正です" },
        400,
      )
    }

    if (preparedQuantity > requiredQuantity && requiredQuantity > 0) {
      return json(
        { error: "準備済み数は必要数を超えられません" },
        400,
      )
    }

    const id = crypto.randomUUID()

    await env.DB.prepare(
      `
        INSERT INTO equipment_items (
          id,
          name,
          category,
          description,
          required_quantity,
          prepared_quantity,
          status,
          owner_user_id,
          role_id,
          storage_location,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
      .bind(
        id,
        name,
        category,
        description,
        requiredQuantity,
        preparedQuantity,
        status,
        ownerUserId,
        roleId,
        storageLocation,
        auth.user.id,
      )
      .run()

    const item = await getEquipmentItem(env, id)

    return json(item, 201)
  }

  if (!equipmentId) {
    return json({ error: "Equipment ID is required" }, 400)
  }

  const existing = await getEquipmentItem(env, equipmentId)

  if (!existing) {
    return json({ error: "Equipment not found" }, 404)
  }

  if (method === "PATCH") {
    let body: Record<string, unknown>

    try {
      body = await request.json()
    } catch {
      return json({ error: "Invalid JSON" }, 400)
    }

    const name =
      body.name === undefined
        ? existing.name
        : String(body.name).trim()

    const category =
      body.category === undefined
        ? existing.category
        : String(body.category).trim()

    const description =
      body.description === undefined
        ? existing.description
        : normalizeOptionalString(body.description)

    const storageLocation =
      body.storage_location === undefined
        ? existing.storage_location
        : normalizeOptionalString(body.storage_location)

    const ownerUserId =
      body.owner_user_id === undefined
        ? existing.owner_user_id
        : normalizeOptionalString(body.owner_user_id)

    const roleId =
      body.role_id === undefined
        ? existing.role_id
        : normalizeOptionalString(body.role_id)

    const status =
      body.status === undefined
        ? existing.status
        : String(body.status).trim()

    if (!name) {
      return json({ error: "備品名は必須です" }, 400)
    }

    if (!categories.has(category)) {
      return json({ error: "不正なカテゴリです" }, 400)
    }

    if (!statuses.has(status)) {
      return json({ error: "不正な状態です" }, 400)
    }

    let requiredQuantity: number
    let preparedQuantity: number

    try {
      requiredQuantity = validateQuantity(
        body.required_quantity,
        existing.required_quantity,
      )
      preparedQuantity = validateQuantity(
        body.prepared_quantity,
        existing.prepared_quantity,
      )
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "数量が不正です" },
        400,
      )
    }

    if (preparedQuantity > requiredQuantity && requiredQuantity > 0) {
      return json(
        { error: "準備済み数は必要数を超えられません" },
        400,
      )
    }

    await env.DB.prepare(
      `
        UPDATE equipment_items
        SET
          name = ?,
          category = ?,
          description = ?,
          required_quantity = ?,
          prepared_quantity = ?,
          status = ?,
          owner_user_id = ?,
          role_id = ?,
          storage_location = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
    )
      .bind(
        name,
        category,
        description,
        requiredQuantity,
        preparedQuantity,
        status,
        ownerUserId,
        roleId,
        storageLocation,
        equipmentId,
      )
      .run()

    const item = await getEquipmentItem(env, equipmentId)

    return json(item)
  }

  await env.DB.prepare(
    "DELETE FROM equipment_items WHERE id = ?",
  )
    .bind(equipmentId)
    .run()

  return json({ success: true })
}
