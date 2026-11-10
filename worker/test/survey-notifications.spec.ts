declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env, SELF } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { createSession } from "../src/lib/session"
import { processDueSurveyNotifications } from "../src/routes/surveys"

const userIds: string[] = []
const sessionIds: string[] = []
const surveyIds: string[] = []

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__))
})

afterEach(async () => {
  for (const surveyId of surveyIds.splice(0)) {
    await env.DB.prepare("DELETE FROM surveys WHERE id = ?")
      .bind(surveyId).run()
  }
  for (const sessionId of sessionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId).run()
  }
  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(userId).run()
  }
})

async function createUser(name: string, permissions: string[] = []) {
  const userId = crypto.randomUUID()
  userIds.push(userId)
  await env.DB.prepare(
    "INSERT INTO users (id, student_number, name, nickname) VALUES (?, ?, ?, NULL)",
  ).bind(userId, "survey-test-" + userId, name).run()

  for (const permission of permissions) {
    await env.DB.prepare(
      "INSERT INTO user_permissions (user_id, permission_id, effect) " +
      "SELECT ?, id, 'allow' FROM permissions WHERE key = ?",
    ).bind(userId, permission).run()
  }

  const sessionId = await createSession(env, userId)
  sessionIds.push(sessionId)
  return { userId, cookie: "session_id=" + sessionId }
}

async function insertSurvey(
  createdBy: string,
  values: {
    title: string
    status?: string
    startsAt?: string | null
    deadlineAt?: string | null
  },
) {
  const surveyId = crypto.randomUUID()
  surveyIds.push(surveyId)
  await env.DB.prepare(`
    INSERT INTO surveys (
      id, title, description, response_type, is_anonymous, status,
      starts_at, deadline_at, created_by
    ) VALUES (?, ?, NULL, 'free_text', 0, ?, ?, ?, ?)
  `).bind(
    surveyId,
    values.title,
    values.status ?? "published",
    values.startsAt ?? null,
    values.deadlineAt ?? null,
    createdBy,
  ).run()
  return surveyId
}

describe("Survey notification events", () => {
  it("notifies eligible respondents when a survey is published", async () => {
    const creator = await createUser("作成者", ["surveys.create", "surveys.view"])
    const respondent = await createUser("回答者", ["surveys.view", "surveys.respond"])

    const response = await SELF.fetch("http://example.com/api/surveys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: creator.cookie,
      },
      body: JSON.stringify({
        title: "上演時間アンケート",
        description: null,
        response_type: "free_text",
        status: "published",
      }),
    })

    expect(response.status).toBe(201)
    const body = await response.json() as { survey: { id: string } }
    const surveyId = body.survey.id
    surveyIds.push(surveyId)

    const notification = await env.DB.prepare(
      "SELECT event_key, recipient_user_id, title, target_url FROM notifications " +
      "WHERE entity_type = 'survey' AND entity_id = ?",
    ).bind(surveyId).first<{
      event_key: string
      recipient_user_id: string
      title: string
      target_url: string
    }>()

    expect(notification).toMatchObject({
      event_key: "surveys.published",
      recipient_user_id: respondent.userId,
      title: "アンケートが公開されました",
      target_url: "/surveys?open=" + surveyId,
    })

    const creatorNotification = await env.DB.prepare(
      "SELECT id FROM notifications WHERE entity_type = 'survey' " +
      "AND entity_id = ? AND recipient_user_id = ?",
    ).bind(surveyId, creator.userId).first()
    expect(creatorNotification).toBeNull()
  })

  it("opens scheduled surveys and closes overdue surveys", async () => {
    const creator = await createUser("作成者")
    const respondent = await createUser("回答者", ["surveys.view", "surveys.respond"])
    const openedId = await insertSurvey(creator.userId, {
      title: "予約公開アンケート",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      deadlineAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    })
    const closedId = await insertSurvey(creator.userId, {
      title: "期限切れアンケート",
      deadlineAt: new Date(Date.now() - 60_000).toISOString(),
    })

    await processDueSurveyNotifications(env)

    const opened = await env.DB.prepare(
      "SELECT event_key, recipient_user_id FROM notifications " +
      "WHERE entity_type = 'survey' AND entity_id = ?",
    ).bind(openedId).first<{ event_key: string; recipient_user_id: string }>()

    const closed = await env.DB.prepare(
      "SELECT event_key, recipient_user_id FROM notifications " +
      "WHERE entity_type = 'survey' AND entity_id = ?",
    ).bind(closedId).first<{ event_key: string; recipient_user_id: string }>()

    const closedSurvey = await env.DB.prepare(
      "SELECT status FROM surveys WHERE id = ?",
    ).bind(closedId).first<{ status: string }>()

    expect(opened).toMatchObject({
      event_key: "surveys.opened",
      recipient_user_id: respondent.userId,
    })
    expect(closed).toMatchObject({
      event_key: "surveys.closed",
      recipient_user_id: respondent.userId,
    })
    expect(closedSurvey?.status).toBe("closed")
  })

  it("sends deadline reminders only to respondents who have not answered", async () => {
    const creator = await createUser("作成者")
    const recipient = await createUser("未回答者", ["surveys.view", "surveys.respond"])
    const answered = await createUser("回答済み", ["surveys.view", "surveys.respond"])
    const deadline24h = new Date(Date.now() + 23.5 * 60 * 60_000).toISOString()
    const deadline1h = new Date(Date.now() + 30 * 60_000).toISOString()

    const survey24h = await insertSurvey(creator.userId, {
      title: "24時間前リマインダー",
      deadlineAt: deadline24h,
    })
    const survey1h = await insertSurvey(creator.userId, {
      title: "1時間前リマインダー",
      deadlineAt: deadline1h,
    })

    await env.DB.prepare(
      "INSERT INTO survey_participation (survey_id, user_id) VALUES (?, ?)",
    ).bind(survey24h, answered.userId).run()
    await env.DB.prepare(
      "INSERT INTO survey_participation (survey_id, user_id) VALUES (?, ?)",
    ).bind(survey1h, answered.userId).run()

    await processDueSurveyNotifications(env)

    const reminders = await env.DB.prepare(
      "SELECT event_key, entity_id, recipient_user_id FROM notifications " +
      "WHERE entity_type = 'survey' AND event_key LIKE 'surveys.response_reminder_%'",
    ).all<{
      event_key: string
      entity_id: string
      recipient_user_id: string
    }>()

    expect(reminders.results).toContainEqual({
      event_key: "surveys.response_reminder_24h",
      entity_id: survey24h,
      recipient_user_id: recipient.userId,
    })
    expect(reminders.results).toContainEqual({
      event_key: "surveys.response_reminder_1h",
      entity_id: survey1h,
      recipient_user_id: recipient.userId,
    })
    expect(reminders.results.some(row => row.recipient_user_id === answered.userId)).toBe(false)
  })
})
