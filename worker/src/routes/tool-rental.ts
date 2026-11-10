import { hasPermission, requireAuth } from "../lib/authz"
import { createNotificationsForUsers } from "../lib/notifications"

type ToolItemRow = {
  id: number
  tool_id: number
  management_number: string
  status: "available" | "borrowed" | "unavailable"
  created_at: string
  updated_at: string
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function getPermission(path: string, method: string): string | null {
  if (path === "/tools") {
    return method === "GET" ? "tool_rental.view" : "tool_rental.manage"
  }
  if (/^\/tools\/\d+$/.test(path)) {
    return method === "GET" ? "tool_rental.view" : "tool_rental.manage"
  }
  if (/^\/tools\/\d+\/items$/.test(path)) {
    return method === "GET" ? "tool_rental.view" : "tool_rental.manage"
  }
  if (path === "/loans") return method === "POST" ? "tool_rental.checkout" : null
  if (path === "/loans/current") return method === "GET" ? "tool_rental.view" : null
  if (path === "/loans/return") return method === "POST" ? "tool_rental.return" : null
  if (path === "/loans/history") return method === "GET" ? "tool_rental.history" : null
  return null
}

async function getBorrowerId(
  db: D1Database,
  className: string,
  name: string,
): Promise<number> {
  await db.prepare(`
    INSERT INTO borrowers (class_name, name)
    VALUES (?, ?)
    ON CONFLICT(class_name, name)
    DO UPDATE SET updated_at = datetime('now', '+9 hours')
  `).bind(className, name).run()

  const borrower = await db.prepare(
    "SELECT id FROM borrowers WHERE class_name = ? AND name = ?",
  ).bind(className, name).first<{ id: number }>()

  if (!borrower) throw new Error("利用者情報を保存できませんでした")
  return borrower.id
}

async function findBorrowerUserId(
  db: D1Database,
  name: string,
  requestedUserId?: string | null,
): Promise<string | null> {
  if (requestedUserId) {
    const matched = await db.prepare(
      "SELECT id FROM users WHERE id = ? AND (name = ? OR nickname = ?)",
    ).bind(requestedUserId, name, name).first<{ id: string }>()
    if (matched) return matched.id
  }

  const matches = await db.prepare(
    "SELECT id FROM users WHERE name = ? OR nickname = ? LIMIT 2",
  ).bind(name, name).all<{ id: string }>()
  return matches.results.length === 1 ? matches.results[0].id : null
}

async function refreshToolCounts(db: D1Database, toolId: number): Promise<void> {
  await db.prepare(`
    UPDATE tools
    SET
      quantity = (
        SELECT COUNT(*) FROM tool_items
        WHERE tool_id = ? AND management_number NOT LIKE 'DELETED-%'
      ),
      available_quantity = (
        SELECT COUNT(*) FROM tool_items
        WHERE tool_id = ? AND status = 'available'
          AND management_number NOT LIKE 'DELETED-%'
      ),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(toolId, toolId, toolId).run()
}


async function getOnCampusUserIds(env: Env): Promise<string[]> {
  const result = await env.DB.prepare(
    "SELECT user_id FROM presence_states WHERE status = 'inside' " +
    "AND local_date = date('now', '+9 hours') AND expires_at > ?",
  ).bind(new Date().toISOString()).all<{ user_id: string }>()
  return result.results.map(row => row.user_id)
}

async function getAllUserIds(env: Env): Promise<string[]> {
  const result = await env.DB.prepare("SELECT id FROM users").all<{ id: string }>()
  return result.results.map(row => row.id)
}

export async function processDueToolRentalNotifications(env: Env): Promise<void> {
  const allUserIds = await getAllUserIds(env)
  if (allUserIds.length === 0) return
  const now = new Date().toISOString()

  const dueSoon = await env.DB.prepare(
    "SELECT id, tool_name_snapshot, due_at FROM loans " +
    "WHERE status = 'borrowed' AND due_at IS NOT NULL " +
    "AND due_at >= datetime('now', '+9 hours', '+4 minutes') " +
    "AND due_at <= datetime('now', '+9 hours', '+6 minutes') " +
    "AND presence_due_soon_notified_at IS NULL",
  ).all<{ id: number; tool_name_snapshot: string | null; due_at: string }>()

  for (const loan of dueSoon.results) {
    try {
      await createNotificationsForUsers(env, {
        recipientUserIds: allUserIds,
        eventKey: "tool_rental.due_soon:" + loan.id + ":" + loan.due_at,
        category: "tool_rental",
        title: "工具の返却期限が近づいています",
        body: (loan.tool_name_snapshot || "工具") + "の返却期限まで10分です。",
        targetUrl: "/tool-rental/loans/current?open=" + encodeURIComponent(String(loan.id)),
        entityType: "tool_loan",
        entityId: String(loan.id),
        dedupeKey: "tool_rental.due_soon:" + loan.id + ":" + loan.due_at,
      })
      await env.DB.prepare(
        "UPDATE loans SET presence_due_soon_notified_at = ? WHERE id = ? AND presence_due_soon_notified_at IS NULL",
      ).bind(now, loan.id).run()
    } catch (error) {
      console.error("Failed to create tool due-soon notifications:", error)
    }
  }

  const timerAlarms = await env.DB.prepare(
    "SELECT li.id AS loan_item_id, l.id AS loan_id, l.tool_name_snapshot, ti.management_number " +
    "FROM loan_items li INNER JOIN loans l ON l.id = li.loan_id " +
    "INNER JOIN tool_items ti ON ti.id = li.tool_item_id " +
    "WHERE li.returned_at IS NULL AND l.status = 'borrowed' " +
    "AND l.due_at IS NOT NULL " +
    "AND l.due_at <= datetime('now', '+9 hours') " +
    "AND l.due_at > datetime('now', '+9 hours', '-2 minutes') " +
    "AND li.timer_alarm_notified_at IS NULL",
  ).all<{ loan_item_id: number; loan_id: number; tool_name_snapshot: string | null; management_number: string }>()

  for (const alarm of timerAlarms.results) {
    try {
      await createNotificationsForUsers(env, {
        recipientUserIds: allUserIds,
        eventKey: "tool_rental.timer_end:" + alarm.loan_item_id,
        category: "tool_rental",
        title: "工具貸出タイマーが終了しました",
        body: (alarm.tool_name_snapshot || "工具") + "（" + alarm.management_number + "）の貸出タイマーが終了しました。",
        targetUrl: "/tool-rental/loans/current?open=" + encodeURIComponent(String(alarm.loan_item_id)),
        entityType: "tool_loan_item",
        entityId: String(alarm.loan_item_id),
        dedupeKey: "tool_rental.timer_end:" + alarm.loan_item_id,
      })
      await env.DB.prepare(
        "UPDATE loan_items SET timer_alarm_notified_at = ? WHERE id = ? AND timer_alarm_notified_at IS NULL",
      ).bind(now, alarm.loan_item_id).run()
    } catch (error) {
      console.error("Failed to create tool timer notifications:", error)
    }
  }

  const overdue = await env.DB.prepare(
    "SELECT id, tool_name_snapshot, due_at FROM loans " +
    "WHERE status = 'borrowed' AND due_at IS NOT NULL " +
    "AND due_at <= datetime('now', '+9 hours', '-5 minutes') " +
    "AND presence_overdue_notified_at IS NULL",
  ).all<{ id: number; tool_name_snapshot: string | null; due_at: string }>()

  for (const loan of overdue.results) {
    try {
      await createNotificationsForUsers(env, {
        recipientUserIds: allUserIds,
        eventKey: "tool_rental.overdue:" + loan.id,
        category: "tool_rental",
        title: "工具の返却期限を過ぎています",
        body: (loan.tool_name_snapshot || "工具") + "の返却期限を過ぎています。",
        targetUrl: "/tool-rental/loans/current?open=" + encodeURIComponent(String(loan.id)),
        entityType: "tool_loan",
        entityId: String(loan.id),
        dedupeKey: "tool_rental.overdue:" + loan.id,
      })
      await env.DB.prepare(
        "UPDATE loans SET presence_overdue_notified_at = ? WHERE id = ? AND presence_overdue_notified_at IS NULL",
      ).bind(now, loan.id).run()
    } catch (error) {
      console.error("Failed to create tool overdue notifications:", error)
    }
  }
}

export async function handleToolRental(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 })

  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  url.pathname = pathParts.length ? `/${pathParts.join("/")}` : "/tools"
  const method = request.method.toUpperCase()
  const permission = getPermission(url.pathname, method)
  if (!permission) return json({ detail: "Not Found" }, 404)

  const allowed = await hasPermission(env, auth.user.id, permission)
  const canManage = await hasPermission(env, auth.user.id, "tool_rental.manage")
  const canOperate = permission === "tool_rental.view"
    ? await Promise.all([
      hasPermission(env, auth.user.id, "tool_rental.checkout"),
      hasPermission(env, auth.user.id, "tool_rental.return"),
    ]).then(values => values.some(Boolean))
    : false

  if (!allowed && !canManage && !canOperate) {
    return json({ detail: "この操作を行う権限がありません", permission }, 403)
  }

  try {
    if (url.pathname === "/tools" && method === "GET") {
      const result = await env.DB.prepare(`
        SELECT
          t.id, t.name, t.category, t.description, t.location,
          COUNT(CASE WHEN i.management_number NOT LIKE 'DELETED-%' THEN 1 END) AS quantity,
          COUNT(CASE WHEN i.status = 'available' AND i.management_number NOT LIKE 'DELETED-%' THEN 1 END) AS available_quantity,
          t.is_active, t.display_order, t.created_at, t.updated_at
        FROM tools t
        LEFT JOIN tool_items i ON i.tool_id = t.id
        WHERE t.is_active = 1
        GROUP BY t.id
        ORDER BY COALESCE(t.display_order, t.id), t.id
      `).all()
      return json(result.results)
    }

    if (url.pathname === "/tools" && method === "POST") {
      const body = await request.json() as Record<string, unknown>
      const name = typeof body.name === "string" ? body.name.trim() : ""
      const items = Array.isArray(body.tool_items) ? body.tool_items as Array<Record<string, unknown>> : []
      if (!name) return json({ detail: "工具・機材名を入力してください" }, 400)
      if (!items.length) return json({ detail: "個体の管理番号を1つ以上入力してください" }, 400)
      const numbers = items.map(item => typeof item.management_number === "string" ? item.management_number.trim() : "")
      if (numbers.some(value => !value)) return json({ detail: "管理番号を入力してください" }, 400)
      if (new Set(numbers).size !== numbers.length) return json({ detail: "管理番号が重複しています" }, 400)

      const created = await env.DB.prepare(`
        INSERT INTO tools (name, category, description, location, quantity, available_quantity)
        VALUES (?, ?, ?, ?, 0, 0)
      `).bind(
        name,
        typeof body.category === "string" ? body.category.trim() || null : null,
        typeof body.description === "string" ? body.description.trim() || null : null,
        typeof body.location === "string" ? body.location.trim() || null : null,
      ).run()
      const toolId = Number(created.meta.last_row_id)
      try {
        await env.DB.batch(numbers.map(managementNumber =>
          env.DB.prepare(
            "INSERT INTO tool_items (tool_id, management_number, status) VALUES (?, ?, 'available')",
          ).bind(toolId, managementNumber),
        ))
      } catch (error) {
        await env.DB.prepare("DELETE FROM tools WHERE id = ?").bind(toolId).run()
        throw error
      }
      await refreshToolCounts(env.DB, toolId)
      return json({ id: toolId }, 201)
    }

    const itemListMatch = url.pathname.match(/^\/tools\/(\d+)\/items$/)
    if (itemListMatch && method === "GET") {
      const toolId = Number(itemListMatch[1])
      const result = await env.DB.prepare(`
        SELECT id, tool_id, management_number, status, created_at, updated_at
        FROM tool_items
        WHERE tool_id = ? AND management_number NOT LIKE 'DELETED-%'
        ORDER BY management_number, id
      `).bind(toolId).all<ToolItemRow>()
      return json(result.results)
    }

    if (itemListMatch && method === "POST") {
      const toolId = Number(itemListMatch[1])
      const body = await request.json() as Record<string, unknown>
      const numbers = Array.isArray(body.management_numbers)
        ? body.management_numbers.map(value => typeof value === "string" ? value.trim() : "")
        : []
      if (!numbers.length || numbers.some(value => !value)) {
        return json({ detail: "追加する管理番号を入力してください" }, 400)
      }
      if (new Set(numbers).size !== numbers.length) {
        return json({ detail: "管理番号が重複しています" }, 400)
      }
      const tool = await env.DB.prepare("SELECT id FROM tools WHERE id = ? AND is_active = 1")
        .bind(toolId).first()
      if (!tool) return json({ detail: "工具・機材が見つかりません" }, 404)
      await env.DB.batch(numbers.map(number =>
        env.DB.prepare(
          "INSERT INTO tool_items (tool_id, management_number, status) VALUES (?, ?, 'available')",
        ).bind(toolId, number),
      ))
      await refreshToolCounts(env.DB, toolId)
      return json({ added: numbers.length }, 201)
    }

    const toolMatch = url.pathname.match(/^\/tools\/(\d+)$/)
    if (toolMatch && method === "PATCH") {
      const toolId = Number(toolMatch[1])
      const body = await request.json() as Record<string, unknown>
      const name = typeof body.name === "string" ? body.name.trim() : ""
      if (!name) return json({ detail: "工具・機材名を入力してください" }, 400)
      const result = await env.DB.prepare(`
        UPDATE tools
        SET name = ?, category = ?, description = ?, location = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_active = 1
      `).bind(
        name,
        typeof body.category === "string" ? body.category.trim() || null : null,
        typeof body.description === "string" ? body.description.trim() || null : null,
        typeof body.location === "string" ? body.location.trim() || null : null,
        toolId,
      ).run()
      if (!result.meta.changes) return json({ detail: "工具・機材が見つかりません" }, 404)
      return json({ success: true })
    }

    if (toolMatch && method === "DELETE") {
      const toolId = Number(toolMatch[1])
      const borrowed = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM tool_items WHERE tool_id = ? AND status = 'borrowed'",
      ).bind(toolId).first<{ count: number }>()
      if ((borrowed?.count ?? 0) > 0) {
        return json({ detail: "貸出中の個体があるため、登録を終了できません。先に返却を記録してください。" }, 409)
      }
      const result = await env.DB.prepare(
        "UPDATE tools SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_active = 1",
      ).bind(toolId).run()
      if (!result.meta.changes) return json({ detail: "工具・機材が見つかりません" }, 404)
      return json({ success: true })
    }

    if (url.pathname === "/loans" && method === "POST") {
      const body = await request.json() as Record<string, unknown>
      const toolItemId = Number(body.tool_item_id)
      const className = typeof body.class_name === "string" ? body.class_name.trim() : ""
      const name = typeof body.name === "string" ? body.name.trim() : ""
      const rawTimeLimit = body.time_limit_minutes
      const timeLimitMinutes = rawTimeLimit === undefined || rawTimeLimit === null || rawTimeLimit === ""
        ? null
        : Number(rawTimeLimit)
      if (!Number.isInteger(toolItemId) || toolItemId <= 0) return json({ detail: "工具の個体を選択してください" }, 400)
      if (!className || !name) return json({ detail: "クラスと氏名を入力してください" }, 400)
      if (timeLimitMinutes !== null && (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 5 || timeLimitMinutes > 10080)) {
        return json({ detail: "時間制限は5分以上、10,080分（7日）以内で入力してください" }, 400)
      }

      const item = await env.DB.prepare(`
        SELECT i.id, i.tool_id, i.management_number, i.status, t.name AS tool_name
        FROM tool_items i INNER JOIN tools t ON t.id = i.tool_id
        WHERE i.id = ? AND t.is_active = 1 AND i.management_number NOT LIKE 'DELETED-%'
      `).bind(toolItemId).first<ToolItemRow & { tool_name: string }>()
      if (!item) return json({ detail: "工具の個体が見つかりません" }, 404)
      if (item.status !== "available") return json({ detail: "この個体は現在貸出できません" }, 409)

      const borrowerId = await getBorrowerId(env.DB, className, name)
      const requestedBorrowerUserId = typeof body.borrower_user_id === "string"
        ? body.borrower_user_id
        : null
      const borrowerUserId = await findBorrowerUserId(env.DB, name, requestedBorrowerUserId)
      const loan = await env.DB.prepare(`
        INSERT INTO loans (
          borrower_id, tool_id, quantity, borrowed_at, status,
          tool_name_snapshot, time_limit_minutes, due_at,
          checkout_user_id, borrower_user_id
        )
        VALUES (
          ?, ?, 1, datetime('now', '+9 hours'), 'borrowed',
          ?, ?, CASE WHEN ? IS NULL THEN NULL
            ELSE datetime('now', '+9 hours', '+' || (? - 5) || ' minutes') END, ?, ?
        )
      `).bind(
        borrowerId, item.tool_id, item.tool_name,
        timeLimitMinutes, timeLimitMinutes, timeLimitMinutes,
        auth.user.id, borrowerUserId,
      ).run()
      const loanId = Number(loan.meta.last_row_id)
      const update = await env.DB.prepare(`
        UPDATE tool_items SET status = 'borrowed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'available'
      `).bind(toolItemId).run()
      if (!update.meta.changes) {
        await env.DB.prepare("DELETE FROM loans WHERE id = ?").bind(loanId).run()
        return json({ detail: "ほかの操作で貸出済みになりました。画面を更新してください。" }, 409)
      }
      try {
        await env.DB.prepare(
          "INSERT INTO loan_items (loan_id, tool_item_id, created_at) VALUES (?, ?, datetime('now', '+9 hours'))",
        ).bind(loanId, toolItemId).run()
      } catch (error) {
        await env.DB.prepare("UPDATE tool_items SET status = 'available' WHERE id = ?").bind(toolItemId).run()
        await env.DB.prepare("DELETE FROM loans WHERE id = ?").bind(loanId).run()
        throw error
      }
      await refreshToolCounts(env.DB, item.tool_id)
      try {
        const onCampus = await getOnCampusUserIds(env)
        await createNotificationsForUsers(env, {
          recipientUserIds: [...new Set([...onCampus, auth.user.id])],
          eventKey: "tool_rental.checked_out:" + loanId,
          category: "tool_rental",
          title: "工具の貸出がありました",
          body: item.tool_name + "（" + item.management_number + "）が貸し出されました。",
          targetUrl: "/tool-rental/loans/current?open=" + encodeURIComponent(String(loanId)),
          actorUserId: auth.user.id,
          includeActor: true,
          entityType: "tool_loan",
          entityId: String(loanId),
          dedupeKey: "tool_rental.checked_out:" + loanId,
        })
      } catch (notificationError) {
        console.error("Failed to create tool checkout notifications:", notificationError)
      }
      return json({ success: true, loan_id: loanId }, 201)
    }

    if (url.pathname === "/loans/current" && method === "GET") {
      const result = await env.DB.prepare(`
        SELECT
          li.id AS loan_item_id, l.id AS loan_id, t.id AS tool_id,
          COALESCE(l.tool_name_snapshot, t.name) AS tool_name, ti.id AS tool_item_id,
          ti.management_number, b.class_name, b.name AS borrower_name,
          l.borrowed_at, l.time_limit_minutes, l.due_at
        FROM loan_items li
        INNER JOIN loans l ON l.id = li.loan_id
        INNER JOIN borrowers b ON b.id = l.borrower_id
        INNER JOIN tools t ON t.id = l.tool_id
        INNER JOIN tool_items ti ON ti.id = li.tool_item_id
        WHERE li.returned_at IS NULL AND ti.status = 'borrowed'
        ORDER BY l.borrowed_at DESC, li.id DESC
      `).all()
      return json(result.results)
    }

    if (url.pathname === "/loans/return" && method === "POST") {
      const body = await request.json() as Record<string, unknown>
      const loanItemId = Number(body.loan_item_id)
      const className = typeof body.returner_class_name === "string" ? body.returner_class_name.trim() : ""
      const name = typeof body.returner_name === "string" ? body.returner_name.trim() : ""
      if (!Number.isInteger(loanItemId) || loanItemId <= 0) return json({ detail: "返却する個体を選択してください" }, 400)
      if (!className || !name) return json({ detail: "返却者のクラスと氏名を入力してください" }, 400)

      const loanItem = await env.DB.prepare(`
        SELECT li.id, li.loan_id, li.tool_item_id, l.tool_id, l.tool_name_snapshot,
          l.borrower_user_id, b.name AS borrower_name, ti.management_number
        FROM loan_items li
        INNER JOIN loans l ON l.id = li.loan_id
        INNER JOIN borrowers b ON b.id = l.borrower_id
        INNER JOIN tool_items ti ON ti.id = li.tool_item_id
        WHERE li.id = ? AND li.returned_at IS NULL AND ti.status = 'borrowed'
      `).bind(loanItemId).first<{
        id: number
        loan_id: number
        tool_item_id: number
        tool_id: number
        tool_name_snapshot: string | null
        borrower_user_id: string | null
        borrower_name: string
        management_number: string
      }>()
      if (!loanItem) return json({ detail: "この個体は返却済みか、貸出記録が見つかりません" }, 404)

      const returnerId = await getBorrowerId(env.DB, className, name)
      const updated = await env.DB.prepare(`
        UPDATE loan_items
        SET returned_at = datetime('now', '+9 hours'), returned_by_id = ?
        WHERE id = ? AND returned_at IS NULL
      `).bind(returnerId, loanItemId).run()
      if (!updated.meta.changes) return json({ detail: "すでに返却が記録されています" }, 409)

      const itemUpdated = await env.DB.prepare(`
        UPDATE tool_items SET status = 'available', updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'borrowed'
      `).bind(loanItem.tool_item_id).run()
      if (!itemUpdated.meta.changes) {
        await env.DB.prepare(
          "UPDATE loan_items SET returned_at = NULL, returned_by_id = NULL WHERE id = ?",
        ).bind(loanItemId).run()
        return json({ detail: "個体の状態を更新できませんでした。再読み込みしてください。" }, 409)
      }

      const remaining = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM loan_items WHERE loan_id = ? AND returned_at IS NULL",
      ).bind(loanItem.loan_id).first<{ count: number }>()
      await env.DB.prepare(`
        UPDATE loans
        SET
          returned_quantity = returned_quantity + 1,
          returned_by_id = ?,
          returned_at = CASE WHEN ? = 0 THEN datetime('now', '+9 hours') ELSE NULL END,
          status = CASE WHEN ? = 0 THEN 'returned' ELSE 'borrowed' END
        WHERE id = ?
      `).bind(returnerId, remaining?.count ?? 0, remaining?.count ?? 0, loanItem.loan_id).run()
      await refreshToolCounts(env.DB, loanItem.tool_id)
      const borrowerUserId = loanItem.borrower_user_id ||
        await findBorrowerUserId(env.DB, loanItem.borrower_name)
      try {
        const onCampus = await getOnCampusUserIds(env)
        await createNotificationsForUsers(env, {
          recipientUserIds: [...new Set([
            ...onCampus,
            auth.user.id,
            ...(borrowerUserId ? [borrowerUserId] : []),
          ])],
          eventKey: "tool_rental.returned:" + loanItem.id,
          category: "tool_rental",
          title: "工具の返却がありました",
          body: (loanItem.tool_name_snapshot || "工具") + "（" + loanItem.management_number + "）が返却されました。",
          targetUrl: "/tool-rental/loans/history?open=" + encodeURIComponent(String(loanItem.id)),
          actorUserId: auth.user.id,
          includeActor: true,
          entityType: "tool_loan_item",
          entityId: String(loanItem.id),
          dedupeKey: "tool_rental.returned:" + loanItem.id,
        })
      } catch (notificationError) {
        console.error("Failed to create tool return notifications:", notificationError)
      }
      return json({ success: true })
    }

    if (url.pathname === "/loans/history" && method === "GET") {
      const status = url.searchParams.get("status") || "all"
      const className = url.searchParams.get("class_name")?.trim() || ""
      const conditions: string[] = []
      const values: Array<string> = []
      if (status === "borrowed") conditions.push("li.returned_at IS NULL")
      if (status === "returned") conditions.push("li.returned_at IS NOT NULL")
      if (className) {
        conditions.push("b.class_name = ?")
        values.push(className)
      }
      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""
      const result = await env.DB.prepare(`
        SELECT
          li.id AS loan_item_id, l.id AS loan_id, ti.id AS tool_item_id,
          COALESCE(l.tool_name_snapshot, t.name) AS tool_name,
          ti.management_number, b.class_name, b.name AS borrower_name,
          l.borrowed_at, l.time_limit_minutes, l.due_at, li.returned_at,
          rb.class_name AS returned_by_class_name,
          rb.name AS returned_by_name,
          CASE WHEN li.returned_at IS NULL THEN 'borrowed' ELSE 'returned' END AS status
        FROM loan_items li
        INNER JOIN loans l ON l.id = li.loan_id
        INNER JOIN borrowers b ON b.id = l.borrower_id
        INNER JOIN tools t ON t.id = l.tool_id
        INNER JOIN tool_items ti ON ti.id = li.tool_item_id
        LEFT JOIN borrowers rb ON rb.id = li.returned_by_id
        ${where}
        ORDER BY l.borrowed_at DESC, li.id DESC
        LIMIT 500
      `).bind(...values).all()
      return json(result.results)
    }

    return json({ detail: "Not Found" }, 404)
  } catch (error) {
    const message = error instanceof Error ? error.message : "工具貸出処理に失敗しました"
    if (/UNIQUE constraint failed: tool_items.management_number/.test(message)) {
      return json({ detail: "その管理番号はすでに登録されています" }, 409)
    }
    console.error("Tool rental API error:", error)
    return json({ detail: message }, 500)
  }
}
