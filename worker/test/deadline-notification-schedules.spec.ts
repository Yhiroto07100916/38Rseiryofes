declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { processDueTaskNotifications } from "../src/routes/tasks"
import { processDueSubmissionNotifications } from "../src/routes/submissions"

const fixtureIds: { users: string[]; roles: string[]; tasks: string[]; submissions: string[] } = {
  users: [],
  roles: [],
  tasks: [],
  submissions: [],
}
let previousNotificationSettings: string | null = null

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__))
})

afterEach(async () => {
  vi.useRealTimers()
  const taskPlaceholders = fixtureIds.tasks.map(() => "?").join(",")
  const submissionPlaceholders = fixtureIds.submissions.map(() => "?").join(",")
  const conditions = [
    fixtureIds.tasks.length ? "entity_id IN (SELECT id FROM tasks WHERE id IN (" + taskPlaceholders + "))" : null,
    fixtureIds.submissions.length ? "entity_id IN (SELECT id FROM submissions WHERE id IN (" + submissionPlaceholders + "))" : null,
  ].filter(Boolean)
  if (conditions.length) {
    await env.DB.prepare("DELETE FROM notifications WHERE " + conditions.join(" OR "))
      .bind(...fixtureIds.tasks, ...fixtureIds.submissions).run()
  }
  if (fixtureIds.tasks.length) {
    await env.DB.prepare("DELETE FROM tasks WHERE id IN (" + taskPlaceholders + ")")
      .bind(...fixtureIds.tasks).run()
  }
  if (fixtureIds.submissions.length) {
    await env.DB.prepare("DELETE FROM submissions WHERE id IN (" + submissionPlaceholders + ")")
      .bind(...fixtureIds.submissions).run()
  }
  if (fixtureIds.users.length) {
    await env.DB.prepare("DELETE FROM users WHERE id IN (" + fixtureIds.users.map(() => "?").join(",") + ")")
      .bind(...fixtureIds.users).run()
  }
  if (fixtureIds.roles.length) {
    await env.DB.prepare("DELETE FROM roles WHERE id IN (" + fixtureIds.roles.map(() => "?").join(",") + ")")
      .bind(...fixtureIds.roles).run()
  }
  fixtureIds.users = []
  fixtureIds.roles = []
  fixtureIds.tasks = []
  fixtureIds.submissions = []
  if (previousNotificationSettings !== null) {
    await env.DB.prepare("UPDATE site_settings SET value = ? WHERE key = 'notification_settings'")
      .bind(previousNotificationSettings).run()
    previousNotificationSettings = null
  }
})

async function createUser(): Promise<string> {
  const id = crypto.randomUUID()
  fixtureIds.users.push(id)
  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name, nickname) VALUES (?, ?, ?, NULL)",
  ).bind(id, "deadline-test-" + id, "締め切り通知テスト").run()
  return id
}

async function setNotificationSettings(): Promise<void> {
  const previous = await env.DB.prepare(
    "SELECT value FROM site_settings WHERE key = 'notification_settings'",
  ).first<{ value: string }>()
  previousNotificationSettings = previous?.value ?? null
  await env.DB.prepare(
    "UPDATE site_settings SET value = ? WHERE key = 'notification_settings'",
  ).bind(JSON.stringify({
    enabled: true,
    categories: { tasks: true, submissions: true },
    return_due_all_users: true,
    deadline_reminders: { tasks: [4320, 30], submissions: [10080, 5] },
    daily_schedule: { enabled: false, time: "08:00" },
  })).run()
}

describe("Configurable task and submission deadline reminders", () => {
  it("uses selected offsets and deduplicates repeated cron runs", async () => {
    const userId = await createUser()
    const roleId = crypto.randomUUID()
    const taskId = crypto.randomUUID()
    const submissionId = crypto.randomUUID()
    fixtureIds.roles.push(roleId)
    fixtureIds.tasks.push(taskId)
    fixtureIds.submissions.push(submissionId)

    await env.DB.prepare("INSERT INTO roles (id, name, description) VALUES (?, ?, NULL)")
      .bind(roleId, "deadline-test-role-" + roleId).run()
    await env.DB.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
      .bind(userId, roleId).run()

    const now = new Date("2026-11-27T00:00:00.000Z")
    vi.useFakeTimers()
    vi.setSystemTime(now)
    await setNotificationSettings()

    const taskDueAt = new Date(now.getTime() + 4320 * 60_000).toISOString()
    await env.DB.prepare(
      "INSERT INTO tasks (id, title, scope, status, priority, due_at, created_by) VALUES (?, ?, 'class', 'todo', 'medium', ?, ?)",
    ).bind(taskId, "3日前のタスク通知", taskDueAt, userId).run()
    await env.DB.prepare("INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)")
      .bind(taskId, userId).run()

    const submissionDueAt = new Date(now.getTime() + 10080 * 60_000).toISOString()
    await env.DB.prepare(
      "INSERT INTO submissions (id, title, destination, due_at, assigned_role_id, status, created_by) VALUES (?, ?, ?, ?, ?, 'preparing', ?)",
    ).bind(submissionId, "7日前の提出物通知", "テスト提出先", submissionDueAt, roleId, userId).run()

    await processDueTaskNotifications(env)
    await processDueTaskNotifications(env)
    await processDueSubmissionNotifications(env)
    await processDueSubmissionNotifications(env)

    const taskRows = await env.DB.prepare(
      "SELECT event_key, recipient_user_id FROM notifications WHERE entity_type = 'task' AND entity_id = ?",
    ).bind(taskId).all<{ event_key: string; recipient_user_id: string }>()
    expect(taskRows.results).toEqual([
      { event_key: "task.deadline_reminder_3d", recipient_user_id: userId },
    ])

    const submissionRows = await env.DB.prepare(
      "SELECT event_key, recipient_user_id FROM notifications WHERE entity_type = 'submission' AND entity_id = ?",
    ).bind(submissionId).all<{ event_key: string; recipient_user_id: string }>()
    expect(submissionRows.results).toEqual([
      { event_key: "submissions.deadline_reminder_7d", recipient_user_id: userId },
    ])
  })

  it("does not send deadline reminders for already submitted submissions", async () => {
    const userId = await createUser()
    const roleId = crypto.randomUUID()
    const submissionId = crypto.randomUUID()
    fixtureIds.roles.push(roleId)
    fixtureIds.submissions.push(submissionId)

    await env.DB.prepare("INSERT INTO roles (id, name, description) VALUES (?, ?, NULL)")
      .bind(roleId, "deadline-test-role-" + roleId).run()
    await env.DB.prepare("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)")
      .bind(userId, roleId).run()

    const now = new Date("2026-11-27T00:00:00.000Z")
    vi.useFakeTimers()
    vi.setSystemTime(now)
    await setNotificationSettings()

    const dueAt = new Date(now.getTime() + 4320 * 60_000).toISOString()
    await env.DB.prepare(
      "INSERT INTO submissions (id, title, destination, due_at, assigned_role_id, status, created_by) VALUES (?, ?, ?, ?, ?, 'submitted', ?)",
    ).bind(submissionId, "提出済み", "テスト提出先", dueAt, roleId, userId).run()

    await processDueSubmissionNotifications(env)

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM notifications WHERE entity_type = 'submission' AND entity_id = ?",
    ).bind(submissionId).first<{ count: number }>()
    expect(count?.count).toBe(0)
  })
})
