import { buildPushHTTPRequest } from "@pushforge/builder"
import { hasPermission, requireAuth } from "../lib/authz"

interface PushSubscriptionRecord {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

interface PushDeliveryRecord {
  delivery_id: string
  news_id: string
  subscription_id: string
  attempt_count: number
  endpoint: string
  p256dh: string
  auth: string
  title: string
  detail: string
}

interface SubscriptionBody {
  endpoint?: unknown
  keys?: {
    p256dh?: unknown
    auth?: unknown
  }
}

const RETRY_DELAYS_MINUTES = [1, 5, 15]
const MAX_ATTEMPTS = 4
const MAX_BATCH_SIZE = 100
const MAX_SUBSCRIPTIONS = 1000

export function isAllowedPushEndpoint(value: string): boolean {
  try {
    const url = new URL(value)

    if (url.protocol !== "https:" || url.username || url.password || (url.port !== "" && url.port !== "443")) {
      return false
    }

    const host = url.hostname.toLowerCase()

    return (
      host === "fcm.googleapis.com" ||
      host === "push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".push.services.mozilla.com") ||
      host === "notify.windows.com" ||
      host.endsWith(".notify.windows.com")
    )
  } catch {
    return false
  }
}

export function formatPushBody(detail: string): string {
  const characters = Array.from(detail)

  return characters.length > 50
    ? `${characters.slice(0, 50).join("")}…`
    : detail
}

function isBase64Url(value: unknown, expectedBytes: number): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 100 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return false
  }

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/")
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)
    const canonical = btoa(decoded)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")
    return decoded.length === expectedBytes &&
      canonical === value &&
      (expectedBytes !== 65 || decoded.charCodeAt(0) === 4)
  } catch {
    return false
  }
}

function isPushConfigured(env: Env): boolean {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status })
}

export async function handlePush(
  request: Request,
  env: Env,
  pathParts: string[],
): Promise<Response> {
  const auth = await requireAuth(request, env)

  if (auth instanceof Response) {
    return auth
  }

  if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "config") {
    if (!isPushConfigured(env)) {
      return jsonError("Push notifications are not configured", 503)
    }

    return Response.json({ publicKey: env.VAPID_PUBLIC_KEY })
  }

  if (pathParts.length === 1 && pathParts[0] === "subscriptions") {
    if (request.method === "GET") {
      const endpoint = new URL(request.url).searchParams.get("endpoint")

      if (!endpoint || !isAllowedPushEndpoint(endpoint)) {
        return jsonError("A valid endpoint is required", 400)
      }

      const subscription = await env.DB
        .prepare("SELECT id FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
        .bind(endpoint, auth.user.id)
        .first<{ id: string }>()

      return Response.json({ registered: Boolean(subscription) })
    }

    if (request.method === "POST") {
      if (!isPushConfigured(env)) {
        return jsonError("Push notifications are not configured", 503)
      }

      let body: SubscriptionBody

      try {
        body = await request.json<SubscriptionBody>()
      } catch {
        return jsonError("Invalid JSON body", 400)
      }

      const endpoint = typeof body.endpoint === "string" ? body.endpoint : ""
      const p256dh = body.keys?.p256dh
      const authKey = body.keys?.auth

      if (
        endpoint.length > 2048 ||
        !isAllowedPushEndpoint(endpoint) ||
        !isBase64Url(p256dh, 65) ||
        !isBase64Url(authKey, 16)
      ) {
        return jsonError("Invalid push subscription", 400)
      }

      // 件数判定とINSERTを1つのSQL文にまとめ、同時登録による上限超過を防ぐ。
      const registration = await env.DB
        .prepare(`
          INSERT INTO push_subscriptions (
            id,
            user_id,
            endpoint,
            p256dh,
            auth
          )
          SELECT ?, ?, ?, ?, ?
          WHERE
            EXISTS (
              SELECT 1
              FROM push_subscriptions
              WHERE endpoint = ? AND user_id = ?
            )
            OR (
              SELECT COUNT(*)
              FROM push_subscriptions
              WHERE user_id = ?
            ) < ?
          ON CONFLICT(endpoint) DO UPDATE SET
            user_id = excluded.user_id,
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(
          crypto.randomUUID(),
          auth.user.id,
          endpoint,
          p256dh,
          authKey,
          endpoint,
          auth.user.id,
          auth.user.id,
          MAX_SUBSCRIPTIONS,
        )
        .run()

      if ((registration.meta?.changes ?? 0) !== 1) {
        return jsonError("Push subscription limit reached", 429)
      }

      return Response.json({ registered: true })
    }

    if (request.method === "DELETE") {
      let body: { endpoint?: unknown }

      try {
        body = await request.json<{ endpoint?: unknown }>()
      } catch {
        return jsonError("Invalid JSON body", 400)
      }

      const endpoint = typeof body.endpoint === "string" ? body.endpoint : ""

      if (!isAllowedPushEndpoint(endpoint)) {
        return jsonError("Invalid push endpoint", 400)
      }

      await env.DB
        .prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
        .bind(endpoint, auth.user.id)
        .run()

      return Response.json({ registered: false })
    }
  }

  return jsonError("Not Found", 404)
}

export async function enqueueNewsPushDeliveries(
  env: Env,
  news: { id: string },
): Promise<void> {
  if (!isPushConfigured(env)) {
    console.warn("Push notifications are not configured; skipping notification enqueue.")
    return
  }

  await env.DB
    .prepare(`
      INSERT OR IGNORE INTO push_notification_deliveries (
        id,
        news_id,
        subscription_id,
        status,
        attempt_count,
        next_attempt_at
      )
      SELECT
        lower(hex(randomblob(16))),
        ?,
        id,
        'pending',
        0,
        CURRENT_TIMESTAMP
      FROM push_subscriptions
    `)
    .bind(news.id)
    .run()

}


export async function reenqueueNewsPushDeliveries(
  env: Env,
  news: { id: string },
  operatorUserId?: string,
): Promise<{ configured: boolean; queued: number }> {
  if (!isPushConfigured(env)) {
    return { configured: false, queued: 0 }
  }

  if (operatorUserId === undefined) {
    // 既存の内部呼び出しとの互換性。HTTP経由の再通知では必ず操作者IDを渡し、権限・設定で絞り込む。
    const legacyResult = await env.DB.prepare(
      "INSERT INTO push_notification_deliveries (" +
      "id, news_id, subscription_id, status, attempt_count, next_attempt_at" +
      ") SELECT lower(hex(randomblob(16))), ?, id, 'pending', 0, CURRENT_TIMESTAMP " +
      "FROM push_subscriptions WHERE 1 " +
      "ON CONFLICT(news_id, subscription_id) DO UPDATE SET " +
      "status = 'pending', attempt_count = 0, next_attempt_at = CURRENT_TIMESTAMP, " +
      "lease_until = NULL, last_error = NULL, updated_at = CURRENT_TIMESTAMP",
    ).bind(news.id).run()
    return { configured: true, queued: legacyResult.meta?.changes ?? 0 }
  }

  const users = await env.DB.prepare("SELECT id FROM users").all<{ id: string }>()
  const eligible = await Promise.all(users.results.map(async user => ({
    id: user.id,
    allowed: user.id !== operatorUserId && await hasPermission(env, user.id, "news.view"),
  })))
  const recipientIds = eligible.filter(user => user.allowed).map(user => user.id)

  if (recipientIds.length === 0) {
    return { configured: true, queued: 0 }
  }

  const placeholders = recipientIds.map(() => "?").join(", ")
  const result = await env.DB.prepare(
    "INSERT INTO push_notification_deliveries (" +
    "id, news_id, subscription_id, status, attempt_count, next_attempt_at" +
    ") SELECT lower(hex(randomblob(16))), ?, s.id, 'pending', 0, CURRENT_TIMESTAMP " +
    "FROM push_subscriptions s " +
    "LEFT JOIN notification_user_settings us ON us.user_id = s.user_id " +
    "LEFT JOIN notification_category_settings cs " +
    "ON cs.user_id = s.user_id AND cs.category = 'news' " +
    "WHERE s.user_id IN (" + placeholders + ") " +
    "AND COALESCE(us.global_push_enabled, 1) = 1 " +
    "AND COALESCE(cs.push_enabled, 1) = 1 " +
    "ON CONFLICT(news_id, subscription_id) DO UPDATE SET " +
    "status = 'pending', attempt_count = 0, next_attempt_at = CURRENT_TIMESTAMP, " +
    "lease_until = NULL, last_error = NULL, updated_at = CURRENT_TIMESTAMP",
  ).bind(news.id, ...recipientIds).run()

  return {
    configured: true,
    queued: result.meta?.changes ?? 0,
  }
}

async function sendPush(
  env: Env,
  subscription: Pick<PushSubscriptionRecord, "endpoint" | "p256dh" | "auth">,
  news: { id: string; title: string; detail: string },
): Promise<Response> {
  if (!env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID_PRIVATE_KEY is not configured")
  }

  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK: JSON.parse(env.VAPID_PRIVATE_KEY),
    subscription: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    },
    message: {
      payload: {
        title: news.title,
        body: formatPushBody(news.detail),
        icon: "/pwa-192x192.png",
        badge: "/pwa-64x64.png",
        tag: news.id,
        url: `/news/${news.id}`,
      },
      adminContact: env.VAPID_SUBJECT || "https://38r-seiryofes.com",
      options: {
        ttl: 86400,
        urgency: "normal",
        topic: news.id.replace(/-/g, "").slice(0, 32),
      },
    },
  })

  return fetch(endpoint, {
    method: "POST",
    headers,
    body,
  })
}

async function updateDelivery(
  env: Env,
  deliveryId: string,
  values: {
    status: "pending" | "sent" | "failed"
    attemptCount: number
    retryDelayMinutes?: number
    error?: string | null
  },
): Promise<void> {
  await env.DB
    .prepare(`
      UPDATE push_notification_deliveries
      SET
        status = ?,
        attempt_count = ?,
        next_attempt_at = CASE
          WHEN ? IS NULL THEN next_attempt_at
          ELSE datetime('now', '+' || ? || ' minutes')
        END,
        lease_until = NULL,
        last_error = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    .bind(
      values.status,
      values.attemptCount,
      values.retryDelayMinutes ?? null,
      values.retryDelayMinutes ?? null,
      values.error ?? null,
      deliveryId,
    )
    .run()
}

async function processOneDelivery(
  env: Env,
  delivery: PushDeliveryRecord,
): Promise<void> {
  if (delivery.attempt_count >= MAX_ATTEMPTS) {
    await updateDelivery(env, delivery.delivery_id, {
      status: "failed",
      attemptCount: MAX_ATTEMPTS,
      error: "Maximum attempts reached after an interrupted send",
    })
    return
  }

  const attemptNumber = delivery.attempt_count + 1
  const claimed = await env.DB
    .prepare(`
      UPDATE push_notification_deliveries
      SET
        status = 'sending',
        attempt_count = attempt_count + 1,
        lease_until = datetime('now', '+2 minutes'),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND (
          (status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP)
          OR (status = 'sending' AND lease_until <= CURRENT_TIMESTAMP)
        )
    `)
    .bind(delivery.delivery_id)
    .run()

  if ((claimed.meta?.changes ?? 0) !== 1) {
    return
  }

  try {
    const response = await sendPush(env, delivery, {
      id: delivery.news_id,
      title: delivery.title,
      detail: delivery.detail,
    })

    if (response.ok) {
      await updateDelivery(env, delivery.delivery_id, {
        status: "sent",
        attemptCount: attemptNumber,
      })
      return
    }

    if (response.status === 404 || response.status === 410) {
      await env.DB
        .prepare("DELETE FROM push_subscriptions WHERE id = ?")
        .bind(delivery.subscription_id)
        .run()
      return
    }

    if (response.status === 429 || response.status >= 500) {
      if (attemptNumber >= MAX_ATTEMPTS) {
        await updateDelivery(env, delivery.delivery_id, {
          status: "failed",
          attemptCount: attemptNumber,
          error: `Push service returned ${response.status}`,
        })
        return
      }

      const delay = RETRY_DELAYS_MINUTES[attemptNumber - 1]
      await updateDelivery(env, delivery.delivery_id, {
        status: "pending",
        attemptCount: attemptNumber,
        retryDelayMinutes: delay,
        error: `Push service returned ${response.status}`,
      })
      return
    }

    await updateDelivery(env, delivery.delivery_id, {
      status: "failed",
      attemptCount: attemptNumber,
      error: `Push service returned ${response.status}`,
    })

    if (response.status === 401 || response.status === 403) {
      console.error("Web Push authentication/configuration error:", response.status)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown push error"

    if (attemptNumber >= MAX_ATTEMPTS) {
      await updateDelivery(env, delivery.delivery_id, {
        status: "failed",
        attemptCount: attemptNumber,
        error: message.slice(0, 300),
      })
      return
    }

    const delay = RETRY_DELAYS_MINUTES[attemptNumber - 1]
    await updateDelivery(env, delivery.delivery_id, {
      status: "pending",
      attemptCount: attemptNumber,
      retryDelayMinutes: delay,
      error: message.slice(0, 300),
    })
  }
}

export async function processDuePushDeliveries(env: Env): Promise<void> {
  if (!isPushConfigured(env)) {
    return
  }

  const result = await env.DB
    .prepare(`
      SELECT
        d.id AS delivery_id,
        d.news_id,
        d.subscription_id,
        d.attempt_count,
        s.endpoint,
        s.p256dh,
        s.auth,
        n.title,
        n.detail
      FROM push_notification_deliveries d
      INNER JOIN push_subscriptions s ON s.id = d.subscription_id
      INNER JOIN news n ON n.id = d.news_id
      WHERE
        (d.status = 'pending' AND d.next_attempt_at <= CURRENT_TIMESTAMP)
        OR
        (d.status = 'sending' AND d.lease_until <= CURRENT_TIMESTAMP)
      ORDER BY d.created_at ASC
      LIMIT ?
    `)
    .bind(MAX_BATCH_SIZE)
    .all<PushDeliveryRecord>()

  // 暗号化と外部送信を一度に大量実行しないよう、10件ずつ処理する。
  for (let offset = 0; offset < result.results.length; offset += 10) {
    const batch = result.results.slice(offset, offset + 10)

    await Promise.all(
      batch.map((delivery) => processOneDelivery(env, delivery)),
    )
  }
}


interface NotificationPushDeliveryRecord {
  delivery_id: string
  notification_id: string
  subscription_id: string
  attempt_count: number
  endpoint: string
  p256dh: string
  auth: string
  title: string
  body: string
  target_url: string | null
  recipient_user_id: string
  category: string
  event_key: string
  required_permission: string | null
  entity_type: string | null
  entity_id: string | null
}

export async function enqueueNotificationPushDeliveries(
  env: Env,
  notificationId: string,
): Promise<number> {
  if (!isPushConfigured(env)) return 0

  const result = await env.DB.prepare(
    "INSERT OR IGNORE INTO notification_push_deliveries (" +
    "id, notification_id, subscription_id, status, attempt_count, next_attempt_at" +
    ") SELECT lower(hex(randomblob(16))), n.id, s.id, 'pending', 0, CURRENT_TIMESTAMP " +
    "FROM notifications n " +
    "INNER JOIN push_subscriptions s ON s.user_id = n.recipient_user_id " +
    "LEFT JOIN notification_user_settings us ON us.user_id = n.recipient_user_id " +
    "LEFT JOIN notification_category_settings cs " +
    "ON cs.user_id = n.recipient_user_id AND cs.category = n.category " +
    "WHERE n.id = ? " +
    "AND COALESCE(us.global_push_enabled, 1) = 1 " +
    "AND COALESCE(cs.push_enabled, 1) = 1",
  ).bind(notificationId).run()

  return result.meta?.changes ?? 0
}

async function updateNotificationDelivery(
  env: Env,
  deliveryId: string,
  values: {
    status: "pending" | "sent" | "failed"
    attemptCount: number
    retryDelayMinutes?: number
    error?: string | null
  },
): Promise<void> {
  await env.DB.prepare(
    "UPDATE notification_push_deliveries SET " +
    "status = ?, attempt_count = ?, " +
    "next_attempt_at = CASE WHEN ? IS NULL THEN next_attempt_at " +
    "ELSE datetime('now', '+' || ? || ' minutes') END, " +
    "lease_until = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP " +
    "WHERE id = ?",
  ).bind(
    values.status,
    values.attemptCount,
    values.retryDelayMinutes ?? null,
    values.retryDelayMinutes ?? null,
    values.error ?? null,
    deliveryId,
  ).run()
}

async function sendNotificationPush(
  env: Env,
  delivery: NotificationPushDeliveryRecord,
): Promise<Response> {
  if (!env.VAPID_PRIVATE_KEY) {
    throw new Error("VAPID_PRIVATE_KEY is not configured")
  }

  const targetUrl = delivery.target_url &&
    delivery.target_url.startsWith("/") &&
    !delivery.target_url.startsWith("//")
    ? delivery.target_url
    : "/notifications"

  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK: JSON.parse(env.VAPID_PRIVATE_KEY),
    subscription: {
      endpoint: delivery.endpoint,
      keys: {
        p256dh: delivery.p256dh,
        auth: delivery.auth,
      },
    },
    message: {
      payload: {
        title: delivery.title,
        body: formatPushBody(delivery.body || "新しい通知があります。"),
        icon: "/pwa-192x192.png",
        badge: "/pwa-64x64.png",
        tag: delivery.notification_id,
        url: targetUrl,
      },
      adminContact: env.VAPID_SUBJECT || "https://38r-seiryofes.com",
      options: {
        ttl: 86400,
        urgency: "normal",
        topic: delivery.notification_id.replace(/-/g, "").slice(0, 32),
      },
    },
  })

  return fetch(endpoint, { method: "POST", headers, body })
}

async function canAccessNotificationTarget(
  env: Env,
  delivery: NotificationPushDeliveryRecord,
): Promise<boolean> {
  if (
    delivery.required_permission !== null &&
    !(await hasPermission(env, delivery.recipient_user_id, delivery.required_permission))
  ) {
    return false
  }

  if (delivery.entity_type === "calendar_event" && delivery.entity_id) {
    const event = await env.DB.prepare(
      "SELECT 1 FROM calendar_events WHERE id = ?",
    ).bind(delivery.entity_id).first()
    if (!event) return false
  }

  if (delivery.entity_type === "decision" && delivery.entity_id) {
    const decision = await env.DB.prepare(
      "SELECT 1 FROM decisions WHERE id = ?",
    ).bind(delivery.entity_id).first()
    if (!decision) return false
  }

  if (delivery.entity_type === "wishlist_item" && delivery.entity_id) {
    const item = await env.DB.prepare(
      "SELECT 1 FROM wishlist_items WHERE id = ?",
    ).bind(delivery.entity_id).first()
    if (!item) return false
  }

  if (delivery.entity_type === "milk_collection_request" && delivery.entity_id) {
    const item = await env.DB.prepare(
      "SELECT 1 FROM milk_collection_requests WHERE id = ?",
    ).bind(delivery.entity_id).first()
    if (!item) return false
  }

  if (delivery.entity_type === "submission" && delivery.entity_id) {
    const submission = await env.DB.prepare(
      "SELECT 1 FROM submissions WHERE id = ?",
    ).bind(delivery.entity_id).first()
    if (!submission) return false
  }

  if (delivery.entity_type === "task" && delivery.entity_id) {
    if (delivery.event_key === "task.assignee_removed") {
      return hasPermission(env, delivery.recipient_user_id, "tasks.view")
    }

    const access = await env.DB.prepare(
      "SELECT 1 FROM tasks t " +
      "LEFT JOIN task_assignees ta ON ta.task_id = t.id " +
      "LEFT JOIN task_roles tr ON tr.task_id = t.id " +
      "LEFT JOIN user_roles ur ON ur.role_id = tr.role_id AND ur.user_id = ? " +
      "WHERE t.id = ? AND (t.created_by = ? OR ta.user_id = ? OR ur.user_id IS NOT NULL) " +
      "LIMIT 1",
    ).bind(
      delivery.recipient_user_id,
      delivery.entity_id,
      delivery.recipient_user_id,
      delivery.recipient_user_id,
    ).first<{ 1: number }>()

    return Boolean(access)
  }

  if (delivery.entity_type === "reimbursement" && delivery.entity_id) {
    const reimbursement = await env.DB.prepare(
      "SELECT user_id FROM receipt_reimbursements WHERE id = ?",
    ).bind(delivery.entity_id).first<{ user_id: string }>()
    if (!reimbursement) return false
    if (
      reimbursement.user_id !== delivery.recipient_user_id &&
      !(await hasPermission(env, delivery.recipient_user_id, "accounting.approve"))
    ) {
      return false
    }
  }

  if (delivery.entity_type === "file" && delivery.entity_id) {
    const file = await env.DB.prepare(
      "SELECT archived_at FROM files WHERE id = ?",
    ).bind(delivery.entity_id).first<{ archived_at: string | null }>()
    if (!file || file.archived_at !== null) return false

    const links = await env.DB.prepare(
      "SELECT " +
      "EXISTS (SELECT 1 FROM receipt_files WHERE file_id = ?) AS has_receipt, " +
      "EXISTS (SELECT 1 FROM task_files WHERE file_id = ?) AS has_task, " +
      "EXISTS (SELECT 1 FROM decision_files WHERE file_id = ?) AS has_decision, " +
      "EXISTS (SELECT 1 FROM submission_record_files WHERE file_id = ?) AS has_submission",
    ).bind(
      delivery.entity_id,
      delivery.entity_id,
      delivery.entity_id,
      delivery.entity_id,
    ).first<{
      has_receipt: number
      has_task: number
      has_decision: number
      has_submission: number
    }>()

    if (!links) return false
    const linkedAccessChecks: Promise<boolean>[] = []
    if (links.has_receipt) {
      linkedAccessChecks.push(hasPermission(env, delivery.recipient_user_id, "accounting.view"))
    }
    if (links.has_task) {
      linkedAccessChecks.push(hasPermission(env, delivery.recipient_user_id, "tasks.view"))
    }
    if (links.has_decision) {
      linkedAccessChecks.push(hasPermission(env, delivery.recipient_user_id, "decisions.view"))
    }
    if (links.has_submission) {
      linkedAccessChecks.push(hasPermission(env, delivery.recipient_user_id, "submissions.view"))
    }
    if (linkedAccessChecks.length > 0 && !(await Promise.all(linkedAccessChecks)).some(Boolean)) {
      return false
    }
  }

  if (
    delivery.entity_type === "tool_loan" &&
    delivery.entity_id &&
    (delivery.event_key.startsWith("tool_rental.due_soon:") ||
      delivery.event_key.startsWith("tool_rental.overdue:"))
  ) {
    const loan = await env.DB.prepare(
      "SELECT status FROM loans WHERE id = ?",
    ).bind(Number(delivery.entity_id)).first<{ status: string }>()
    if (!loan || loan.status !== "borrowed") return false
  }

  if (
    delivery.entity_type === "tool_loan_item" &&
    delivery.event_key.startsWith("tool_rental.timer_end:") &&
    delivery.entity_id
  ) {
    const item = await env.DB.prepare(
      "SELECT li.returned_at, l.status FROM loan_items li " +
      "INNER JOIN loans l ON l.id = li.loan_id WHERE li.id = ?",
    ).bind(Number(delivery.entity_id)).first<{ returned_at: string | null; status: string }>()
    if (!item || item.returned_at !== null || item.status !== "borrowed") return false
  }

  if (delivery.entity_type === "survey" && delivery.entity_id) {
    const survey = await env.DB.prepare(
      "SELECT status, deadline_at FROM surveys WHERE id = ?",
    ).bind(delivery.entity_id).first<{
      status: string
      deadline_at: string | null
    }>()

    if (!survey) return false

    if (
      (delivery.event_key === "surveys.published" || delivery.event_key === "surveys.opened") &&
      survey.status !== "published"
    ) {
      return false
    }

    if (delivery.event_key === "surveys.closed" && survey.status !== "closed") {
      return false
    }

    if (
      delivery.event_key === "surveys.response_reminder_24h" ||
      delivery.event_key === "surveys.response_reminder_1h"
    ) {
      if (
        survey.status !== "published" ||
        !survey.deadline_at ||
        Date.parse(survey.deadline_at) <= Date.now()
      ) {
        return false
      }

      const participation = await env.DB.prepare(
        "SELECT 1 FROM survey_participation WHERE survey_id = ? AND user_id = ? LIMIT 1",
      ).bind(delivery.entity_id, delivery.recipient_user_id).first()

      if (participation) return false
    }
  }

  return true
}

async function processOneNotificationDelivery(
  env: Env,
  delivery: NotificationPushDeliveryRecord,
): Promise<void> {
  if (delivery.attempt_count >= MAX_ATTEMPTS) {
    await updateNotificationDelivery(env, delivery.delivery_id, {
      status: "failed",
      attemptCount: MAX_ATTEMPTS,
      error: "Maximum attempts reached after an interrupted send",
    })
    return
  }

  const attemptNumber = delivery.attempt_count + 1
  const claimed = await env.DB.prepare(
    "UPDATE notification_push_deliveries SET status = 'sending', " +
    "attempt_count = attempt_count + 1, lease_until = datetime('now', '+2 minutes'), " +
    "updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (" +
    "(status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP) OR " +
    "(status = 'sending' AND lease_until <= CURRENT_TIMESTAMP))",
  ).bind(delivery.delivery_id).run()

  if ((claimed.meta?.changes ?? 0) !== 1) return

  try {
    const preferences = await env.DB.prepare(
      "SELECT COALESCE(us.global_push_enabled, 1) AS global_enabled, " +
      "COALESCE(cs.push_enabled, 1) AS category_enabled " +
      "FROM (SELECT 1) seed " +
      "LEFT JOIN notification_user_settings us ON us.user_id = ? " +
      "LEFT JOIN notification_category_settings cs " +
      "ON cs.user_id = ? AND cs.category = ?",
    ).bind(delivery.recipient_user_id, delivery.recipient_user_id, delivery.category)
      .first<{ global_enabled: number; category_enabled: number }>()
    const effectivePreferences = preferences ?? { global_enabled: 1, category_enabled: 1 }

    if (
      effectivePreferences.global_enabled !== 1 ||
      effectivePreferences.category_enabled !== 1 ||
      !(await canAccessNotificationTarget(env, delivery))
    ) {
      await updateNotificationDelivery(env, delivery.delivery_id, {
        status: "failed",
        attemptCount: attemptNumber,
        error: "Delivery suppressed by current user settings or access permissions",
      })
      return
    }

    const response = await sendNotificationPush(env, delivery)

    if (response.ok) {
      await updateNotificationDelivery(env, delivery.delivery_id, {
        status: "sent",
        attemptCount: attemptNumber,
      })
      return
    }

    if (response.status === 404 || response.status === 410) {
      await env.DB.prepare(
        "DELETE FROM push_subscriptions WHERE id = ?",
      ).bind(delivery.subscription_id).run()
      return
    }

    if (response.status === 429 || response.status >= 500) {
      if (attemptNumber >= MAX_ATTEMPTS) {
        await updateNotificationDelivery(env, delivery.delivery_id, {
          status: "failed",
          attemptCount: attemptNumber,
          error: "Push service returned " + response.status,
        })
      } else {
        await updateNotificationDelivery(env, delivery.delivery_id, {
          status: "pending",
          attemptCount: attemptNumber,
          retryDelayMinutes: RETRY_DELAYS_MINUTES[attemptNumber - 1],
          error: "Push service returned " + response.status,
        })
      }
      return
    }

    await updateNotificationDelivery(env, delivery.delivery_id, {
      status: "failed",
      attemptCount: attemptNumber,
      error: "Push service returned " + response.status,
    })

    if (response.status === 401 || response.status === 403) {
      console.error("Web Push authentication/configuration error:", response.status)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown push error"
    if (attemptNumber >= MAX_ATTEMPTS) {
      await updateNotificationDelivery(env, delivery.delivery_id, {
        status: "failed",
        attemptCount: attemptNumber,
        error: message.slice(0, 300),
      })
    } else {
      await updateNotificationDelivery(env, delivery.delivery_id, {
        status: "pending",
        attemptCount: attemptNumber,
        retryDelayMinutes: RETRY_DELAYS_MINUTES[attemptNumber - 1],
        error: message.slice(0, 300),
      })
    }
  }
}

export async function processDueNotificationPushDeliveries(env: Env): Promise<void> {
  if (!isPushConfigured(env)) return

  const result = await env.DB.prepare(
    "SELECT d.id AS delivery_id, d.notification_id, d.subscription_id, " +
    "d.attempt_count, s.endpoint, s.p256dh, s.auth, n.title, n.body, n.target_url, " +
    "n.recipient_user_id, n.category, n.event_key, n.required_permission, n.entity_type, n.entity_id " +
    "FROM notification_push_deliveries d " +
    "INNER JOIN push_subscriptions s ON s.id = d.subscription_id " +
    "INNER JOIN notifications n ON n.id = d.notification_id " +
    "WHERE (d.status = 'pending' AND d.next_attempt_at <= CURRENT_TIMESTAMP) " +
    "OR (d.status = 'sending' AND d.lease_until <= CURRENT_TIMESTAMP) " +
    "ORDER BY d.created_at ASC LIMIT ?",
  ).bind(MAX_BATCH_SIZE).all<NotificationPushDeliveryRecord>()

  for (let offset = 0; offset < result.results.length; offset += 10) {
    const batch = result.results.slice(offset, offset + 10)
    await Promise.all(batch.map(delivery =>
      processOneNotificationDelivery(env, delivery),
    ))
  }
}
