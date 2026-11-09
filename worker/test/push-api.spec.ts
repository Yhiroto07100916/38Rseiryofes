declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env } from "cloudflare:test";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createSession } from "../src/lib/session";
import { handlePush } from "../src/routes/push";

const userIds: string[] = [];
const sessionIds: string[] = [];
const endpoints: string[] = [];
const validP256dh = "A".repeat(87);
const validAuth = "A".repeat(22);

const pushEnv = Object.assign(Object.create(env), {
  VAPID_PUBLIC_KEY: "test-vapid-public-key",
  VAPID_PRIVATE_KEY: "test-vapid-private-key",
}) as Env;

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__));
});

afterEach(async () => {
  for (const endpoint of endpoints.splice(0)) {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?")
      .bind(endpoint).run();
  }

  for (const sessionId of sessionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId).run();
  }

  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(userId).run();
  }
});

afterAll(async () => {
  for (const sessionId of sessionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(sessionId).run();
  }

  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(userId).run();
  }
});

async function createAuthenticatedCookie(): Promise<string> {
  const userId = crypto.randomUUID();
  userIds.push(userId);

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `).bind(userId, `push-test-${userId}`, "Push APIテストユーザー").run();

  const sessionId = await createSession(env, userId);
  sessionIds.push(sessionId);

  return `session_id=${sessionId}`;
}

function createEndpoint(): string {
  const endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`;
  endpoints.push(endpoint);
  return endpoint;
}

function createRequest(
  method: string,
  endpoint: string,
  cookie?: string,
  body?: unknown,
): Request {
  return new Request(`https://worker.example.com/api/push/subscriptions${endpoint}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("Push subscription API", () => {
  it("requires authentication to register a subscription", async () => {
    const response = await handlePush(
      createRequest("POST", "", undefined, {
        endpoint: createEndpoint(),
        keys: { p256dh: validP256dh, auth: validAuth },
      }),
      pushEnv,
      ["subscriptions"],
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects an untrusted endpoint", async () => {
    const cookie = await createAuthenticatedCookie();
    const response = await handlePush(
      createRequest("POST", "", cookie, {
        endpoint: "https://example.com/push",
        keys: { p256dh: validP256dh, auth: validAuth },
      }),
      pushEnv,
      ["subscriptions"],
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid push subscription",
    });
  });

  it("rejects push keys with invalid decoded lengths", async () => {
    const cookie = await createAuthenticatedCookie();
    const response = await handlePush(
      createRequest("POST", "", cookie, {
        endpoint: createEndpoint(),
        keys: { p256dh: "short", auth: "short" },
      }),
      pushEnv,
      ["subscriptions"],
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid push subscription",
    });
  });

  it("stores a valid subscription in D1", async () => {
    const cookie = await createAuthenticatedCookie();
    const endpoint = createEndpoint();
    const response = await handlePush(
      createRequest("POST", "", cookie, {
        endpoint,
        keys: { p256dh: validP256dh, auth: validAuth },
      }),
      pushEnv,
      ["subscriptions"],
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ registered: true });

    const stored = await env.DB.prepare(`
      SELECT endpoint, p256dh, auth
      FROM push_subscriptions
      WHERE endpoint = ?
    `).bind(endpoint).first<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>();

    expect(stored).toEqual({
      endpoint,
      p256dh: validP256dh,
      auth: validAuth,
    });
  });

  it("updates the keys when the same endpoint is registered again", async () => {
    const cookie = await createAuthenticatedCookie();
    const endpoint = createEndpoint();

    for (const keys of [
      { p256dh: validP256dh, auth: validAuth },
      { p256dh: validP256dh, auth: validAuth },
    ]) {
      const response = await handlePush(
        createRequest("POST", "", cookie, { endpoint, keys }),
        pushEnv,
        ["subscriptions"],
      );
      expect(response.status).toBe(200);
    }

    const stored = await env.DB.prepare(`
      SELECT p256dh, auth
      FROM push_subscriptions
      WHERE endpoint = ?
    `).bind(endpoint).first<{ p256dh: string; auth: string }>();

    expect(stored).toEqual({
      p256dh: validP256dh,
      auth: validAuth,
    });

    const count = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM push_subscriptions WHERE endpoint = ?",
    ).bind(endpoint).first<{ count: number }>();
    expect(count?.count).toBe(1);
  });

  it("reports whether a valid endpoint is registered", async () => {
    const cookie = await createAuthenticatedCookie();
    const endpoint = createEndpoint();

    await env.DB.prepare(`
      INSERT INTO push_subscriptions (id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), endpoint, "public-key", "auth-key").run();

    const response = await handlePush(
      new Request(
        `https://worker.example.com/api/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`,
        { headers: { Cookie: cookie } },
      ),
      pushEnv,
      ["subscriptions"],
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ registered: true });
  });

  it("removes a registered subscription from D1", async () => {
    const cookie = await createAuthenticatedCookie();
    const endpoint = createEndpoint();

    await env.DB.prepare(`
      INSERT INTO push_subscriptions (id, endpoint, p256dh, auth)
      VALUES (?, ?, ?, ?)
    `).bind(crypto.randomUUID(), endpoint, "public-key", "auth-key").run();

    const response = await handlePush(
      createRequest("DELETE", "", cookie, { endpoint }),
      pushEnv,
      ["subscriptions"],
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ registered: false });

    const stored = await env.DB.prepare(
      "SELECT id FROM push_subscriptions WHERE endpoint = ?",
    ).bind(endpoint).first<{ id: string }>();
    expect(stored).toBeNull();
  });

  it("rejects malformed JSON without writing to D1", async () => {
    const cookie = await createAuthenticatedCookie();
    const response = await handlePush(
      new Request("https://worker.example.com/api/push/subscriptions", {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: "{invalid-json",
      }),
      pushEnv,
      ["subscriptions"],
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body" });
  });
});
