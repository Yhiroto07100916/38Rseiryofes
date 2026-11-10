declare const __D1_MIGRATIONS__: string

import { applyD1Migrations, env } from "cloudflare:test"
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { createSession } from "../src/lib/session"
import { handlePresence } from "../src/routes/presence-notifications"

const userIds: string[] = []
const sessionIds: string[] = []

const presenceEnv = Object.assign(Object.create(env), {
  SCHOOL_LATITUDE: "35",
  SCHOOL_LONGITUDE: "139",
  SCHOOL_GEOFENCE_RADIUS_METERS: "100",
}) as Env

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__))
})

afterEach(async () => {
  for (const sessionId of sessionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run()
  }
  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run()
  }
})

async function createAuthenticatedUser(): Promise<{ cookie: string; userId: string }> {
  const userId = crypto.randomUUID()
  userIds.push(userId)
  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `).bind(userId, `presence-test-${userId}`, "在校判定テストユーザー").run()

  const sessionId = await createSession(env, userId)
  sessionIds.push(sessionId)
  return { cookie: `session_id=${sessionId}`, userId }
}

function request(method: string, cookie: string, body?: unknown): Request {
  return new Request("https://worker.example.com/api/presence", {
    method,
    headers: {
      Cookie: cookie,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

describe("presence API", () => {
  it("stores only the GPS-derived presence state, not raw coordinates", async () => {
    const { cookie, userId } = await createAuthenticatedUser()
    const response = await handlePresence(
      request("POST", cookie, { latitude: 35, longitude: 139 }),
      presenceEnv,
      ["check"],
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: "inside",
      method: "gps",
    })

    const stored = await env.DB.prepare(`
      SELECT status, method, local_date, expires_at
      FROM presence_states
      WHERE user_id = ?
    `).bind(userId).first<{ status: string; method: string; local_date: string; expires_at: string }>()

    expect(stored?.status).toBe("inside")
    expect(stored?.method).toBe("gps")
    expect(stored?.expires_at).toBeTruthy()
  })

  it("lets GPS outside override manual inside and rejects a later manual override", async () => {
    const { cookie } = await createAuthenticatedUser()
    const manual = await handlePresence(request("POST", cookie), presenceEnv, ["manual"])
    expect(manual.status).toBe(200)
    expect(await manual.json()).toMatchObject({ status: "inside", method: "manual" })

    const outside = await handlePresence(
      request("POST", cookie, { latitude: 36, longitude: 140 }),
      presenceEnv,
      ["check"],
    )
    expect(outside.status).toBe(200)
    expect(await outside.json()).toMatchObject({ status: "outside", method: "gps" })

    const rejectedManual = await handlePresence(request("POST", cookie), presenceEnv, ["manual"])
    expect(rejectedManual.status).toBe(409)
  })
})
