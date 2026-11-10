import { enqueueNotificationPushDeliveries } from "../routes/push"

export interface CreateNotificationsInput {
  recipientUserIds: string[]
  eventKey: string
  category: string
  title: string
  body?: string
  targetUrl?: string | null
  actorUserId?: string | null
  entityType?: string | null
  entityId?: string | null
  dedupeKey: string
}

export async function createNotificationsForUsers(
  env: Env,
  input: CreateNotificationsInput,
): Promise<number> {
  const recipientIds = [...new Set(input.recipientUserIds)]
    .filter(userId => userId && userId !== input.actorUserId)

  if (recipientIds.length === 0) return 0

  const results = await env.DB.batch(
    recipientIds.map(userId => env.DB.prepare(
      "INSERT OR IGNORE INTO notifications (" +
      "id, recipient_user_id, event_key, category, title, body, target_url, actor_user_id, entity_type, entity_id, dedupe_key, expires_at" +
      ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+90 days'))",
    ).bind(
      crypto.randomUUID(),
      userId,
      input.eventKey,
      input.category,
      input.title,
      input.body ?? "",
      input.targetUrl ?? null,
      input.actorUserId ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      input.dedupeKey,
    )),
  )

  let createdCount = 0
  for (let index = 0; index < recipientIds.length; index += 1) {
    if ((results[index]?.meta?.changes ?? 0) !== 1) continue
    createdCount += 1

    const notification = await env.DB.prepare(
      "SELECT id FROM notifications WHERE recipient_user_id = ? AND dedupe_key = ?",
    ).bind(recipientIds[index], input.dedupeKey).first<{ id: string }>()

    if (notification) {
      await enqueueNotificationPushDeliveries(env, notification.id)
    }
  }

  return createdCount
}
