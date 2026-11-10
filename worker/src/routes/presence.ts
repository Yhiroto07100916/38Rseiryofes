import { requireAuth } from "../lib/authz"

type PresenceStatus = "inside" | "outside" | "unknown"
type PresenceMethod = "gps" | "manual"

function jstParts(date = new Date()) {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const year = jst.getUTCFullYear()
  const month = jst.getUTCMonth() + 1
  const day = jst.getUTCDate()
  return {
    year,
    month,
    day,
    hour: jst.getUTCHours(),
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  }
}

export function jstPresenceExpiry(status: PresenceStatus, now = new Date()): string | null {
  if (status === "unknown") return null
  const parts = jstParts(now)
  const endHour = status === "inside" && parts.hour < 18 ? 18 : 24
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, endHour - 9)).toISOString()
}

function isValidPresence(row: { status: string; local_date: string; expires_at: string | null }, now = new Date()) {
  return row.local_date === jstParts(now).date &&
    Boolean(row.expires_at) &&
    new Date(row.expires_at as string).getTime() > now.getTime()
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (value: number) => value * Math.PI / 180
  const dLat = radians(lat2 - lat1)
  const dLon = radians(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function savePresence(
  env: Env,
  userId: string,
  status: PresenceStatus,
  method: PresenceMethod,
  gpsStatus: "inside" | "outside" | null,
) {
  const now = new Date()
  const checkedAt = now.toISOString()
  const localDate = jstParts(now).date
  const expiresAt = jstPresenceExpiry(status, now)
  await env.DB.prepare(
    "INSERT INTO presence_states (user_id, status, method, checked_at, expires_at, local_date, last_gps_status, last_gps_at, updated_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) " +
    "ON CONFLICT(user_id) DO UPDATE SET status = excluded.status, method = excluded.method, " +
    "checked_at = excluded.checked_at, expires_at = excluded.expires_at, local_date = excluded.local_date, " +
    "last_gps_status = CASE WHEN excluded.last_gps_status IS NULL THEN presence_states.last_gps_status ELSE excluded.last_gps_status END, " +
    "last_gps_at = CASE WHEN excluded.last_gps_status IS NULL THEN presence_states.last_gps_at ELSE excluded.last_gps_at END, " +
    "updated_at = CURRENT_TIMESTAMP"
  ).bind(userId, status, method, checkedAt, expiresAt, localDate, gpsStatus, gpsStatus ? checkedAt : null).run()
  return { status, method, checked_at: checkedAt, expires_at: expiresAt, local_date: localDate }
}

async function currentPresence(env: Env, userId: string) {
  const row = await env.DB.prepare(
    "SELECT status, method, checked_at, expires_at, local_date FROM presence_states WHERE user_id = ?",
  ).bind(userId).first<{
    status: PresenceStatus
    method: PresenceMethod
    checked_at: string
    expires_at: string | null
    local_date: string
  }>()
  if (!row) return { status: "unknown" as PresenceStatus, method: null, checked_at: null, expires_at: null }
  if (!isValidPresence(row)) {
    await env.DB.prepare(
      "UPDATE presence_states SET status = 'unknown', expires_at = NULL, local_date = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
    ).bind(jstParts().date, userId).run()
    return { ...row, status: "unknown" as PresenceStatus, expires_at: null }
  }
  return row
}

export async function handlePresence(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  const auth = await requireAuth(request, env)
  if (auth instanceof Response) return auth
  const route = pathParts.join("/")

  if (request.method === "GET" && route === "me") {
    return Response.json(await currentPresence(env, auth.user.id))
  }

  if (request.method === "POST" && route === "check") {
    if (env.SCHOOL_LATITUDE === undefined || env.SCHOOL_LONGITUDE === undefined || env.SCHOOL_GEOFENCE_RADIUS_METERS === undefined) {
      return jsonError("学校の位置情報設定が未完了です", 503)
    }
    let body: { latitude?: unknown; longitude?: unknown }
    try { body = await request.json() } catch { return jsonError("Invalid JSON body", 400) }
    const latitude = Number(body.latitude)
    const longitude = Number(body.longitude)
    const schoolLatitude = Number(env.SCHOOL_LATITUDE)
    const schoolLongitude = Number(env.SCHOOL_LONGITUDE)
    const radius = Number(env.SCHOOL_GEOFENCE_RADIUS_METERS)
    if (![latitude, longitude, schoolLatitude, schoolLongitude, radius].every(Number.isFinite) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 ||
      schoolLatitude < -90 || schoolLatitude > 90 || schoolLongitude < -180 || schoolLongitude > 180 ||
      radius < 30 || radius > 2000) {
      return jsonError("位置情報の値が不正です", 400)
    }
    const inside = distanceMeters(latitude, longitude, schoolLatitude, schoolLongitude) <= radius
    return Response.json(await savePresence(env, auth.user.id, inside ? "inside" : "outside", "gps", inside ? "inside" : "outside"))
  }

  if (request.method === "POST" && route === "manual") {
    const previous = await env.DB.prepare(
      "SELECT last_gps_status, local_date FROM presence_states WHERE user_id = ?",
    ).bind(auth.user.id).first<{ last_gps_status: string | null; local_date: string }>()
    if (previous?.local_date === jstParts().date && previous.last_gps_status === "outside") {
      return jsonError("GPSで校外と判定されているため、手動で在校登録できません", 409)
    }
    return Response.json(await savePresence(env, auth.user.id, "inside", "manual", null))
  }

  if (request.method === "DELETE" && route === "me") {
    await env.DB.prepare("DELETE FROM presence_states WHERE user_id = ?").bind(auth.user.id).run()
    return Response.json({ success: true, status: "unknown" })
  }

  return jsonError("Not Found", 404)
}
