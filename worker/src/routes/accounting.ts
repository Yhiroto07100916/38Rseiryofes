import { hasPermission, requireAuth } from "../lib/authz"

type Env = {
  DB: D1Database
}

interface ReceiptItemInput {
  id?: string
  budget_item_id?: string | null
  name: string
  unit_price: number
  quantity: number
  discount_rate?: number
  tax_rate?: number
  amount?: number
}

interface ReceiptInput {
  purchased_at: string
  store_name: string
  payment_method?: "budget" | "advance"
  paid_by_user_id?: string | null
  description?: string | null
  items: ReceiptItemInput[]
}

const paymentMethods = new Set(["budget", "advance"])
const reimbursementStatuses = new Set(["pending", "paid", "cancelled"])

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  })
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null
  }

  const valueString = String(value).trim()
  return valueString.length > 0 ? valueString : null
}

function requiredString(value: unknown, label: string): string {
  const normalized = String(value ?? "").trim()

  if (!normalized) {
    throw new Error(`${label}を入力してください`)
  }

  return normalized
}

function numberValue(
  value: unknown,
  label: string,
  options: {
    integer?: boolean
    min?: number
    max?: number
    fallback?: number
  } = {},
): number {
  if (
    (value === undefined || value === null || value === "") &&
    options.fallback !== undefined
  ) {
    return options.fallback
  }

  const number = Number(value)

  if (!Number.isFinite(number)) {
    throw new Error(`${label}は数値で指定してください`)
  }

  if (options.integer && !Number.isInteger(number)) {
    throw new Error(`${label}は整数で指定してください`)
  }

  if (options.min !== undefined && number < options.min) {
    throw new Error(`${label}は${options.min}以上で指定してください`)
  }

  if (options.max !== undefined && number > options.max) {
    throw new Error(`${label}は${options.max}以下で指定してください`)
  }

  return number
}

function calculateItemAmount(
  unitPrice: number,
  quantity: number,
  discountRate: number,
  taxRate: number,
): number {
  const subtotal = unitPrice * quantity
  const discounted = subtotal * (1 - discountRate / 100)
  return Math.round(discounted * (1 + taxRate / 100))
}

function parseItems(value: unknown): ReceiptItemInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("商品を1つ以上登録してください")
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`商品${index + 1}の形式が不正です`)
    }

    const source = item as Record<string, unknown>

    const unitPrice = numberValue(
      source.unit_price,
      `商品${index + 1}の単価`,
      {
        integer: true,
        min: 0,
      },
    )

    const quantity = numberValue(
      source.quantity,
      `商品${index + 1}の数量`,
      {
        min: 1,
        integer: true,
      },
    )

    const discountRate = numberValue(
      source.discount_rate,
      `商品${index + 1}の割引率`,
      {
        integer: true,
        min: 0,
        max: 100,
        fallback: 0,
      },
    )

    const taxRate = numberValue(
      source.tax_rate,
      `商品${index + 1}の税率`,
      {
        integer: true,
        min: 0,
        max: 100,
        fallback: 0,
      },
    )

    const amount = calculateItemAmount(
      unitPrice,
      quantity,
      discountRate,
      taxRate,
    )

    return {
      id: optionalString(source.id) ?? undefined,
      budget_item_id: optionalString(source.budget_item_id),
      name: requiredString(source.name, `商品${index + 1}の商品名`),
      unit_price: unitPrice,
      quantity,
      discount_rate: discountRate,
      tax_rate: taxRate,
      amount,
    }
  })
}

async function userExists(
  env: Env,
  userId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT id FROM users WHERE id = ? LIMIT 1",
  )
    .bind(userId)
    .first<{ id: string }>()

  return Boolean(row)
}

async function getCurrentBudgetId(
  env: Env,
): Promise<string | null> {
  const row = await env.DB.prepare(
    `
      SELECT id
      FROM budgets
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
  ).first<{ id: string }>()

  return row?.id ?? null
}

async function budgetItemExists(
  env: Env,
  budgetItemId: string,
  budgetId: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `
      SELECT id
      FROM budget_items
      WHERE id = ?
        AND budget_id = ?
      LIMIT 1
    `,
  )
    .bind(budgetItemId, budgetId)
    .first<{ id: string }>()

  return Boolean(row)
}

async function getReceipt(
  env: Env,
  id: string,
): Promise<unknown | null> {
  const receipt = await env.DB.prepare(
    `
      SELECT
        r.id,
        r.purchased_at,
        r.store_name,
        r.total_amount,
        r.payment_method,
        r.paid_by_user_id,
        u.name AS paid_by_name,
        u.nickname AS paid_by_nickname,
        r.description,
        r.created_by,
        creator.name AS created_by_name,
        creator.nickname AS created_by_nickname,
        r.created_at,
        r.updated_at
      FROM receipts r
      LEFT JOIN users u ON u.id = r.paid_by_user_id
      LEFT JOIN users creator ON creator.id = r.created_by
      WHERE r.id = ?
      LIMIT 1
    `,
  )
    .bind(id)
    .first()

  if (!receipt) {
    return null
  }

  const items = await env.DB.prepare(
    `
      SELECT
        ri.id,
        ri.receipt_id,
        ri.budget_item_id,
        bi.name AS budget_item_name,
        ri.name,
        ri.unit_price,
        ri.quantity,
        ri.discount_rate,
        ri.tax_rate,
        ri.amount,
        ri.created_at,
        ri.updated_at
      FROM receipt_items ri
      LEFT JOIN budget_items bi ON bi.id = ri.budget_item_id
      WHERE ri.receipt_id = ?
      ORDER BY ri.created_at ASC, ri.id ASC
    `,
  )
    .bind(id)
    .all()

  const reimbursement = await env.DB.prepare(
    `
      SELECT
        rr.id,
        rr.receipt_id,
        rr.user_id,
        u.name AS user_name,
        u.nickname AS user_nickname,
        rr.amount,
        rr.status,
        rr.paid_at,
        rr.paid_by,
        payer.name AS paid_by_name,
        payer.nickname AS paid_by_nickname,
        rr.note,
        rr.created_at,
        rr.updated_at
      FROM receipt_reimbursements rr
      LEFT JOIN users u ON u.id = rr.user_id
      LEFT JOIN users payer ON payer.id = rr.paid_by
      WHERE rr.receipt_id = ?
      LIMIT 1
    `,
  )
    .bind(id)
    .first()

  return {
    ...receipt,
    items: items.results,
    reimbursement: reimbursement ?? null,
  }
}

async function getSummary(env: Env): Promise<unknown> {
  const budget = await env.DB.prepare(
    `
      SELECT
        COALESCE(SUM(bs.amount), 0) AS amount
      FROM budget_sources bs
    `,
  ).first<{ amount: number }>()

  const purchases = await env.DB.prepare(
    `
      SELECT
        COALESCE(SUM(total_amount), 0) AS amount
      FROM receipts
    `,
  ).first<{ amount: number }>()

  const pending = await env.DB.prepare(
    `
      SELECT
        COALESCE(SUM(amount), 0) AS amount
      FROM receipt_reimbursements
      WHERE status = 'pending'
    `,
  ).first<{ amount: number }>()

  const paid = await env.DB.prepare(
    `
      SELECT
        COALESCE(SUM(amount), 0) AS amount
      FROM receipt_reimbursements
      WHERE status = 'paid'
    `,
  ).first<{ amount: number }>()

  const budgetItems = await env.DB.prepare(
    `
      SELECT
        bi.id,
        bi.budget_id,
        bi.name,
        bi.budgeted_amount,
        bi.category,
        bi.description,
        COALESCE(SUM(ri.amount), 0) AS used_amount,
        bi.budgeted_amount - COALESCE(SUM(ri.amount), 0) AS remaining_amount
      FROM budget_items bi
      LEFT JOIN receipt_items ri
        ON ri.budget_item_id = bi.id
      GROUP BY
        bi.id,
        bi.budget_id,
        bi.name,
        bi.budgeted_amount,
        bi.category,
        bi.description
      ORDER BY bi.name ASC, bi.id ASC
    `,
  ).all()

  const budgetAmount = Number(budget?.amount ?? 0)
  const purchaseAmount = Number(purchases?.amount ?? 0)

  return {
    budget_amount: budgetAmount,
    purchase_amount: purchaseAmount,
    remaining_budget: budgetAmount - purchaseAmount,
    pending_reimbursement: Number(pending?.amount ?? 0),
    paid_reimbursement: Number(paid?.amount ?? 0),
    budget_items: budgetItems.results,
  }
}

async function can(
  request: Request,
  env: Env,
  permission: string,
): Promise<boolean> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return false
  }

  return hasPermission(env, auth.user.id, permission)
}

export async function handleAccounting(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  try {
    const user = await requireAuth(request, env)
    const method = request.method.toUpperCase()

    if (method === "OPTIONS") {
      return new Response(null, { status: 204 })
    }

    const path = pathParts.filter(Boolean)

    if (path.length === 0 && method === "GET") {
      if (!(await can(request, env, "accounting.view"))) {
        return json({ message: "会計閲覧権限がありません" }, 403)
      }

      return json({
        summary: await getSummary(env),
      })
    }

    if (path[0] === "users" && method === "GET") {
      if (!(await can(request, env, "accounting.view"))) {
        return json({ message: "会計閲覧権限がありません" }, 403)
      }

      const result = await env.DB
        .prepare(`
          SELECT
            id,
            student_number,
            name,
            nickname
          FROM users
          ORDER BY student_number
        `)
        .all<{
          id: string
          student_number: string
          name: string
          nickname: string | null
        }>()

      return json({
        users: result.results,
      })
    }

    if (path[0] === "summary" && method === "GET") {
      if (!(await can(request, env, "accounting.view"))) {
        return json({ message: "会計閲覧権限がありません" }, 403)
      }

      return json(await getSummary(env))
    }

    if (path[0] === "receipts") {
      if (path.length === 1) {
        if (method === "GET") {
          if (!(await can(request, env, "accounting.view"))) {
            return json({ message: "会計閲覧権限がありません" }, 403)
          }

          const url = new URL(request.url)
          const search = optionalString(url.searchParams.get("search"))
          const paymentMethod = optionalString(
            url.searchParams.get("payment_method"),
          )
          const page = Math.max(
            1,
            Number(url.searchParams.get("page") || 1),
          )
          const limit = Math.min(
            100,
            Math.max(
              1,
              Number(url.searchParams.get("limit") || 50),
            ),
          )
          const offset = (page - 1) * limit

          const conditions: string[] = []
          const binds: unknown[] = []

          if (search) {
            conditions.push(
              `
                (
                  r.store_name LIKE ?
                  OR r.description LIKE ?
                  OR EXISTS (
                    SELECT 1
                    FROM receipt_items sri
                    WHERE sri.receipt_id = r.id
                      AND sri.name LIKE ?
                  )
                )
              `,
            )
            const term = `%${search}%`
            binds.push(term, term, term)
          }

          if (paymentMethod && paymentMethods.has(paymentMethod)) {
            conditions.push("r.payment_method = ?")
            binds.push(paymentMethod)
          }

          const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : ""

          const count = await env.DB.prepare(
            `
              SELECT COUNT(*) AS count
              FROM receipts r
              ${where}
            `,
          )
            .bind(...binds)
            .first<{ count: number }>()

          const receipts = await env.DB.prepare(
            `
              SELECT
                r.id,
                r.purchased_at,
                r.store_name,
                r.total_amount,
                r.payment_method,
                r.paid_by_user_id,
                u.name AS paid_by_name,
                u.nickname AS paid_by_nickname,
                r.description,
                r.created_by,
                r.created_at,
                r.updated_at,
                rr.status AS reimbursement_status,
                (
                  SELECT COUNT(*)
                  FROM receipt_items ri
                  WHERE ri.receipt_id = r.id
                ) AS item_count
              FROM receipts r
              LEFT JOIN users u ON u.id = r.paid_by_user_id
              LEFT JOIN receipt_reimbursements rr
                ON rr.receipt_id = r.id
              ${where}
              ORDER BY r.purchased_at DESC, r.id DESC
              LIMIT ? OFFSET ?
            `,
          )
            .bind(...binds, limit, offset)
            .all()

          const receiptResults = receipts.results

          const receiptIds = receiptResults
            .map((receipt) => receipt.id)
            .filter(Boolean)

          const receiptItemsMap = new Map<string, unknown[]>()

          if (receiptIds.length > 0) {
            const placeholders = receiptIds
              .map(() => "?")
              .join(", ")

            const receiptItems = await env.DB.prepare(
              `
                SELECT
                  ri.id,
                  ri.receipt_id,
                  ri.budget_item_id,
                  bi.name AS budget_item_name,
                  ri.name,
                  ri.unit_price,
                  ri.quantity,
                  ri.discount_rate,
                  ri.tax_rate,
                  ri.amount,
                  ri.created_at,
                  ri.updated_at
                FROM receipt_items ri
                LEFT JOIN budget_items bi
                  ON bi.id = ri.budget_item_id
                WHERE ri.receipt_id IN (${placeholders})
                ORDER BY ri.created_at ASC, ri.id ASC
              `,
            )
              .bind(...receiptIds)
              .all()

            for (const item of receiptItems.results) {
              const receiptId = String(item.receipt_id)

              if (!receiptItemsMap.has(receiptId)) {
                receiptItemsMap.set(receiptId, [])
              }

              receiptItemsMap.get(receiptId)!.push(item)
            }
          }

          const receiptsWithItems = receiptResults.map((receipt) => ({
            ...receipt,
            items: receiptItemsMap.get(String(receipt.id)) ?? [],
          }))

          return json({
            receipts: receiptsWithItems,
            page,
            limit,
            total: Number(count?.count ?? 0),
          })
        }

        if (method === "POST") {
          if (!(await can(request, env, "accounting.create"))) {
            return json({ message: "会計登録権限がありません" }, 403)
          }

          const body = (await request.json()) as Record<string, unknown>
          const purchasedAt = requiredString(
            body.purchased_at,
            "購入日",
          )
          const storeName = requiredString(
            body.store_name,
            "店舗名",
          )
          const paymentMethod =
            optionalString(body.payment_method) ?? "budget"

          if (!paymentMethods.has(paymentMethod)) {
            return json(
              { message: "支払方法が不正です" },
              400,
            )
          }

          const paidByUserId = optionalString(body.paid_by_user_id)
          const items = parseItems(body.items)
          const currentBudgetId = await getCurrentBudgetId(env)

          if (paymentMethod === "advance" && !paidByUserId) {
            return json(
              { message: "立替の場合は立替者を指定してください" },
              400,
            )
          }

          if (
            paidByUserId &&
            !(await userExists(env, paidByUserId))
          ) {
            return json(
              { message: "指定された立替者が存在しません" },
              400,
            )
          }

          for (const item of items) {
            if (item.budget_item_id) {
              if (!currentBudgetId) {
                return json(
                  { message: "現在の予算が設定されていません" },
                  400,
                )
              }

              if (
                !(await budgetItemExists(
                  env,
                  item.budget_item_id,
                  currentBudgetId,
                ))
              ) {
                return json(
                  {
                    message:
                      "指定された予算項目は現在の予算に属していません",
                  },
                  400,
                )
              }
            }
          }

          const totalAmount = items.reduce(
            (sum, item) => sum + Number(item.amount ?? 0),
            0,
          )

          const receiptId = crypto.randomUUID()
          const createdBy = user instanceof Response ? null : user.user.id
          const now = new Date().toISOString()

          const statements: D1PreparedStatement[] = [
            env.DB.prepare(
              `
                INSERT INTO receipts (
                  id,
                  purchased_at,
                  store_name,
                  total_amount,
                  payment_method,
                  paid_by_user_id,
                  description,
                  created_by,
                  created_at,
                  updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
            ).bind(
              receiptId,
              purchasedAt,
              storeName,
              totalAmount,
              paymentMethod,
              paidByUserId,
              optionalString(body.description),
              createdBy,
              now,
              now,
            ),
          ]

          for (const item of items) {
            statements.push(
              env.DB.prepare(
                `
                  INSERT INTO receipt_items (
                    id,
                    receipt_id,
                    budget_item_id,
                    name,
                    unit_price,
                    quantity,
                    discount_rate,
                    tax_rate,
                    amount,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
              ).bind(
                crypto.randomUUID(),
                receiptId,
                item.budget_item_id ?? null,
                item.name,
                item.unit_price,
                item.quantity,
                item.discount_rate ?? 0,
                item.tax_rate ?? 0,
                item.amount ?? 0,
                now,
                now,
              ),
            )
          }

          if (paymentMethod === "advance" && paidByUserId) {
            statements.push(
              env.DB.prepare(
                `
                  INSERT INTO receipt_reimbursements (
                    id,
                    receipt_id,
                    user_id,
                    amount,
                    status,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, 'pending', ?, ?)
                `,
              ).bind(
                crypto.randomUUID(),
                receiptId,
                paidByUserId,
                totalAmount,
                now,
                now,
              ),
            )
          }

          await env.DB.batch(statements)

          return json(
            {
              receipt: await getReceipt(env, receiptId),
            },
            201,
          )
        }

        return json({ message: "Method Not Allowed" }, 405)
      }

      if (path.length === 2) {
        const receiptId = path[1]

        if (method === "GET") {
          if (!(await can(request, env, "accounting.view"))) {
            return json({ message: "会計閲覧権限がありません" }, 403)
          }

          const receipt = await getReceipt(env, receiptId)

          if (!receipt) {
            return json({ message: "レシートが見つかりません" }, 404)
          }

          return json({ receipt })
        }

        if (method === "PATCH") {
          if (!(await can(request, env, "accounting.edit"))) {
            return json({ message: "会計編集権限がありません" }, 403)
          }

          const existing = await getReceipt(env, receiptId)

          if (!existing) {
            return json({ message: "レシートが見つかりません" }, 404)
          }

          const body = (await request.json()) as Record<string, unknown>
          const purchasedAt = requiredString(
            body.purchased_at,
            "購入日",
          )
          const storeName = requiredString(
            body.store_name,
            "店舗名",
          )
          const paymentMethod =
            optionalString(body.payment_method) ?? "budget"
          const paidByUserId = optionalString(body.paid_by_user_id)
          const items = parseItems(body.items)
          const currentBudgetId = await getCurrentBudgetId(env)

          if (!paymentMethods.has(paymentMethod)) {
            return json(
              { message: "支払方法が不正です" },
              400,
            )
          }

          if (paymentMethod === "advance" && !paidByUserId) {
            return json(
              { message: "立替の場合は立替者を指定してください" },
              400,
            )
          }

          if (
            paidByUserId &&
            !(await userExists(env, paidByUserId))
          ) {
            return json(
              { message: "指定された立替者が存在しません" },
              400,
            )
          }

          for (const item of items) {
            if (item.budget_item_id) {
              if (!currentBudgetId) {
                return json(
                  { message: "現在の予算が設定されていません" },
                  400,
                )
              }

              if (
                !(await budgetItemExists(
                  env,
                  item.budget_item_id,
                  currentBudgetId,
                ))
              ) {
                return json(
                  {
                    message:
                      "指定された予算項目は現在の予算に属していません",
                  },
                  400,
                )
              }
            }
          }

          const totalAmount = items.reduce(
            (sum, item) => sum + Number(item.amount ?? 0),
            0,
          )

          const now = new Date().toISOString()

          const statements: D1PreparedStatement[] = [
            env.DB.prepare(
              `
                UPDATE receipts
                SET
                  purchased_at = ?,
                  store_name = ?,
                  total_amount = ?,
                  payment_method = ?,
                  paid_by_user_id = ?,
                  description = ?,
                  updated_at = ?
                WHERE id = ?
              `,
            ).bind(
              purchasedAt,
              storeName,
              totalAmount,
              paymentMethod,
              paidByUserId,
              optionalString(body.description),
              now,
              receiptId,
            ),
            env.DB.prepare(
              "DELETE FROM receipt_items WHERE receipt_id = ?",
            ).bind(receiptId),
            env.DB.prepare(
              "DELETE FROM receipt_reimbursements WHERE receipt_id = ?",
            ).bind(receiptId),
          ]

          for (const item of items) {
            statements.push(
              env.DB.prepare(
                `
                  INSERT INTO receipt_items (
                    id,
                    receipt_id,
                    budget_item_id,
                    name,
                    unit_price,
                    quantity,
                    discount_rate,
                    tax_rate,
                    amount,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
              ).bind(
                crypto.randomUUID(),
                receiptId,
                item.budget_item_id ?? null,
                item.name,
                item.unit_price,
                item.quantity,
                item.discount_rate ?? 0,
                item.tax_rate ?? 0,
                item.amount ?? 0,
                now,
                now,
              ),
            )
          }

          if (paymentMethod === "advance" && paidByUserId) {
            statements.push(
              env.DB.prepare(
                `
                  INSERT INTO receipt_reimbursements (
                    id,
                    receipt_id,
                    user_id,
                    amount,
                    status,
                    created_at,
                    updated_at
                  )
                  VALUES (?, ?, ?, ?, 'pending', ?, ?)
                `,
              ).bind(
                crypto.randomUUID(),
                receiptId,
                paidByUserId,
                totalAmount,
                now,
                now,
              ),
            )
          }

          await env.DB.batch(statements)

          return json({
            receipt: await getReceipt(env, receiptId),
          })
        }

        if (method === "DELETE") {
          if (!(await can(request, env, "accounting.edit"))) {
            return json({ message: "会計編集権限がありません" }, 403)
          }

          const existing = await env.DB.prepare(
            "SELECT id FROM receipts WHERE id = ? LIMIT 1",
          )
            .bind(receiptId)
            .first<{ id: string }>()

          if (!existing) {
            return json({ message: "レシートが見つかりません" }, 404)
          }

          await env.DB.prepare(
            "DELETE FROM receipts WHERE id = ?",
          )
            .bind(receiptId)
            .run()

          return json({ success: true })
        }
      }

      return json({ message: "Not Found" }, 404)
    }

    if (path[0] === "budgets") {
      if (path.length === 1) {
        if (method === "GET") {
          if (!(await can(request, env, "accounting.view"))) {
            return json({ message: "会計閲覧権限がありません" }, 403)
          }

          const budgets = await env.DB.prepare(
            `
              SELECT
                b.id,
                b.name,
                b.description,
                b.created_by,
                b.created_at,
                b.updated_at,
                COALESCE(
                  (
                    SELECT SUM(bs.amount)
                    FROM budget_sources bs
                    WHERE bs.budget_id = b.id
                  ),
                  0
                ) AS total_amount,
                COALESCE(
                  (
                    SELECT SUM(bs.amount)
                    FROM budget_sources bs
                    WHERE bs.budget_id = b.id
                      AND bs.source_type = 'class_collection'
                  ),
                  0
                ) AS class_collection_amount,
                COALESCE(
                  (
                    SELECT SUM(bs.amount)
                    FROM budget_sources bs
                    WHERE bs.budget_id = b.id
                      AND bs.source_type = 'organization_subsidy'
                  ),
                  0
                ) AS organization_subsidy_amount,
                COALESCE(
                  (
                    SELECT SUM(ri.amount)
                    FROM receipt_items ri
                    INNER JOIN budget_items bi
                      ON bi.id = ri.budget_item_id
                    WHERE bi.budget_id = b.id
                  ),
                  0
                ) AS used_amount
              FROM budgets b
              ORDER BY b.updated_at DESC, b.id DESC
            `,
          ).all()

          return json({ budgets: budgets.results })
        }

        if (method === "POST") {
          if (!(await can(request, env, "accounting.create"))) {
            return json({ message: "会計登録権限がありません" }, 403)
          }

          const body = (await request.json()) as Record<string, unknown>
          const name = requiredString(body.name, "予算名")
          const description = optionalString(body.description)

          const id = crypto.randomUUID()
          const now = new Date().toISOString()

          await env.DB.prepare(
            `
              INSERT INTO budgets (
                id,
                name,
                amount,
                description,
                created_by,
                created_at,
                updated_at
              )
              VALUES (?, ?, 0, ?, ?, ?, ?)
            `,
          )
            .bind(
              id,
              name,
              description,
              user instanceof Response ? null : user.user.id,
              now,
              now,
            )
            .run()

          await env.DB.prepare(
            `
              INSERT INTO budget_sources (
                id,
                budget_id,
                source_type,
                amount,
                created_at,
                updated_at
              )
              VALUES (?, ?, 'class_collection', 0, ?, ?)
            `,
          )
            .bind(crypto.randomUUID(), id, now, now)
            .run()

          await env.DB.prepare(
            `
              INSERT INTO budget_sources (
                id,
                budget_id,
                source_type,
                amount,
                created_at,
                updated_at
              )
              VALUES (?, ?, 'organization_subsidy', 0, ?, ?)
            `,
          )
            .bind(crypto.randomUUID(), id, now, now)
            .run()

          return json(
            {
              budget: await env.DB.prepare(
                `
                  SELECT
                    b.id,
                    b.name,
                    b.description,
                    b.created_by,
                    b.created_at,
                    b.updated_at,
                    0 AS total_amount,
                    0 AS class_collection_amount,
                    0 AS organization_subsidy_amount,
                    0 AS used_amount
                  FROM budgets b
                  WHERE b.id = ?
                `,
              )
                .bind(id)
                .first(),
            },
            201,
          )
        }

        return json({ message: "Method Not Allowed" }, 405)
      }

      if (
        path.length === 3 &&
        path[2] === "sources" &&
        method === "PATCH"
      ) {
        if (!(await can(request, env, "accounting.edit"))) {
          return json({ message: "会計編集権限がありません" }, 403)
        }

        const budgetId = path[1]

        const budget = await env.DB.prepare(
          "SELECT id FROM budgets WHERE id = ? LIMIT 1",
        )
          .bind(budgetId)
          .first<{ id: string }>()

        if (!budget) {
          return json({ message: "予算が見つかりません" }, 404)
        }

        const body = (await request.json()) as Record<string, unknown>

        const classCollection = numberValue(
          body.class_collection,
          "クラス徴収金",
          {
            integer: true,
            min: 0,
          },
        )

        const organizationSubsidy = numberValue(
          body.organization_subsidy,
          "団体補助費",
          {
            integer: true,
            min: 0,
          },
        )

        const now = new Date().toISOString()

        await env.DB.prepare(
          `
            INSERT INTO budget_sources (
              id,
              budget_id,
              source_type,
              amount,
              created_at,
              updated_at
            )
            VALUES (?, ?, 'class_collection', ?, ?, ?)
            ON CONFLICT(budget_id, source_type)
            DO UPDATE SET
              amount = excluded.amount,
              updated_at = excluded.updated_at
          `,
        )
          .bind(
            crypto.randomUUID(),
            budgetId,
            classCollection,
            now,
            now,
          )
          .run()

        await env.DB.prepare(
          `
            INSERT INTO budget_sources (
              id,
              budget_id,
              source_type,
              amount,
              created_at,
              updated_at
            )
            VALUES (?, ?, 'organization_subsidy', ?, ?, ?)
            ON CONFLICT(budget_id, source_type)
            DO UPDATE SET
              amount = excluded.amount,
              updated_at = excluded.updated_at
          `,
        )
          .bind(
            crypto.randomUUID(),
            budgetId,
            organizationSubsidy,
            now,
            now,
          )
          .run()

        const totalAmount =
          classCollection + organizationSubsidy

        const allocation = await env.DB.prepare(
          `
            SELECT COALESCE(SUM(budgeted_amount), 0) AS amount
            FROM budget_items
            WHERE budget_id = ?
          `,
        )
          .bind(budgetId)
          .first<{ amount: number }>()

        const allocatedAmount = Number(allocation?.amount ?? 0)

        if (allocatedAmount > totalAmount) {
          return json(
            {
              message:
                "現在の予算配分額が新しい総予算を超えています。予算配分を先に調整してください。",
              total_amount: totalAmount,
              allocated_amount: allocatedAmount,
            },
            400,
          )
        }

        await env.DB.prepare(
          `
            UPDATE budgets
            SET
              amount = 0,
              updated_at = ?
            WHERE id = ?
          `,
        )
          .bind(now, budgetId)
          .run()

        return json({
          total_amount: totalAmount,
          class_collection: classCollection,
          organization_subsidy: organizationSubsidy,
          allocated_amount: allocatedAmount,
          remaining_allocation:
            totalAmount - allocatedAmount,
        })
      }

      if (
        path.length === 3 &&
        path[2] === "items" &&
        method === "POST"
      ) {
        if (!(await can(request, env, "accounting.create"))) {
          return json({ message: "会計登録権限がありません" }, 403)
        }

        const budgetId = path[1]

        const budget = await env.DB.prepare(
          "SELECT id FROM budgets WHERE id = ? LIMIT 1",
        )
          .bind(budgetId)
          .first<{ id: string }>()

        if (!budget) {
          return json({ message: "予算が見つかりません" }, 404)
        }

        const body = (await request.json()) as Record<string, unknown>
        const name = requiredString(body.name, "予算項目名")
        const amount = numberValue(
          body.budgeted_amount,
          "予算額",
          {
            integer: true,
            min: 0,
          },
        )

        const total = await env.DB.prepare(
          `
            SELECT COALESCE(SUM(amount), 0) AS amount
            FROM budget_sources
            WHERE budget_id = ?
          `,
        )
          .bind(budgetId)
          .first<{ amount: number }>()

        const allocated = await env.DB.prepare(
          `
            SELECT COALESCE(SUM(budgeted_amount), 0) AS amount
            FROM budget_items
            WHERE budget_id = ?
          `,
        )
          .bind(budgetId)
          .first<{ amount: number }>()

        const totalAmount = Number(total?.amount ?? 0)
        const allocatedAmount = Number(allocated?.amount ?? 0)

        if (allocatedAmount + amount > totalAmount) {
          return json(
            {
              message:
                "予算配分の合計が総予算を超えています。",
              total_amount: totalAmount,
              allocated_amount: allocatedAmount,
              requested_amount: amount,
              remaining_allocation:
                totalAmount - allocatedAmount,
            },
            400,
          )
        }

        const id = crypto.randomUUID()
        const now = new Date().toISOString()

        await env.DB.prepare(
          `
            INSERT INTO budget_items (
              id,
              budget_id,
              name,
              budgeted_amount,
              category,
              description,
              created_at,
              updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
          .bind(
            id,
            budgetId,
            name,
            amount,
            optionalString(body.category),
            optionalString(body.description),
            now,
            now,
          )
          .run()

        return json(
          {
            item: await env.DB.prepare(
              "SELECT * FROM budget_items WHERE id = ?",
            )
              .bind(id)
              .first(),
          },
          201,
        )
      }

      if (path.length === 2) {
        const budgetId = path[1]

        if (method === "PATCH") {
          if (!(await can(request, env, "accounting.edit"))) {
            return json({ message: "会計編集権限がありません" }, 403)
          }

          const body = (await request.json()) as Record<string, unknown>
          const name = requiredString(body.name, "予算名")

          const result = await env.DB.prepare(
            `
              UPDATE budgets
              SET
                name = ?,
                description = ?,
                updated_at = ?
              WHERE id = ?
            `,
          )
            .bind(
              name,
              optionalString(body.description),
              new Date().toISOString(),
              budgetId,
            )
            .run()

          if (!result.meta.changes) {
            return json({ message: "予算が見つかりません" }, 404)
          }

          return json({
            budget: await env.DB.prepare(
              `
                SELECT
                  b.id,
                  b.name,
                  b.description,
                  b.created_by,
                  b.created_at,
                  b.updated_at,
                  COALESCE(
                    (
                      SELECT SUM(bs.amount)
                      FROM budget_sources bs
                      WHERE bs.budget_id = b.id
                    ),
                    0
                  ) AS total_amount,
                  COALESCE(
                    (
                      SELECT SUM(bs.amount)
                      FROM budget_sources bs
                      WHERE bs.budget_id = b.id
                        AND bs.source_type = 'class_collection'
                    ),
                    0
                  ) AS class_collection_amount,
                  COALESCE(
                    (
                      SELECT SUM(bs.amount)
                      FROM budget_sources bs
                      WHERE bs.budget_id = b.id
                        AND bs.source_type = 'organization_subsidy'
                    ),
                    0
                  ) AS organization_subsidy_amount
                FROM budgets b
                WHERE b.id = ?
              `,
            )
              .bind(budgetId)
              .first(),
          })
        }

        if (method === "DELETE") {
          if (!(await can(request, env, "accounting.edit"))) {
            return json({ message: "会計編集権限がありません" }, 403)
          }

          const result = await env.DB.prepare(
            "DELETE FROM budgets WHERE id = ?",
          )
            .bind(budgetId)
            .run()

          if (!result.meta.changes) {
            return json({ message: "予算が見つかりません" }, 404)
          }

          return json({ success: true })
        }
      }

      if (
        path.length === 3 &&
        path[2] === "items" &&
        method === "GET"
      ) {
        if (!(await can(request, env, "accounting.view"))) {
          return json({ message: "会計閲覧権限がありません" }, 403)
        }

        const items = await env.DB.prepare(
          `
            SELECT
              bi.id,
              bi.budget_id,
              bi.name,
              bi.budgeted_amount,
              bi.category,
              bi.description,
              COALESCE(SUM(ri.amount), 0) AS used_amount,
              bi.budgeted_amount - COALESCE(SUM(ri.amount), 0)
                AS remaining_amount
            FROM budget_items bi
            LEFT JOIN receipt_items ri
              ON ri.budget_item_id = bi.id
            WHERE bi.budget_id = ?
            GROUP BY
              bi.id,
              bi.budget_id,
              bi.name,
              bi.budgeted_amount,
              bi.category,
              bi.description
            ORDER BY bi.name ASC, bi.id ASC
          `,
        )
          .bind(path[1])
          .all()

        return json({ items: items.results })
      }

      return json({ message: "Not Found" }, 404)
    }

    if (path[0] === "budget-items") {
      if (path.length === 2) {
        const itemId = path[1]

        if (method === "PATCH") {
          if (!(await can(request, env, "accounting.edit"))) {
            return json({ message: "会計編集権限がありません" }, 403)
          }

          const body = (await request.json()) as Record<string, unknown>
          const name = requiredString(body.name, "予算項目名")
          const budgetId = requiredString(
            body.budget_id,
            "予算",
          )
          const amount = numberValue(
            body.budgeted_amount,
            "予算額",
            {
              integer: true,
              min: 0,
            },
          )

          const currentItem = await env.DB.prepare(
            `
              SELECT
                id,
                budget_id,
                budgeted_amount
              FROM budget_items
              WHERE id = ?
            `,
          )
            .bind(itemId)
            .first<{
              id: string
              budget_id: string
              budgeted_amount: number
            }>()

          if (!currentItem) {
            return json(
              { message: "予算項目が見つかりません" },
              404,
            )
          }

          const budgetTotalRow = await env.DB.prepare(
            `
              SELECT COALESCE(SUM(amount), 0) AS total_amount
              FROM budget_sources
              WHERE budget_id = ?
            `,
          )
            .bind(budgetId)
            .first<{ total_amount: number }>()

          const allocatedRow = await env.DB.prepare(
            `
              SELECT COALESCE(SUM(budgeted_amount), 0) AS allocated_amount
              FROM budget_items
              WHERE budget_id = ?
                AND id != ?
            `,
          )
            .bind(budgetId, itemId)
            .first<{ allocated_amount: number }>()

          const totalBudget = Number(
            budgetTotalRow?.total_amount ?? 0,
          )
          const allocatedAmount = Number(
            allocatedRow?.allocated_amount ?? 0,
          )

          if (allocatedAmount + amount > totalBudget) {
            return json(
              {
                message:
                  `予算内訳の合計が総予算を超えています。` +
                  `総予算: ${totalBudget}円、` +
                  `編集後の配分合計: ${allocatedAmount + amount}円`,
              },
              400,
            )
          }

          const result = await env.DB.prepare(
            `
              UPDATE budget_items
              SET
                budget_id = ?,
                name = ?,
                budgeted_amount = ?,
                category = ?,
                description = ?,
                updated_at = ?
              WHERE id = ?
            `,
          )
            .bind(
              budgetId,
              name,
              amount,
              optionalString(body.category),
              optionalString(body.description),
              new Date().toISOString(),
              itemId,
            )
            .run()

          if (!result.meta.changes) {
            return json(
              { message: "予算項目が見つかりません" },
              404,
            )
          }

          return json({
            item: await env.DB.prepare(
              "SELECT * FROM budget_items WHERE id = ?",
            )
              .bind(itemId)
              .first(),
          })
        }

        if (method === "DELETE") {
          if (!(await can(request, env, "accounting.edit"))) {
            return json({ message: "会計編集権限がありません" }, 403)
          }

          const result = await env.DB.prepare(
            "DELETE FROM budget_items WHERE id = ?",
          )
            .bind(itemId)
            .run()

          if (!result.meta.changes) {
            return json(
              { message: "予算項目が見つかりません" },
              404,
            )
          }

          return json({ success: true })
        }
      }

      return json({ message: "Not Found" }, 404)
    }

    if (path[0] === "reimbursements") {
      if (path.length === 1 && method === "GET") {
        if (!(await can(request, env, "accounting.view"))) {
          return json({ message: "会計閲覧権限がありません" }, 403)
        }

        const reimbursements = await env.DB.prepare(
          `
            SELECT
              rr.id,
              rr.receipt_id,
              rr.user_id,
              u.name AS user_name,
              u.nickname AS user_nickname,
              rr.amount,
              rr.status,
              rr.paid_at,
              rr.paid_by,
              payer.name AS paid_by_name,
              payer.nickname AS paid_by_nickname,
              rr.note,
              rr.created_at,
              rr.updated_at,
              r.purchased_at,
              r.store_name
            FROM receipt_reimbursements rr
            INNER JOIN receipts r
              ON r.id = rr.receipt_id
            LEFT JOIN users u
              ON u.id = rr.user_id
            LEFT JOIN users payer
              ON payer.id = rr.paid_by
            ORDER BY
              CASE rr.status
                WHEN 'pending' THEN 0
                WHEN 'paid' THEN 1
                ELSE 2
              END,
              rr.created_at DESC
          `,
        ).all()

        return json({
          reimbursements: reimbursements.results,
        })
      }

      if (path.length === 2 && method === "PATCH") {
        if (!(await can(request, env, "accounting.approve"))) {
          return json({ message: "会計承認権限がありません" }, 403)
        }

        const reimbursementId = path[1]
        const body = (await request.json()) as Record<string, unknown>
        const status = requiredString(body.status, "精算状態")

        if (!reimbursementStatuses.has(status)) {
          return json(
            { message: "精算状態が不正です" },
            400,
          )
        }

        const reimbursement = await env.DB.prepare(
          `
            SELECT id
            FROM receipt_reimbursements
            WHERE id = ?
            LIMIT 1
          `,
        )
          .bind(reimbursementId)
          .first<{ id: string }>()

        if (!reimbursement) {
          return json({ message: "精算情報が見つかりません" }, 404)
        }

        const now = new Date().toISOString()
        const paidAt = status === "paid" ? now : null
        const paidBy = status === "paid" ? (user instanceof Response ? null : user.user.id) : null
        const note = optionalString(body.note)

        await env.DB.prepare(
          `
            UPDATE receipt_reimbursements
            SET
              status = ?,
              paid_at = ?,
              paid_by = ?,
              note = ?,
              updated_at = ?
            WHERE id = ?
          `,
        )
          .bind(
            status,
            paidAt,
            paidBy,
            note,
            now,
            reimbursementId,
          )
          .run()

        return json({
          reimbursement: await env.DB.prepare(
            `
              SELECT *
              FROM receipt_reimbursements
              WHERE id = ?
            `,
          )
            .bind(reimbursementId)
            .first(),
        })
      }

      return json({ message: "Not Found" }, 404)
    }

    return json({ message: "Not Found" }, 404)
  } catch (error) {
    const message = errorMessage(error)

    if (
      message.toLowerCase().includes("unauthorized") ||
      message.includes("認証")
    ) {
      return json({ message }, 401)
    }

    if (
      message.includes("権限") ||
      message.toLowerCase().includes("forbidden")
    ) {
      return json({ message }, 403)
    }

    if (
      message.includes("入力") ||
      message.includes("指定") ||
      message.includes("数量") ||
      message.includes("税率") ||
      message.includes("割引率") ||
      message.includes("支払方法") ||
      message.includes("精算状態") ||
      message.includes("商品")
    ) {
      return json({ message }, 400)
    }

    console.error("accounting API error:", error)
    return json(
      { message: "会計APIでエラーが発生しました" },
      500,
    )
  }
}
