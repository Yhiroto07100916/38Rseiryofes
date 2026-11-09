import { buildPushHTTPRequest } from "@pushforge/builder"
import { requireAuth } from "../lib/authz"

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
    return atob(padded).length === expectedBytes
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
        .prepare("SELECT id FROM push_subscriptions WHERE endpoint = ?")
        .bind(endpoint)
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

      const existingSubscription = await env.DB
        .prepare("SELECT id FROM push_subscriptions WHERE endpoint = ?")
        .bind(endpoint)
        .first<{ id: string }>()

      if (!existingSubscription) {
        const subscriptionCount = await env.DB
          .prepare("SELECT COUNT(*) AS count FROM push_subscriptions")
          .first<{ count: number }>()

        if ((subscriptionCount?.count ?? 0) >= MAX_SUBSCRIPTIONS) {
          return jsonError("Push subscription limit reached", 429)
        }
      }

      await env.DB
        .prepare(`
          INSERT INTO push_subscriptions (
            id,
            endpoint,
            p256dh,
            auth
          )
          VALUES (?, ?, ?, ?)
          ON CONFLICT(endpoint) DO UPDATE SET
            p256dh = excluded.p256dh,
            auth = excluded.auth,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(crypto.randomUUID(), endpoint, p256dh, authKey)
        .run()

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
        .prepare("DELETE FROM push_subscriptions WHERE endpoint = ?")
        .bind(endpoint)
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
