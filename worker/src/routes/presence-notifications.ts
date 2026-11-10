import { buildPushHTTPRequest } from "@pushforge/builder";
import { requireAuth } from "../lib/authz";

type PresenceStatus = "inside" | "outside" | "unknown";
type PresenceMethod = "gps" | "manual";

function jstParts(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
    hour: jst.getUTCHours(),
    minute: jst.getUTCMinutes(),
    second: jst.getUTCSeconds(),
    date: `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`,
  };
}

export function jstExpiry(status: PresenceStatus, now = new Date()): string | null {
  if (status === "unknown") return null;
  const p = jstParts(now);
  const endHour = status === "inside" && (p.hour < 18) ? 18 : 24;
  return new Date(Date.UTC(p.year, p.month - 1, p.day, endHour - 9, 0, 0)).toISOString();
}

function isValidInside(row: { status: string; local_date: string; expires_at: string | null }, now = new Date()) {
  return row.status === "inside" &&
    row.local_date === jstParts(now).date &&
    Boolean(row.expires_at) &&
    new Date(row.expires_at as string).getTime() > now.getTime();
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function savePresence(
  env: Env,
  userId: string,
  status: PresenceStatus,
  method: PresenceMethod,
  gpsStatus: "inside" | "outside" | null,
) {
  const now = new Date();
  const checkedAt = now.toISOString();
  const localDate = jstParts(now).date;
  const expiresAt = jstExpiry(status, now);
  await env.DB.prepare(`
    INSERT INTO presence_states (
      user_id, status, method, checked_at, expires_at, local_date,
      last_gps_status, last_gps_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      status = excluded.status,
      method = excluded.method,
      checked_at = excluded.checked_at,
      expires_at = excluded.expires_at,
      local_date = excluded.local_date,
      last_gps_status = CASE WHEN excluded.last_gps_status IS NULL
        THEN presence_states.last_gps_status ELSE excluded.last_gps_status END,
      last_gps_at = CASE WHEN excluded.last_gps_status IS NULL
        THEN presence_states.last_gps_at ELSE excluded.last_gps_at END,
      updated_at = CURRENT_TIMESTAMP
  `).bind(userId, status, method, checkedAt, expiresAt, localDate, gpsStatus, gpsStatus ? checkedAt : null).run();
  return { status, method, checked_at: checkedAt, expires_at: expiresAt, local_date: localDate };
}

async function currentPresence(env: Env, userId: string) {
  const row = await env.DB.prepare(`
    SELECT status, method, checked_at, expires_at, local_date
    FROM presence_states WHERE user_id = ?
  `).bind(userId).first<{
    status: PresenceStatus; method: PresenceMethod; checked_at: string;
    expires_at: string | null; local_date: string;
  }>();
  if (!row) return { status: "unknown" as PresenceStatus, method: null, checked_at: null, expires_at: null };
  if (!isValidInside(row) && row.status !== "outside") {
    await env.DB.prepare(`
      UPDATE presence_states SET status = 'unknown', expires_at = NULL, local_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(jstParts().date, userId).run();
    return { ...row, status: "unknown" as PresenceStatus, expires_at: null };
  }
  if (row.local_date !== jstParts().date) {
    await env.DB.prepare(`
      UPDATE presence_states SET status = 'unknown', expires_at = NULL, local_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).bind(jstParts().date, userId).run();
    return { ...row, status: "unknown" as PresenceStatus, expires_at: null };
  }
  if (row.status === "outside" && row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare("UPDATE presence_states SET status = 'unknown', expires_at = NULL WHERE user_id = ?").bind(userId).run();
    return { ...row, status: "unknown" as PresenceStatus, expires_at: null };
  }
  return row;
}

export async function handlePresence(request: Request, env: Env, pathParts: string[]) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  const route = pathParts.join("/");

  if (request.method === "GET" && route === "me") {
    return Response.json(await currentPresence(env, auth.user.id));
  }

  if (request.method === "POST" && route === "check") {
    if (env.SCHOOL_LATITUDE === undefined || env.SCHOOL_LONGITUDE === undefined || env.SCHOOL_GEOFENCE_RADIUS_METERS === undefined) {
      return jsonError("学校の位置情報設定が未完了です", 503);
    }
    let body: { latitude?: unknown; longitude?: unknown };
    try { body = await request.json(); } catch { return jsonError("Invalid JSON body", 400); }
    const lat = Number(body.latitude);
    const lon = Number(body.longitude);
    const schoolLat = Number(env.SCHOOL_LATITUDE);
    const schoolLon = Number(env.SCHOOL_LONGITUDE);
    const radius = Number(env.SCHOOL_GEOFENCE_RADIUS_METERS);
    if (![lat, lon, schoolLat, schoolLon, radius].every(Number.isFinite) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180 ||
      schoolLat < -90 || schoolLat > 90 || schoolLon < -180 || schoolLon > 180 ||
      radius < 30 || radius > 2000) return jsonError("位置情報の値が不正です", 400);
    const inside = distanceMeters(lat, lon, schoolLat, schoolLon) <= radius;
    return Response.json(await savePresence(env, auth.user.id, inside ? "inside" : "outside", "gps", inside ? "inside" : "outside"));
  }

  if (request.method === "POST" && route === "manual") {
    const previous = await env.DB.prepare(`
      SELECT last_gps_status, local_date FROM presence_states WHERE user_id = ?
    `).bind(auth.user.id).first<{ last_gps_status: string | null; local_date: string }>();
    if (previous?.local_date === jstParts().date && previous.last_gps_status === "outside") {
      return jsonError("GPSで校外と判定されているため、手動で在校登録できません", 409);
    }
    return Response.json(await savePresence(env, auth.user.id, "inside", "manual", null));
  }

  if (request.method === "DELETE" && route === "me") {
    await env.DB.prepare("DELETE FROM presence_states WHERE user_id = ?").bind(auth.user.id).run();
    return Response.json({ success: true, status: "unknown" });
  }
  return jsonError("Not Found", 404);
}

export interface NotificationInput {
  eventKey: string;
  eventType: string;
  title: string;
  body: string;
  targetUrl: string;
  userIds: string[];
  insideOnly?: boolean;
}

export async function notifyUsers(env: Env, input: NotificationInput): Promise<number> {
  await env.DB.prepare(`
    INSERT OR IGNORE INTO notification_events (id, event_key, event_type, title, body, target_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), input.eventKey, input.eventType, input.title.slice(0, 100), input.body.slice(0, 500), input.targetUrl).run();
  const event = await env.DB.prepare("SELECT id FROM notification_events WHERE event_key = ?")
    .bind(input.eventKey).first<{ id: string }>();
  if (!event) return 0;

  let userIds = [...new Set(input.userIds.filter(Boolean))];
  if (input.insideOnly) {
    const inside = userIds.length
      ? await env.DB.prepare(`
          SELECT user_id FROM presence_states
          WHERE user_id IN (${userIds.map(() => "?").join(",")}) AND status = 'inside'
            AND local_date = ? AND expires_at > ?
        `).bind(...userIds, jstParts().date, new Date().toISOString()).all<{ user_id: string }>()
      : await env.DB.prepare(`
          SELECT user_id FROM presence_states
          WHERE status = 'inside' AND local_date = ? AND expires_at > ?
        `).bind(jstParts().date, new Date().toISOString()).all<{ user_id: string }>();
    userIds = inside.results.map(row => row.user_id);
  }
  for (const userId of userIds) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_notifications (id, notification_id, user_id)
      VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), event.id, userId).run();
    const userNotification = await env.DB.prepare(`
      SELECT id FROM user_notifications WHERE notification_id = ? AND user_id = ?
    `).bind(event.id, userId).first<{ id: string }>();
    if (!userNotification) continue;
    await env.DB.prepare(`
      INSERT OR IGNORE INTO notification_push_deliveries
        (id, user_notification_id, subscription_id)
      SELECT ?, ?, id FROM push_subscriptions WHERE user_id = ?
    `).bind(crypto.randomUUID(), userNotification.id, userId).run();
  }
  return userIds.length;
}

export async function handleNotifications(request: Request, env: Env, pathParts: string[]) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;
  if (request.method === "GET" && pathParts.length === 0) {
    const result = await env.DB.prepare(`
      SELECT un.id, ne.event_type, ne.title, ne.body, ne.target_url,
        un.read_at, un.created_at
      FROM user_notifications un
      INNER JOIN notification_events ne ON ne.id = un.notification_id
      WHERE un.user_id = ?
      ORDER BY un.created_at DESC LIMIT 100
    `).bind(auth.user.id).all();
    return Response.json({ notifications: result.results });
  }
  if (request.method === "PATCH" && pathParts.length === 2 && pathParts[1] === "read") {
    const result = await env.DB.prepare(`
      UPDATE user_notifications SET read_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ? AND read_at IS NULL
    `).bind(pathParts[0], auth.user.id).run();
    if (!(result.meta?.changes ?? 0)) {
      const exists = await env.DB.prepare("SELECT id FROM user_notifications WHERE id = ? AND user_id = ?")
        .bind(pathParts[0], auth.user.id).first();
      if (!exists) return jsonError("Not Found", 404);
    }
    return Response.json({ success: true });
  }
  return jsonError("Not Found", 404);
}

async function sendNotificationPush(env: Env, row: {
  id: string; endpoint: string; p256dh: string; auth: string;
  title: string; body: string; target_url: string; attempt_count: number;
}) {
  if (!env.VAPID_PRIVATE_KEY) throw new Error("VAPID_PRIVATE_KEY is not configured");
  const request = await buildPushHTTPRequest({
    privateJWK: JSON.parse(env.VAPID_PRIVATE_KEY),
    subscription: { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
    message: {
      payload: {
        title: row.title, body: row.body.slice(0, 50), icon: "/pwa-192x192.png",
        badge: "/pwa-64x64.png", tag: row.id, url: row.target_url,
      },
      adminContact: env.VAPID_SUBJECT || "https://38r-seiryofes.com",
      options: { ttl: 86400, urgency: "normal", topic: row.id.replace(/-/g, "").slice(0, 32) },
    },
  });
  return fetch(request.endpoint, { method: "POST", headers: request.headers, body: request.body });
}

export async function processNotificationPushDeliveries(env: Env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
  const result = await env.DB.prepare(`
    SELECT d.id, d.attempt_count, s.endpoint, s.p256dh, s.auth,
      n.title, n.body, n.target_url
    FROM notification_push_deliveries d
    INNER JOIN user_notifications un ON un.id = d.user_notification_id
    INNER JOIN notification_events n ON n.id = un.notification_id
    INNER JOIN push_subscriptions s ON s.id = d.subscription_id
    WHERE (d.status = 'pending' AND d.next_attempt_at <= CURRENT_TIMESTAMP)
      OR (d.status = 'sending' AND d.lease_until <= CURRENT_TIMESTAMP)
    ORDER BY d.created_at LIMIT 50
  `).all<any>();
  for (const row of result.results) {
    const claimed = await env.DB.prepare(`
      UPDATE notification_push_deliveries SET status = 'sending',
        attempt_count = attempt_count + 1, lease_until = datetime('now', '+2 minutes')
      WHERE id = ? AND ((status = 'pending' AND next_attempt_at <= CURRENT_TIMESTAMP)
        OR (status = 'sending' AND lease_until <= CURRENT_TIMESTAMP))
    `).bind(row.id).run();
    if ((claimed.meta?.changes ?? 0) !== 1) continue;
    try {
      const response = await sendNotificationPush(env, row);
      if (response.ok) {
        await env.DB.prepare("UPDATE notification_push_deliveries SET status = 'sent', lease_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id).run();
      } else if (response.status === 404 || response.status === 410) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(row.endpoint).run();
      } else if (response.status === 429 || response.status >= 500) {
        const attempts = row.attempt_count + 1;
        await env.DB.prepare(`
          UPDATE notification_push_deliveries SET status = ?, next_attempt_at = datetime('now', ?),
            lease_until = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(attempts >= 4 ? "failed" : "pending", attempts >= 4 ? "+0 minutes" : `+${[1,5,15][attempts - 1]} minutes`, `Push service returned ${response.status}`, row.id).run();
      } else {
        await env.DB.prepare("UPDATE notification_push_deliveries SET status = 'failed', lease_until = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(`Push service returned ${response.status}`, row.id).run();
      }
    } catch (error) {
      const attempts = row.attempt_count + 1;
      await env.DB.prepare(`
        UPDATE notification_push_deliveries SET status = ?, next_attempt_at = datetime('now', ?),
          lease_until = NULL, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(attempts >= 4 ? "failed" : "pending", attempts >= 4 ? "+0 minutes" : `+${[1,5,15][attempts - 1]} minutes`, error instanceof Error ? error.message.slice(0, 300) : "Unknown error", row.id).run();
    }
  }
}

export async function processScheduledToolRentalNotifications(env: Env) {
  const now = new Date();
  const nowIso = now.toISOString();
  const dueSoonMinutes = Math.min(1440, Math.max(5, Number(env.TOOL_LOAN_DUE_SOON_MINUTES) || 10));
  const dueSoon = await env.DB.prepare(`
    SELECT id, tool_name_snapshot, due_at FROM loans
    WHERE status = 'borrowed' AND due_at IS NOT NULL
      AND due_at > datetime('now', '+9 hours')
      AND due_at <= datetime('now', '+9 hours', '+' || ? || ' minutes')
      AND presence_due_soon_notified_at IS NULL
  `).bind(dueSoonMinutes).all<{ id: number; tool_name_snapshot: string | null; due_at: string }>();
  for (const loan of dueSoon.results) {
    await notifyUsers(env, {
      eventKey: `tool-loan:${loan.id}:due-soon`, eventType: "tool_loan_due_soon",
      title: "工具の返却期限が近づいています",
      body: `${loan.tool_name_snapshot || "工具"}の返却期限が近づいています。`,
      targetUrl: "/tool-rental/loans/current", userIds: [], insideOnly: true,
    });
    await env.DB.prepare("UPDATE loans SET presence_due_soon_notified_at = ? WHERE id = ? AND presence_due_soon_notified_at IS NULL").bind(nowIso, loan.id).run();
  }

  const overdue = await env.DB.prepare(`
    SELECT id, tool_name_snapshot FROM loans
    WHERE status = 'borrowed' AND due_at IS NOT NULL
      AND due_at <= datetime('now', '+9 hours')
      AND presence_overdue_notified_at IS NULL
  `).all<{ id: number; tool_name_snapshot: string | null }>();
  for (const loan of overdue.results) {
    const inside = await env.DB.prepare(`
      SELECT user_id FROM presence_states
      WHERE status = 'inside' AND local_date = ? AND expires_at > ?
    `).bind(jstParts().date, nowIso).all<{ user_id: string }>();
    await notifyUsers(env, {
      eventKey: `tool-loan:${loan.id}:overdue`, eventType: "tool_loan_overdue",
      title: "工具の返却期限を過ぎています",
      body: `${loan.tool_name_snapshot || "工具"}の返却期限を過ぎています。`,
      targetUrl: "/tool-rental/loans/current", userIds: inside.results.map(row => row.user_id),
    });
    await env.DB.prepare("UPDATE loans SET presence_overdue_notified_at = ? WHERE id = ? AND presence_overdue_notified_at IS NULL").bind(nowIso, loan.id).run();
  }

  const alarms = await env.DB.prepare(`
    SELECT li.id AS loan_item_id, l.id AS loan_id, l.tool_name_snapshot
    FROM loan_items li INNER JOIN loans l ON l.id = li.loan_id
    WHERE li.returned_at IS NULL AND l.status = 'borrowed' AND l.due_at IS NOT NULL
      AND l.due_at <= datetime('now', '+9 hours')
      AND li.timer_alarm_notified_at IS NULL
  `).all<{ loan_item_id: number; loan_id: number; tool_name_snapshot: string | null }>();
  for (const alarm of alarms.results) {
    const inside = await env.DB.prepare(`
      SELECT user_id FROM presence_states
      WHERE status = 'inside' AND local_date = ? AND expires_at > ?
    `).bind(jstParts().date, nowIso).all<{ user_id: string }>();
    await notifyUsers(env, {
      eventKey: `tool-timer:${alarm.loan_item_id}:alarm`, eventType: "tool_timer_alarm",
      title: "工具貸し出しタイマーのアラーム",
      body: `${alarm.tool_name_snapshot || "工具"}の貸出タイマーが終了しました。`,
      targetUrl: "/tool-rental/loans/current", userIds: inside.results.map(row => row.user_id),
    });
    await env.DB.prepare("UPDATE loan_items SET timer_alarm_notified_at = ? WHERE id = ? AND timer_alarm_notified_at IS NULL").bind(nowIso, alarm.loan_item_id).run();
  }
}
