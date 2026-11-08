type NotificationChannel = "none" | "discord" | "line"
type LineDestinationType = "user" | "group" | "room"

interface NotificationEnv {
  DB: D1Database
  TOOL_RENTAL_ENCRYPTION_KEY?: string
}

interface NotificationSettings {
  channel: NotificationChannel
  discordWebhookUrl: string | null
  lineChannelAccessToken: string | null
  lineChannelSecret: string | null
  lineDestinationType: LineDestinationType | null
  lineDestinationId: string | null
}

interface LineDestination {
  destination_type: LineDestinationType
  destination_id: string
  display_name: string | null
  last_seen_at: string
}

const notificationJson = (data: unknown, status = 200) =>
  Response.json(data, { status })

const notificationNow = () => new Date().toISOString().replace("T", " ").slice(0, 19)
const notificationJst = (date = new Date()) =>
  new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 19).replace("T", " ")
const notificationJstParts = (date = new Date()) => {
  const value = new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString()
  return { date: value.slice(0, 10), time: value.slice(11, 16) }
}
const parseNotificationDate = (value: string) =>
  new Date(`${value.replace(" ", "T")}+09:00`).getTime()

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(value => value.toString(16).padStart(2, "0")).join("")
}

function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}

async function notificationCryptoKey(env: NotificationEnv): Promise<CryptoKey> {
  const secret = env.TOOL_RENTAL_ENCRYPTION_KEY
  if (!secret || secret.length < 32) {
    throw new Error("TOOL_RENTAL_ENCRYPTION_KEY must be configured with at least 32 characters")
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret))
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
}

async function encryptSecret(env: NotificationEnv, value: string): Promise<string> {
  const key = await notificationCryptoKey(env)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value))
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(encrypted))}`
}

async function decryptSecret(env: NotificationEnv, value: string | null): Promise<string | null> {
  if (!value) return null
  const separator = value.indexOf(":")
  if (separator <= 0) return null
  try {
    const key = await notificationCryptoKey(env)
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: hexToBytes(value.slice(0, separator)) },
      key,
      hexToBytes(value.slice(separator + 1)),
    )
    return new TextDecoder().decode(decrypted)
  } catch (error) {
    console.error("[ToolRentalNotifications] secret decryption failed", error)
    return null
  }
}

async function getNotificationSettings(env: NotificationEnv): Promise<NotificationSettings> {
  const row = await env.DB.prepare(`
    SELECT channel, discord_webhook_encrypted,
      line_channel_access_token_encrypted, line_channel_secret_encrypted,
      line_destination_type, line_destination_id
    FROM notification_settings WHERE id = 1 LIMIT 1
  `).first<{
    channel: NotificationChannel
    discord_webhook_encrypted: string | null
    line_channel_access_token_encrypted: string | null
    line_channel_secret_encrypted: string | null
    line_destination_type: LineDestinationType | null
    line_destination_id: string | null
  }>()
  if (!row) {
    return { channel: "none", discordWebhookUrl: null, lineChannelAccessToken: null, lineChannelSecret: null, lineDestinationType: null, lineDestinationId: null }
  }
  const [discordWebhookUrl, lineChannelAccessToken, lineChannelSecret] = await Promise.all([
    decryptSecret(env, row.discord_webhook_encrypted),
    decryptSecret(env, row.line_channel_access_token_encrypted),
    decryptSecret(env, row.line_channel_secret_encrypted),
  ])
  return {
    channel: row.channel,
    discordWebhookUrl,
    lineChannelAccessToken,
    lineChannelSecret,
    lineDestinationType: row.line_destination_type,
    lineDestinationId: row.line_destination_id,
  }
}

async function sendConfiguredNotification(env: NotificationEnv, message: string) {
  const settings = await getNotificationSettings(env)
  if (settings.channel === "none") return { ok: true, skipped: true, status: 204 }
  if (settings.channel === "discord") {
    if (!settings.discordWebhookUrl) return { ok: false, status: 400, error: "Discord Webhook URLが未設定です" }
    const response = await fetch(settings.discordWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    })
    return { ok: response.ok, status: response.status, error: response.ok ? undefined : await response.text() }
  }
  if (!settings.lineChannelAccessToken || !settings.lineDestinationId) {
    return { ok: false, status: 400, error: "LINEの送信先または認証情報が未設定です" }
  }
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.lineChannelAccessToken}`,
    },
    body: JSON.stringify({
      to: settings.lineDestinationId,
      messages: [{ type: "text", text: message.slice(0, 5000) }],
    }),
  })
  return { ok: response.ok, status: response.status, error: response.ok ? undefined : await response.text() }
}

async function verifyLineSignature(body: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)))
    return constantTimeEqual(base64ToBytes(signature), expected)
  } catch {
    return false
  }
}

async function getLineDisplayName(
  token: string,
  type: LineDestinationType,
  id: string,
  sourceUserId: string | null,
): Promise<string | null> {
  const headers = { Authorization: `Bearer ${token}` }
  try {
    if (type === "group") {
      const response = await fetch(`https://api.line.me/v2/bot/group/${encodeURIComponent(id)}/summary`, { headers })
      if (response.ok) return (await response.json<{ groupName?: string }>()).groupName ?? null
    } else if (type === "user") {
      const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(id)}`, { headers })
      if (response.ok) return (await response.json<{ displayName?: string }>()).displayName ?? null
    } else if (sourceUserId) {
      const response = await fetch(`https://api.line.me/v2/bot/room/${encodeURIComponent(id)}/member/${encodeURIComponent(sourceUserId)}`, { headers })
      if (response.ok) return (await response.json<{ displayName?: string }>()).displayName ?? null
    }
  } catch (error) {
    console.warn("[ToolRentalNotifications] LINE profile lookup failed", error)
  }
  return null
}

async function saveLineDestination(
  env: NotificationEnv,
  type: LineDestinationType,
  id: string,
  displayName: string | null,
) {
  const now = notificationJst()
  await env.DB.prepare(`
    INSERT INTO line_notification_destinations (
      destination_type, destination_id, display_name, last_seen_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(destination_id) DO UPDATE SET
      destination_type = excluded.destination_type,
      display_name = COALESCE(excluded.display_name, line_notification_destinations.display_name),
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
  `).bind(type, id, displayName, now, now, now).run()
}

export async function handleToolRentalLineWebhook(request: Request, env: NotificationEnv): Promise<Response> {
  const body = await request.text()
  const signature = request.headers.get("x-line-signature")
  if (!signature) return notificationJson({ detail: "LINE署名がありません" }, 401)

  const settings = await getNotificationSettings(env)
  if (!settings.lineChannelSecret || !settings.lineChannelAccessToken) {
    return notificationJson({ detail: "LINE認証情報が設定されていません" }, 503)
  }
  if (!(await verifyLineSignature(body, signature, settings.lineChannelSecret))) {
    return notificationJson({ detail: "LINE webhookの署名が正しくありません" }, 401)
  }

  let payload: { events?: Array<{ source?: { type?: string; userId?: string; groupId?: string; roomId?: string } }> }
  try {
    payload = JSON.parse(body)
  } catch {
    return notificationJson({ detail: "LINE webhookのJSONが正しくありません" }, 400)
  }

  for (const event of payload.events ?? []) {
    const source = event.source
    if (!source) continue
    const type = source.type === "user" ? "user" : source.type === "group" ? "group" : source.type === "room" ? "room" : null
    const id = type === "user" ? source.userId : type === "group" ? source.groupId : type === "room" ? source.roomId : null
    if (!type || !id) continue
    const displayName = await getLineDisplayName(settings.lineChannelAccessToken, type, id, source.userId ?? null)
    await saveLineDestination(env, type, id, displayName)
  }
  return notificationJson({ ok: true })
}

export async function handleToolRentalNotificationRoutes(
  request: Request,
  env: NotificationEnv,
  url: URL,
): Promise<Response> {
  if (url.pathname === "/settings/notifications" && request.method === "GET") {
    const settings = await getNotificationSettings(env)
    return notificationJson({
      channel: settings.channel,
      discord_configured: Boolean(settings.discordWebhookUrl),
      line_configured: Boolean(settings.lineChannelAccessToken && settings.lineChannelSecret && settings.lineDestinationType && settings.lineDestinationId),
      line_destination_type: settings.lineDestinationType,
      line_destination_id: settings.lineDestinationId,
    })
  }

  if (url.pathname === "/settings/notifications/line-destinations" && request.method === "GET") {
    const result = await env.DB.prepare(`
      SELECT destination_type, destination_id, display_name, last_seen_at
      FROM line_notification_destinations
      ORDER BY last_seen_at DESC, id DESC
    `).all<LineDestination>()
    return notificationJson({ destinations: result.results })
  }

  if (url.pathname === "/settings/notifications" && request.method === "PATCH") {
    let body: any
    try {
      body = await request.json()
    } catch {
      return notificationJson({ detail: "リクエストが正しくありません" }, 400)
    }
    const channel = body?.channel as NotificationChannel
    if (!["none", "discord", "line"].includes(channel)) {
      return notificationJson({ detail: "通知先が正しくありません" }, 400)
    }

    const current = await getNotificationSettings(env)
    const discordUrl = typeof body.discord_webhook_url === "string" && body.discord_webhook_url.trim()
      ? body.discord_webhook_url.trim()
      : current.discordWebhookUrl
    if (discordUrl) {
      try {
        const parsed = new URL(discordUrl)
        if (parsed.protocol !== "https:" || !["discord.com", "discordapp.com"].includes(parsed.hostname)) {
          return notificationJson({ detail: "Discord Webhook URLが正しくありません" }, 400)
        }
      } catch {
        return notificationJson({ detail: "Discord Webhook URLが正しくありません" }, 400)
      }
    }

    const lineToken = typeof body.line_channel_access_token === "string" && body.line_channel_access_token.trim()
      ? body.line_channel_access_token.trim()
      : current.lineChannelAccessToken
    const lineSecret = typeof body.line_channel_secret === "string" && body.line_channel_secret.trim()
      ? body.line_channel_secret.trim()
      : current.lineChannelSecret
    const destinationId = typeof body.line_destination_id === "string" && body.line_destination_id.trim()
      ? body.line_destination_id.trim()
      : current.lineDestinationId
    const destinationType = ["user", "group", "room"].includes(body.line_destination_type)
      ? body.line_destination_type as LineDestinationType
      : current.lineDestinationType

    if (channel === "discord" && !discordUrl) {
      return notificationJson({ detail: "Discord Webhook URLを設定してください" }, 400)
    }
    if (channel === "line" && (!lineToken || !lineSecret || !destinationId || !destinationType)) {
      return notificationJson({ detail: "LINEの認証情報と送信先を設定してください" }, 400)
    }

    try {
      const [encryptedDiscord, encryptedToken, encryptedSecret] = await Promise.all([
        discordUrl ? encryptSecret(env, discordUrl) : Promise.resolve(null),
        lineToken ? encryptSecret(env, lineToken) : Promise.resolve(null),
        lineSecret ? encryptSecret(env, lineSecret) : Promise.resolve(null),
      ])
      await env.DB.prepare(`
        INSERT INTO notification_settings (
          id, channel, discord_webhook_encrypted,
          line_channel_access_token_encrypted, line_channel_secret_encrypted,
          line_destination_type, line_destination_id, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now', '+9 hours'))
        ON CONFLICT(id) DO UPDATE SET
          channel = excluded.channel,
          discord_webhook_encrypted = COALESCE(excluded.discord_webhook_encrypted, notification_settings.discord_webhook_encrypted),
          line_channel_access_token_encrypted = COALESCE(excluded.line_channel_access_token_encrypted, notification_settings.line_channel_access_token_encrypted),
          line_channel_secret_encrypted = COALESCE(excluded.line_channel_secret_encrypted, notification_settings.line_channel_secret_encrypted),
          line_destination_type = excluded.line_destination_type,
          line_destination_id = excluded.line_destination_id,
          updated_at = excluded.updated_at
      `).bind(channel, encryptedDiscord, encryptedToken, encryptedSecret, destinationType, destinationId).run()
    } catch (error) {
      console.error("[ToolRentalNotifications] save failed", error)
      return notificationJson({ detail: error instanceof Error ? error.message : "通知設定を保存できませんでした" }, 503)
    }

    const saved = await getNotificationSettings(env)
    return notificationJson({
      detail: "通知設定を保存しました",
      channel: saved.channel,
      discord_configured: Boolean(saved.discordWebhookUrl),
      line_configured: Boolean(saved.lineChannelAccessToken && saved.lineChannelSecret),
      line_destination_type: saved.lineDestinationType,
      line_destination_id: saved.lineDestinationId,
    })
  }

  if (url.pathname === "/settings/notifications/test" && request.method === "POST") {
    const result = await sendConfiguredNotification(env, "🔔 工具・機材貸出管理のテスト通知です。")
    if (!result.ok) return notificationJson({ detail: result.error ?? "テスト通知に失敗しました" }, 400)
    if (result.skipped) return notificationJson({ detail: "通知先が「通知しない」になっています" }, 400)
    return notificationJson({ detail: "テスト通知を送信しました" })
  }

  return notificationJson({ detail: "Not Found" }, 404)
}

async function sendDueNotifications(env: NotificationEnv): Promise<void> {
  const settings = await getNotificationSettings(env)
  if (settings.channel === "none") return
  const now = Date.now()
  const { date } = notificationJstParts()
  const result = await env.DB.prepare(`
    SELECT
      loans.id, loans.due_at, loans.due_notice_sent_at, loans.due_at_notification_sent_at,
      borrowers.class_name, borrowers.name AS borrower_name, tools.name AS tool_name,
      GROUP_CONCAT(tool_items.management_number, ', ') AS management_numbers
    FROM loans
    INNER JOIN borrowers ON borrowers.id = loans.borrower_id
    INNER JOIN tools ON tools.id = loans.tool_id
    LEFT JOIN loan_items ON loan_items.loan_id = loans.id
    LEFT JOIN tool_items ON tool_items.id = loan_items.tool_item_id
    WHERE loans.status = 'borrowed'
      AND loans.due_at IS NOT NULL
      AND tools.due_notice_enabled = 1
      AND datetime(loans.due_at) >= datetime('now', '+9 hours', '-6 minutes')
      AND datetime(loans.due_at) <= datetime('now', '+9 hours', '+1 minute')
    GROUP BY loans.id
  `).all<{
    id: number
    due_at: string
    due_notice_sent_at: string | null
    due_at_notification_sent_at: string | null
    class_name: string
    borrower_name: string
    tool_name: string
    management_numbers: string | null
  }>()

  for (const loan of result.results) {
    const dueAt = parseNotificationDate(loan.due_at)
    const preNotice = !loan.due_notice_sent_at && now >= dueAt - 5 * 60 * 1000 && now < dueAt
    const deadlineNotice = !loan.due_at_notification_sent_at && now >= dueAt && now <= dueAt + 5 * 60 * 1000
    if (!preNotice && !deadlineNotice) continue
    const message = [
      preNotice ? "🔔 貸出期限5分前のお知らせ" : "⚠️ 貸出期限のお知らせ",
      "",
      `クラス: ${loan.class_name}`,
      `氏名: ${loan.borrower_name}`,
      `備品: ${loan.tool_name}`,
      `管理番号: ${loan.management_numbers ?? "なし"}`,
      `返却期限: ${loan.due_at}`,
    ].join("\n")
    const sent = await sendConfiguredNotification(env, message)
    if (!sent.ok || sent.skipped) continue
    await env.DB.prepare(preNotice
      ? "UPDATE loans SET due_notice_sent_at = datetime('now', '+9 hours') WHERE id = ? AND due_notice_sent_at IS NULL"
      : "UPDATE loans SET due_at_notification_sent_at = datetime('now', '+9 hours') WHERE id = ? AND due_at_notification_sent_at IS NULL"
    ).bind(loan.id).run()
  }
}

async function sendUniversalReturnNotifications(env: NotificationEnv): Promise<void> {
  const settings = await getNotificationSettings(env)
  if (settings.channel === "none") return
  const now = new Date()
  const { date } = notificationJstParts(now)
  const sources = [
    { type: "class" as const, table: "universal_return_times", flag: "universal_return_enabled", isChief: false },
    { type: "chief" as const, table: "universal_return_times_chief", flag: "universal_return_enabled_for_chief", isChief: true },
  ]

  for (const source of sources) {
    const times = await env.DB.prepare(`SELECT id, return_time FROM ${source.table} ORDER BY return_time`).all<{ id: number; return_time: string }>()
    for (const time of times.results) {
      const returnAt = new Date(`${date}T${time.return_time}:00+09:00`).getTime()
      const beforeWindow = now.getTime() >= returnAt - 5 * 60 * 1000 && now.getTime() < returnAt
      const overdueWindow = now.getTime() >= returnAt && now.getTime() < returnAt + 5 * 60 * 1000
      if (!beforeWindow && !overdueWindow) continue

      const rows = await env.DB.prepare(`
        SELECT loans.id AS loan_id, borrowers.class_name, borrowers.name AS borrower_name,
          tools.name AS tool_name, tool_items.management_number
        FROM loans
        INNER JOIN borrowers ON borrowers.id = loans.borrower_id
        INNER JOIN tools ON tools.id = loans.tool_id
        INNER JOIN loan_items ON loan_items.loan_id = loans.id AND loan_items.returned_at IS NULL
        INNER JOIN tool_items ON tool_items.id = loan_items.tool_item_id
        LEFT JOIN loan_return_notices n
          ON n.loan_id = loans.id AND n.return_time_id = ? AND n.return_time_type = ? AND n.notice_date = ?
        WHERE loans.status = 'borrowed'
          AND tools.${source.flag} = 1
          AND borrowers.class_name ${source.isChief ? "=" : "!="} 'チーフ'
          AND (n.id IS NULL OR ${overdueWindow ? "n.overdue_notified_at IS NULL" : "n.notified_at IS NULL"})
        ORDER BY borrowers.class_name, borrowers.name, tools.name
      `).bind(time.id, source.type, date).all<{
        loan_id: number
        class_name: string
        borrower_name: string
        tool_name: string
        management_number: string
      }>()

      if (!rows.results.length) continue
      const grouped = new Map<string, typeof rows.results>()
      for (const row of rows.results) {
        const current = grouped.get(row.class_name) ?? []
        current.push(row)
        grouped.set(row.class_name, current)
      }

      for (const [className, items] of grouped) {
        const lines = items.map(item => `・${item.borrower_name}: ${item.tool_name} (${item.management_number})`)
        const message = [
          overdueWindow ? "⚠️ 全体返却時刻を過ぎています" : "🔔 全体返却時刻5分前のお知らせ",
          `クラス: ${className}`,
          `返却時刻: ${time.return_time}`,
          "",
          ...lines,
        ].join("\n")
        const sent = await sendConfiguredNotification(env, message)
        if (!sent.ok || sent.skipped) continue
        const statements = items.map(item => env.DB.prepare(`
          INSERT INTO loan_return_notices (
            loan_id, return_time_id, return_time_type, notice_date, notified_at, overdue_notified_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(loan_id, return_time_id, return_time_type, notice_date)
          DO UPDATE SET
            notified_at = COALESCE(loan_return_notices.notified_at, excluded.notified_at),
            overdue_notified_at = COALESCE(loan_return_notices.overdue_notified_at, excluded.overdue_notified_at)
        `).bind(
          item.loan_id, time.id, source.type, date,
          beforeWindow ? notificationJst() : null,
          overdueWindow ? notificationJst() : null,
        ))
        await env.DB.batch(statements)
      }
    }
  }
}

export async function runToolRentalNotifications(env: NotificationEnv): Promise<void> {
  try {
    const settings = await getNotificationSettings(env)
    if (settings.channel === "none") return
    await sendDueNotifications(env)
    await sendUniversalReturnNotifications(env)
  } catch (error) {
    console.error("[ToolRentalNotifications] scheduled task failed", error)
  }
}
