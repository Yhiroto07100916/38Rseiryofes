import { hasPermission } from "./authz"
import { createNotificationsForUsers } from "./notifications"

const FILE_FEATURE_PERMISSIONS = [
  { table: "task_files", permission: "tasks.view" },
  { table: "receipt_files", permission: "accounting.view" },
  { table: "decision_files", permission: "decisions.view" },
  { table: "submission_record_files", permission: "submissions.view" },
] as const

export async function notifyFileLinked(
  env: { DB: D1Database },
  fileId: string,
  actorUserId: string,
): Promise<void> {
  const file = await env.DB.prepare(
    "SELECT original_name, notify_on_upload, access_scope, uploaded_by FROM files WHERE id = ?",
  ).bind(fileId).first<{
    original_name: string
    notify_on_upload: number
    access_scope: 'all' | 'selected'
    uploaded_by: string
  }>()

  if (!file || file.notify_on_upload !== 1) return

  const allowedUserIds = file.access_scope === 'selected'
    ? new Set((await env.DB.prepare(
      "SELECT user_id FROM file_user_access WHERE file_id = ?",
    ).bind(fileId).all<{ user_id: string }>()).results.map(row => row.user_id))
    : null

  const linkedFeatures = await Promise.all(FILE_FEATURE_PERMISSIONS.map(async feature => {
    const linked = await env.DB.prepare(
      "SELECT 1 AS linked FROM " + feature.table + " WHERE file_id = ? LIMIT 1",
    ).bind(fileId).first<{ linked: number }>()
    return linked ? feature.permission : null
  }))

  const permissions = [...new Set(linkedFeatures.filter((value): value is string => value !== null))]
  if (permissions.length === 0) return

  const users = await env.DB.prepare("SELECT id FROM users").all<{ id: string }>()
  const eligible = await Promise.all(users.results.map(async user => {
    if (user.id === actorUserId) return false
    if (
      allowedUserIds &&
      user.id !== file.uploaded_by &&
      !allowedUserIds.has(user.id)
    ) return false
    for (const permission of permissions) {
      if (await hasPermission(env as Env, user.id, permission)) return true
    }
    return false
  }))

  await createNotificationsForUsers(env as Env, {
    recipientUserIds: users.results.filter((_, index) => eligible[index]).map(user => user.id),
    eventKey: "files.uploaded",
    category: "files",
    title: "新しいファイルがアップロードされました",
    body: file.original_name,
    targetUrl: "/files?open=" + encodeURIComponent(fileId),
    actorUserId,
    entityType: "file",
    entityId: fileId,
    dedupeKey: "files.uploaded:" + fileId,
  })
}
