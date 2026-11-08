declare const __D1_MIGRATIONS__: string;

import { applyD1Migrations, env } from "cloudflare:test";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  enqueueNewsPushDeliveries,
  processDuePushDeliveries,
} from "../src/routes/push";

const userIds: string[] = [];
const newsIds: string[] = [];
const subscriptionIds: string[] = [];

let pushEnv: Env;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function createPushEnvironment(): Promise<Env> {
  // VAPID署名用のP-256鍵。テストごとに実際の秘密鍵を用意する。
  const vapidKeys = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const vapidPrivateKey = await crypto.subtle.exportKey(
    "jwk",
    vapidKeys.privateKey,
  );
  const vapidPublicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", vapidKeys.publicKey),
  );

  return Object.assign(Object.create(env), {
    VAPID_PUBLIC_KEY: toBase64Url(vapidPublicKey),
    VAPID_PRIVATE_KEY: JSON.stringify(vapidPrivateKey),
  }) as Env;
}

async function createSubscription(): Promise<string> {
  // Pushサービスに渡す購読者側のECDH公開鍵と認証用秘密情報。
  const keys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", keys.publicKey),
  );
  const authKey = crypto.getRandomValues(new Uint8Array(16));
  const id = crypto.randomUUID();
  const endpoint = `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`;

  await env.DB.prepare(`
    INSERT INTO push_subscriptions (id, endpoint, p256dh, auth)
    VALUES (?, ?, ?, ?)
  `).bind(
    id,
    endpoint,
    toBase64Url(publicKey),
    toBase64Url(authKey),
  ).run();

  subscriptionIds.push(id);
  return id;
}

async function createNews(): Promise<string> {
  const userId = crypto.randomUUID();
  const newsId = crypto.randomUUID();
  userIds.push(userId);
  newsIds.push(newsId);

  await env.DB.prepare(`
    INSERT INTO users (id, student_number, name, nickname)
    VALUES (?, ?, ?, NULL)
  `).bind(userId, `push-delivery-${userId}`, "Push配信テストユーザー").run();

  await env.DB.prepare(`
    INSERT INTO news (id, title, detail, author, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    newsId,
    "配信テストのお知らせ",
    "Push通知の配信処理を確認するためのお知らせです。",
    "テスト担当",
    userId,
  ).run();

  return newsId;
}

async function getDelivery(newsId: string) {
  return env.DB.prepare(`
    SELECT id, status, attempt_count, next_attempt_at, last_error
    FROM push_notification_deliveries
    WHERE news_id = ?
  `).bind(newsId).first<{
    id: string;
    status: string;
    attempt_count: number;
    next_attempt_at: string;
    last_error: string | null;
  }>();
}

async function makeDeliveryDue(newsId: string): Promise<void> {
  await env.DB.prepare(`
    UPDATE push_notification_deliveries
    SET next_attempt_at = datetime('now', '-1 minute')
    WHERE news_id = ?
  `).bind(newsId).run();
}

beforeAll(async () => {
  await applyD1Migrations(env.DB, JSON.parse(__D1_MIGRATIONS__));
  pushEnv = await createPushEnvironment();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();

  for (const newsId of newsIds.splice(0)) {
    await env.DB.prepare("DELETE FROM news WHERE id = ?").bind(newsId).run();
  }

  for (const subscriptionId of subscriptionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?")
      .bind(subscriptionId).run();
  }

  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  }
});

afterAll(async () => {
  for (const newsId of newsIds.splice(0)) {
    await env.DB.prepare("DELETE FROM news WHERE id = ?").bind(newsId).run();
  }
  for (const subscriptionId of subscriptionIds.splice(0)) {
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?")
      .bind(subscriptionId).run();
  }
  for (const userId of userIds.splice(0)) {
    await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
  }
});

describe("Web Push delivery queue", () => {
  it("creates one delivery per registered subscription and marks successful sends as sent", async () => {
    await createSubscription();
    await createSubscription();
    const newsId = await createNews();

    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await enqueueNewsPushDeliveries(pushEnv, { id: newsId });

    const deliveries = await env.DB.prepare(`
      SELECT status, attempt_count
      FROM push_notification_deliveries
      WHERE news_id = ?
      ORDER BY subscription_id
    `).bind(newsId).all<{ status: string; attempt_count: number }>();

    expect(deliveries.results).toHaveLength(2);
    expect(deliveries.results.every((row) => row.status === "sent")).toBe(true);
    expect(deliveries.results.every((row) => row.attempt_count === 1)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries temporary failures after the configured delays and fails after four attempts", async () => {
    await createSubscription();
    const newsId = await createNews();

    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    // enqueueNewsPushDeliveries はキュー登録後、初回送信も実行する。
    await enqueueNewsPushDeliveries(pushEnv, { id: newsId });

    let delivery = await getDelivery(newsId);
    expect(delivery?.status).toBe("pending");
    expect(delivery?.attempt_count).toBe(1);
    expect(delivery?.last_error).toBe("Push service returned 503");
    expect(delivery?.next_attempt_at).toBeTruthy();

    for (const expectedAttempt of [2, 3]) {
      await makeDeliveryDue(newsId);
      await processDuePushDeliveries(pushEnv);

      delivery = await getDelivery(newsId);
      expect(delivery?.status).toBe("pending");
      expect(delivery?.attempt_count).toBe(expectedAttempt);
    }

    await makeDeliveryDue(newsId);
    await processDuePushDeliveries(pushEnv);

    delivery = await getDelivery(newsId);
    expect(delivery?.status).toBe("failed");
    expect(delivery?.attempt_count).toBe(4);
    expect(delivery?.last_error).toBe("Push service returned 503");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each([404, 410])(
    "removes a subscription when the push service returns %i",
    async (status) => {
      const subscriptionId = await createSubscription();
      const newsId = await createNews();

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status })),
      );

      await enqueueNewsPushDeliveries(pushEnv, { id: newsId });

      const subscription = await env.DB.prepare(
        "SELECT id FROM push_subscriptions WHERE id = ?",
      ).bind(subscriptionId).first<{ id: string }>();
      const delivery = await getDelivery(newsId);

      expect(subscription).toBeNull();
      // push_subscriptions の削除により外部キーの ON DELETE CASCADE が働く。
      expect(delivery).toBeNull();
    },
  );
});
