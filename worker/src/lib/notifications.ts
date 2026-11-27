import { getUsersWithPermission } from "./authz"
import { enqueueNotificationPushDeliveries, processDueNotificationPushDeliveries } from "../routes/push"

export interface CreateNotificationsInput {
  recipientUserIds: string[]
  eventKey: string
  category: string
  title: string
  body?: string
  targetUrl?: string | null
  requiredPermission?: string | null
  activityPermission?: string | null
  actorUserId?: string | null
  entityType?: string | null
  entityId?: string | null
  dedupeKey: string
}

const ACTIVITY_PERMISSIONS_BY_CATEGORY: Record<string, string[]> = {
  tasks: ["tasks.view"],
  calendar: ["schedule.view"],
  submissions: ["submissions.view"],
  news: ["news.view"],
  surveys: ["surveys.view"],
  decisions: ["decisions.view"],
  equipment: ["equipment.view"],
  tool_rental: ["tool_rental.view"],
  accounting: ["accounting.view"],
  files: ["tasks.view", "accounting.view", "decisions.view", "submissions.view"],
  milk_collection: ["milk_collection.view"],
  wishlist: ["wishlist.view"],
}

export async function createNotificationsForUsers(
  env: Env,
  input: CreateNotificationsInput,
): Promise<number> {
  // recipientUserIds は従来どおり、個人宛て通知・Pushの対象者。
  const personalRecipientIds = new Set([...new Set(input.recipientUserIds)].filter(Boolean))

  // 閲覧権限を持つユーザーには活動記録も残す。権限が取得できない場合でも
  // 個人宛て通知の作成は継続し、Push対象を誤って広げない。
  const permissionKeys = input.activityPermission
    ? [input.activityPermission]
    : (ACTIVITY_PERMISSIONS_BY_CATEGORY[input.category] ?? [])
  const activityRecipientIds = new Set<string>()

  for (const permission of permissionKeys) {
    try {
      const users = await getUsersWithPermission(env, permission)
      for (const userId of users) activityRecipientIds.add(userId)
    } catch (error) {
      console.error("Failed to resolve notification activity audience:", permission, error)
    }
  }

  const recipientIds = [...new Set([
    ...personalRecipientIds,
    ...activityRecipientIds,
  ])]
  if (recipientIds.length === 0) return 0

  const results = await env.DB.batch(
    recipientIds.map(userId => env.DB.prepare(
      "INSERT OR IGNORE INTO notifications (" +
      "id, recipient_user_id, event_key, category, title, body, target_url, required_permission, actor_user_id, entity_type, entity_id, dedupe_key, is_personal, expires_at, read_updated_at" +
      ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+90 days'), CURRENT_TIMESTAMP)",
    ).bind(
      crypto.randomUUID(),
      userId,
      input.eventKey,
      input.category,
      input.title,
      input.body ?? "",
      input.targetUrl ?? null,
      input.requiredPermission ?? null,
      input.actorUserId ?? null,
      input.entityType ?? null,
      input.entityId ?? null,
      input.dedupeKey,
      personalRecipientIds.has(userId) ? 1 : 0,
    )),
  )

  let createdCount = 0
  for (let index = 0; index < recipientIds.length; index += 1) {
    if ((results[index]?.meta?.changes ?? 0) !== 1) continue
    createdCount += 1

    // 活動記録はアプリ内だけに保存し、Push配信キューには入れない。
    if (!personalRecipientIds.has(recipientIds[index]!)) continue

    const notification = await env.DB.prepare(
      "SELECT id FROM notifications WHERE recipient_user_id = ? AND dedupe_key = ?",
    ).bind(recipientIds[index], input.dedupeKey).first<{ id: string }>()

    if (notification) {
      try {
        await enqueueNotificationPushDeliveries(env, notification.id)
      } catch (error) {
        console.error("Failed to enqueue notification Push delivery:", error)
      }
    }
  }

  if (createdCount > 0) {
    // 通知の作成直後にPush配信を開始する。失敗分はキューに残り、Cronで再試行する。
    try {
      await processDueNotificationPushDeliveries(env)
    } catch (error) {
      console.error("Failed to start notification Push delivery:", error)
    }
  }

  return createdCount
}
