import { isFileLinkConflict } from "./lib/file-link-errors"
import { handleUsers } from "./routes/users"
import { handleAdminSetPassword, handleAuth } from "./routes/auth"
import { handleRoles, handleUserRole, handleUserRoles } from "./routes/roles"
import { handleAccountRoles, handleUserAccountRoles } from "./routes/account-roles"
import { handlePermissions } from "./routes/permissions"
import { handleTasks, processDueTaskNotifications } from "./routes/tasks"
import { handleCalendar } from "./routes/calendar"
import { handleCalendarCategories } from "./routes/calendar-categories"
import { handleNews } from "./routes/news"
import { handlePush, processDuePushDeliveries, processDueNotificationPushDeliveries } from "./routes/push"
import { handleNotifications, purgeAllExpiredNotifications } from "./routes/notifications"
import { handlePresence } from "./routes/presence"
import { handleScripts } from "./routes/scripts"
import { handleEquipment } from "./routes/equipment"
import { handleToolRental, processDueToolRentalNotifications } from "./routes/tool-rental"
import { handleAccounting } from "./routes/accounting"
import { handleFiles } from "./routes/files"
import { handlePublicFiles } from "./routes/public-files"
import { handleReceiptOcr } from "./routes/receipt-ocr"
import { handleSurveys, processDueSurveyNotifications } from "./routes/surveys"
import { handleDecisions } from "./routes/decisions"
import { handleMinutes } from "./routes/minutes"
import { handleMilkCollection } from "./routes/milk-collection"
import { handleAvatarImage, handleAvatarMutation, processQueuedAvatarDeletions } from "./routes/avatars"
import { handleSubmissions, processDueSubmissionNotifications } from "./routes/submissions"
import { handleWishlist } from "./routes/wishlist"
import { processDueCalendarNotifications } from "./routes/calendar-reminders"
import { getSessionUser } from "./lib/session"
import { getSecuritySettings, getSiteSetting } from "./lib/site-settings"

async function readSiteAccessSettings(env: Env): Promise<{
  visibility: "public" | "private"
  maintenanceMode: boolean
  maintenanceMessage: string
  requireLogin: boolean
  loginEnabled: boolean
  siteName: string
  siteDescription: string
  eventName: string
  eventYear: number
  timezone: string
  logoUrl: string
  faviconUrl: string
  calendarDefaultView: "month" | "list"
  featureEnabled: Record<string, boolean>
}> {
  try {
    const rows = await env.DB.prepare(`
      SELECT key, value
      FROM site_settings
      WHERE key IN ('site_visibility', 'maintenance_mode', 'maintenance_message', 'require_login', 'login_enabled', 'site_name', 'site_description', 'event_name', 'event_year', 'timezone', 'logo_url', 'favicon_url', 'operation_settings', 'feature_settings')
    `).all<{ key: string; value: string }>()

    const settings = new Map(rows.results.map(row => {
      try {
        return [row.key, JSON.parse(row.value)] as const
      } catch {
        return [row.key, null] as const
      }
    }))

    return {
      visibility: settings.get("site_visibility") === "private" ? "private" : "public",
      maintenanceMode: settings.get("maintenance_mode") === true,
      maintenanceMessage: typeof settings.get("maintenance_message") === "string"
        ? settings.get("maintenance_message") as string
        : "現在メンテナンス中です。しばらくお待ちください。",
      requireLogin: settings.get("require_login") !== false,
      loginEnabled: settings.get("login_enabled") !== false,
      siteName: typeof settings.get("site_name") === "string" ? settings.get("site_name") as string : "38R星陵祭準備サイト",
      siteDescription: typeof settings.get("site_description") === "string" ? settings.get("site_description") as string : "38Rの星陵祭準備を管理するサイトです。",
      eventName: typeof settings.get("event_name") === "string" ? settings.get("event_name") as string : "星陵祭",
      eventYear: typeof settings.get("event_year") === "number" ? settings.get("event_year") as number : 2026,
      timezone: typeof settings.get("timezone") === "string" ? settings.get("timezone") as string : "Asia/Tokyo",
      logoUrl: typeof settings.get("logo_url") === "string" ? settings.get("logo_url") as string : "",
      faviconUrl: typeof settings.get("favicon_url") === "string" ? settings.get("favicon_url") as string : "",
      calendarDefaultView: (() => {
        const operation = settings.get("operation_settings") as { calendar_default_view?: unknown } | null
        return operation?.calendar_default_view === "list" ? "list" : "month"
      })(),
      featureEnabled: (() => {
        const features = settings.get("feature_settings") as Record<string, { enabled?: boolean }> | null
        return Object.fromEntries(Object.entries(features ?? {}).map(([key, value]) => [key, value?.enabled !== false]))
      })(),
    }
  } catch {
    // Keep the existing access behavior until the settings migration is applied.
    return {
      visibility: "public",
      maintenanceMode: false,
      maintenanceMessage: "現在メンテナンス中です。しばらくお待ちください。",
      requireLogin: true,
      loginEnabled: true,
      siteName: "38R星陵祭準備サイト",
      siteDescription: "38Rの星陵祭準備を管理するサイトです。",
      eventName: "星陵祭",
      eventYear: 2026,
      timezone: "Asia/Tokyo",
      logoUrl: "",
      faviconUrl: "",
      calendarDefaultView: "month",
      featureEnabled: {},
    }
  }
}

async function enforceSiteAccess(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response | null> {
  if (
    request.method === "OPTIONS" ||
    pathname === "/health" ||
    pathname === "/health/db" ||
    pathname === "/api/site-status" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/me" ||
    pathname === "/api/auth/logout"
  ) {
    return null
  }

  const settings = await readSiteAccessSettings(env)
  const user = await getSessionUser(request, env)

  const featurePathMap: Array<[string, string]> = [
    ["/api/tasks", "tasks"],
    ["/api/calendar-categories", "calendar"],
    ["/api/calendar", pathname.includes("/attendance") ? "attendance" : "calendar"],
    ["/api/news", "news"],
    ["/api/scripts", "scripts"],
    ["/api/accounting", "accounting"],
    ["/api/equipment", "equipment"],
    ["/api/surveys", "surveys"],
    ["/api/files", "files"],
    ["/api/public-files", "files"],
    ["/api/submissions", "submissions"],
    ["/api/decisions", "decisions"],
    ["/api/minutes", "minutes"],
    ["/api/tool-rental", "tool_rental"],
    ["/api/wishlist", "wishlist"],
    ["/api/milk-collection", "milk_collection"],
    ["/api/users", "members"],
  ]
  const matchedFeature = featurePathMap.find(([prefix]) =>
    pathname === prefix || pathname.startsWith(prefix + "/"),
  )
  if (matchedFeature) {
    const featureSettings = await getSiteSetting<Record<string, {
      enabled?: boolean
      view?: boolean
      create?: boolean
      edit?: boolean
      delete?: boolean
    }>>(
      env,
      "feature_settings",
      {},
    )
    const feature = featureSettings[matchedFeature[1]]
    if (feature?.enabled === false) {
      return Response.json(
        { error: "This feature is currently disabled", feature: matchedFeature[1] },
        { status: 503 },
      )
    }
    const action = request.method === "GET" || request.method === "HEAD"
      ? "view"
      : request.method === "PATCH" || request.method === "PUT"
        ? "edit"
        : request.method === "DELETE"
          ? "delete"
          : request.method === "POST" && pathname === matchedFeature[0]
            ? "create"
            : null
    if (action && feature?.[action] === false) {
      return Response.json(
        { error: "This operation is disabled by site settings", feature: matchedFeature[1], action },
        { status: 403 },
      )
    }
  }

  if (user) {
    const securitySettings = await getSecuritySettings(env)
    if (securitySettings.force_password_change) {
      const passwordState = await env.DB.prepare(
        "SELECT password_changed_at FROM users WHERE id = ?",
      ).bind(user.id).first<{ password_changed_at: string | null }>()
      const allowedDuringPasswordChange = [
        "/api/auth/me",
        "/api/auth/password",
        "/api/auth/logout",
      ].includes(pathname)
      if (!passwordState?.password_changed_at && !allowedDuringPasswordChange) {
        return Response.json(
          { error: "Password change required", code: "PASSWORD_CHANGE_REQUIRED" },
          { status: 403 },
        )
      }
    }
  }

  if (settings.maintenanceMode) {
    if (!user) {
      return Response.json(
        { error: "Maintenance mode", message: settings.maintenanceMessage },
        { status: 503 },
      )
    }

    const admin = await env.DB.prepare(`
      SELECT 1
      FROM user_account_roles uar
      INNER JOIN account_roles ar ON ar.id = uar.account_role_id
      WHERE uar.user_id = ? AND ar.name = 'important_settings_admin'
      LIMIT 1
    `).bind(user.id).first()

    if (!admin) {
      return Response.json(
        { error: "Maintenance mode", message: settings.maintenanceMessage },
        { status: 503 },
      )
    }
  }

  if (settings.visibility === "private" && !user) {
    return Response.json(
      { error: "Authentication required", message: "このサイトは非公開です。ログインしてください。" },
      { status: 401 },
    )
  }

  return null
}

function getCorsHeaders(request: Request): Headers {
  const origin = request.headers.get("Origin")
  const headers = new Headers()

  if (
    origin === "http://localhost:3000" ||
    origin === "http://127.0.0.1:3000" ||
    origin === "http://localhost:3001" ||
    origin === "http://127.0.0.1:3001" ||
    origin === "https://5d3f213d.38r-seiryofes.pages.dev" ||
    origin === "https://38r-seiryofes.pages.dev" ||
    origin === "https://production.38r-seiryofes.pages.dev" ||
    origin === "https://38r-seiryofes.com"
  ) {
    headers.set("Access-Control-Allow-Origin", origin)
    headers.set("Access-Control-Allow-Credentials", "true")
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type",
    )
    headers.set("Vary", "Origin")
  }

  return headers
}

export function withCors(
  request: Request,
  response: Response,
): Response {
  const headers = new Headers()

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      headers.set(key, value)
    }
  })

  for (const cookie of response.headers.getAll("Set-Cookie")) {
    headers.append("Set-Cookie", cookie)
  }

  const corsHeaders = getCorsHeaders(request)

  corsHeaders.forEach((value, key) => {
    headers.set(key, value)
  })

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === "OPTIONS") {
      return withCors(
        request,
        new Response(null, {
          status: 204,
        }),
      )
    }

    if (url.pathname === "/health") {
      return withCors(
        request,
        Response.json({
          status: "ok",
          service: "38r-seiryofes",
        }),
      )
    }

    if (url.pathname === "/api/site-config" && request.method === "GET") {
      const settings = await readSiteAccessSettings(env)
      return withCors(request, Response.json({
        site_name: settings.siteName,
        site_description: settings.siteDescription,
        event_name: settings.eventName,
        event_year: settings.eventYear,
        timezone: settings.timezone,
        logo_url: settings.logoUrl,
        favicon_url: settings.faviconUrl,
        calendar_default_view: settings.calendarDefaultView,
        feature_enabled: settings.featureEnabled,
      }))
    }

    if (url.pathname === "/api/site-status" && request.method === "GET") {
      const settings = await readSiteAccessSettings(env)
      const user = await getSessionUser(request, env)
      const [isAdmin, isImportantSettingsAdmin] = user
        ? await Promise.all([
            env.DB.prepare(`
              SELECT 1 FROM user_account_roles uar
              INNER JOIN account_roles ar ON ar.id = uar.account_role_id
              WHERE uar.user_id = ? AND ar.name = 'admin' LIMIT 1
            `).bind(user.id).first(),
            env.DB.prepare(`
              SELECT 1 FROM user_account_roles uar
              INNER JOIN account_roles ar ON ar.id = uar.account_role_id
              WHERE uar.user_id = ? AND ar.name = 'important_settings_admin' LIMIT 1
            `).bind(user.id).first(),
          ]).then(([admin, important]) => [Boolean(admin), Boolean(important)] as const)
        : [false, false]

      return withCors(request, Response.json({
        site_visibility: settings.visibility,
        maintenance_mode: settings.maintenanceMode,
        maintenance_message: settings.maintenanceMessage,
        require_login: settings.requireLogin,
        login_enabled: settings.loginEnabled,
        site_name: settings.siteName,
        site_description: settings.siteDescription,
        event_name: settings.eventName,
        event_year: settings.eventYear,
        timezone: settings.timezone,
        logo_url: settings.logoUrl,
        favicon_url: settings.faviconUrl,
        calendar_default_view: settings.calendarDefaultView,
        feature_enabled: settings.featureEnabled,
        is_authenticated: Boolean(user),
        is_admin: isAdmin,
        is_important_settings_admin: isImportantSettingsAdmin,
      }))
    }

    const siteAccessError = await enforceSiteAccess(request, env, url.pathname)
    if (siteAccessError) {
      return withCors(request, siteAccessError)
    }

    if (url.pathname === "/health/db") {
      try {
        const result = await env.DB
          .prepare("SELECT 1 AS ok")
          .first<{ ok: number }>()

        return withCors(
          request,
          Response.json({
            status: "ok",
            database: result?.ok === 1 ? "connected" : "unknown",
          }),
        )
      } catch (error) {
        console.error("D1 connection error:", error)

        return withCors(
          request,
          Response.json(
            {
              status: "error",
              database: "disconnected",
            },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/scripts" ||
      url.pathname.startsWith("/api/scripts/")
    ) {
      const path = url.pathname.slice("/api/scripts".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleScripts(request, env, pathParts),
        )
      } catch (error) {
        console.error("Scripts API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/wishlist" ||
      url.pathname.startsWith("/api/wishlist/")
    ) {
      const path = url.pathname.slice("/api/wishlist".length)
      const pathParts = path.split("/").filter(Boolean)

      try {
        return withCors(
          request,
          await handleWishlist(request, env, pathParts),
        )
      } catch (error) {
        console.error("Wishlist API error:", error)
        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/tool-rental" ||
      url.pathname.startsWith("/api/tool-rental/")
    ) {
      const path = url.pathname.slice("/api/tool-rental".length)
      const pathParts = path.split("/").filter(Boolean)

      try {
        return withCors(
          request,
          await handleToolRental(request, env, pathParts),
        )
      } catch (error) {
        console.error("Tool rental API error:", error)
        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/equipment" ||
      url.pathname.startsWith("/api/equipment/")
    ) {
      const path = url.pathname.slice("/api/equipment".length)
      const pathParts = path.split("/").filter(Boolean)

      return withCors(
        request,
        await handleEquipment(request, env, pathParts),
      )
    }

    if (url.pathname === "/api/accounting/receipts/ocr") {
      try {
        return withCors(request, await handleReceiptOcr(request, env))
      } catch (error) {
        console.error("Receipt OCR API error:", error)
        return withCors(
          request,
          Response.json(
            { message: "OCR処理中にエラーが発生しました" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/accounting" ||
      url.pathname.startsWith("/api/accounting/")
    ) {
      const path = url.pathname.slice("/api/accounting".length)
      const pathParts = path.split("/").filter(Boolean)

      return withCors(
        request,
        await handleAccounting(request, env, pathParts),
      )
    }

    if (
      url.pathname === "/api/public/files" ||
      url.pathname.startsWith("/api/public/files/")
    ) {
      const path = url.pathname.slice("/api/public/files".length)
      const pathParts = path.split("/").filter(Boolean)
      return withCors(request, await handlePublicFiles(request, env, pathParts))
    }

    if (
      url.pathname === "/api/files" ||
      url.pathname.startsWith("/api/files/")
    ) {
      const path = url.pathname.slice("/api/files".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleFiles(request, env, pathParts),
        )
      } catch (error) {
        console.error("Files API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/news" ||
      url.pathname.startsWith("/api/news/")
    ) {
      const path = url.pathname.slice("/api/news".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleNews(request, env, pathParts, ctx),
        )
      } catch (error) {
        console.error("News API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (url.pathname === "/api/presence" || url.pathname.startsWith("/api/presence/")) {
      const pathParts = url.pathname.slice("/api/presence".length).split("/").filter(Boolean)
      try {
        return withCors(request, await handlePresence(request, env, pathParts))
      } catch (error) {
        console.error("Presence API error:", error)
        return withCors(request, Response.json({ error: "Internal Server Error" }, { status: 500 }))
      }
    }
    if (
      url.pathname === "/api/notifications" ||
      url.pathname.startsWith("/api/notifications/")
    ) {
      const path = url.pathname.slice("/api/notifications".length)
      const pathParts = path.split("/").filter(Boolean)

      try {
        return withCors(
          request,
          await handleNotifications(request, env, pathParts),
        )
      } catch (error) {
        console.error("Notifications API error:", error)
        return withCors(
          request,
          Response.json({ error: "Internal Server Error" }, { status: 500 }),
        )
      }
    }

    if (
      url.pathname === "/api/push" ||
      url.pathname.startsWith("/api/push/")
    ) {
      const path = url.pathname.slice("/api/push".length)
      const pathParts = path.split("/").filter(Boolean)

      try {
        return withCors(
          request,
          await handlePush(request, env, pathParts),
        )
      } catch (error) {
        console.error("Push API error:", error)
        return withCors(
          request,
          Response.json({ error: "Internal Server Error" }, { status: 500 }),
        )
      }
    }

    if (
      url.pathname === "/api/tasks" ||
      url.pathname.startsWith("/api/tasks/")
    ) {
      const path = url.pathname.slice("/api/tasks".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleTasks(request, env, pathParts),
        )
      } catch (error) {
        console.error("Tasks API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/calendar/categories" ||
      url.pathname.startsWith("/api/calendar/categories/")
    ) {
      const path = url.pathname.slice("/api/calendar/categories".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleCalendarCategories(request, env, pathParts),
        )
      } catch (error) {
        console.error("Calendar categories API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/calendar" ||
      url.pathname.startsWith("/api/calendar/")
    ) {
      const path = url.pathname.slice("/api/calendar".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleCalendar(request, env, pathParts),
        )
      } catch (error) {
        console.error("Calendar API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (url.pathname === "/api/auth/avatar") {
      try {
        return withCors(request, await handleAvatarMutation(request, env))
      } catch (error) {
        console.error("Avatar mutation API error:", error)
        return withCors(request, Response.json({ error: "Internal Server Error" }, { status: 500 }))
      }
    }

    if (url.pathname === "/api/avatars" || url.pathname.startsWith("/api/avatars/")) {
      const path = url.pathname.slice("/api/avatars".length)
      const pathParts = path.split("/").filter(Boolean)
      try {
        return withCors(request, await handleAvatarImage(request, env, pathParts))
      } catch (error) {
        console.error("Avatar image API error:", error)
        return withCors(request, Response.json({ error: "Internal Server Error" }, { status: 500 }))
      }
    }

    if (
      url.pathname === "/api/auth" ||
      url.pathname.startsWith("/api/auth/")
    ) {
      const path = url.pathname.slice("/api/auth".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleAuth(request, env, pathParts),
        )
      } catch (error) {
        console.error("Auth API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/permissions" ||
      url.pathname.startsWith("/api/permissions/")
    ) {
      const path = url.pathname.slice("/api/permissions".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handlePermissions(request, env, pathParts),
        )
      } catch (error) {
        console.error("Permissions API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/admin/settings" ||
      url.pathname.startsWith("/api/admin/settings/")
    ) {
      const suffix = url.pathname.slice("/api/admin/settings".length)
      const pathParts = suffix.split("/").filter(Boolean)
      if (pathParts[0] === "roles") pathParts[0] = "important-admins"
      try {
        return withCors(
          request,
          await handleAccountRoles(request, env, ["settings", ...pathParts]),
        )
      } catch (error) {
        console.error("Admin settings API error:", error)
        return withCors(request, Response.json({ error: "Internal Server Error" }, { status: 500 }))
      }
    }

    if (
      url.pathname === "/api/account-roles" ||
      url.pathname.startsWith("/api/account-roles/")
    ) {
      const path = url.pathname.slice("/api/account-roles".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleAccountRoles(request, env, pathParts),
        )
      } catch (error) {
        console.error("Account roles API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname.startsWith("/api/users/") &&
      url.pathname.endsWith("/password")
    ) {
      const path = url.pathname.slice("/api/users".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      if (
        request.method === "PATCH" &&
        pathParts.length === 2 &&
        pathParts[1] === "password"
      ) {
        try {
          return withCors(
            request,
            await handleAdminSetPassword(
              request,
              env,
              pathParts[0],
            ),
          )
        } catch (error) {
          console.error("Admin password API error:", error)

          return withCors(
            request,
            Response.json(
              { error: "Internal Server Error" },
              { status: 500 },
            ),
          )
        }
      }
    }

    if (
      url.pathname.startsWith("/api/users/") &&
      url.pathname.includes("/account-roles")
    ) {
      const path = url.pathname.slice("/api/users".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        if (
          pathParts[1] === "account-roles" &&
          (pathParts.length === 2 || pathParts.length === 3)
        ) {
          return withCors(
            request,
            await handleUserAccountRoles(
              request,
              env,
              [
                pathParts[0],
                ...(pathParts.length === 3 ? [pathParts[2]] : []),
              ],
            ),
          )
        }
      } catch (error) {
        console.error("User account roles API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/roles" ||
      url.pathname.startsWith("/api/roles/")
    ) {
      const path = url.pathname.slice("/api/roles".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleRoles(request, env, pathParts),
        )
      } catch (error) {
        console.error("Roles API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname.startsWith("/api/users/") &&
      url.pathname.includes("/roles")
    ) {
      const path = url.pathname.slice("/api/users".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        const { requireAccountRole } = await import("./lib/authz")

        const auth = await requireAccountRole(
          request,
          env,
          "admin",
        )

        if (auth instanceof Response) {
          return withCors(request, auth)
        }

        if (pathParts[1] === "roles" && pathParts.length === 2) {
          return withCors(
            request,
            await handleUserRoles(
              request,
              env,
              [pathParts[0]],
            ),
          )
        }

        if (pathParts[1] === "roles" && pathParts.length === 3) {
          return withCors(
            request,
            await handleUserRole(
              request,
              env,
              [pathParts[0], pathParts[2]],
            ),
          )
        }
      } catch (error) {
        console.error("User roles API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }

    if (
      url.pathname === "/api/users" ||
      url.pathname.startsWith("/api/users/")
    ) {
      const path = url.pathname.slice("/api/users".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return withCors(
          request,
          await handleUsers(request, env, pathParts),
        )
      } catch (error) {
        console.error("Users API error:", error)

        return withCors(
          request,
          Response.json(
            { error: "Internal Server Error" },
            { status: 500 },
          ),
        )
      }
    }


    if (
      url.pathname === "/api/surveys" ||
      url.pathname.startsWith("/api/surveys/")
    ) {
      const path = url.pathname.slice("/api/surveys".length)
      const pathParts = path.split("/").filter(Boolean)

      try {
        return withCors(
          request,
          await handleSurveys(request, env, pathParts),
        )
      } catch (error) {
        console.error("Surveys API error:", error)
        return withCors(
          request,
          Response.json({ error: "Internal Server Error" }, { status: 500 }),
        )
      }
    }


    if (
      url.pathname === "/api/submissions" ||
      url.pathname.startsWith("/api/submissions/")
    ) {
      const path = url.pathname.slice("/api/submissions".length)
      const pathParts = path.split("/").filter(Boolean)
      try {
        return withCors(request, await handleSubmissions(request, env, pathParts))
      } catch (error) {
        if (isFileLinkConflict(error)) {
          return withCors(
            request,
            Response.json(
              {
                error: "このファイルは別の領域ですでに使用されています",
                message: "このファイルは別の領域ですでに使用されています",
                code: "FILE_LINK_CONFLICT",
              },
              { status: 409 },
            ),
          )
        }

        console.error("Submissions API error:", error)
        return withCors(request, Response.json({ error: "Internal Server Error" }, { status: 500 }))
      }
    }

    if (
      url.pathname === "/api/milk-collection" ||
      url.pathname.startsWith("/api/milk-collection/")
    ) {
      const path = url.pathname.slice("/api/milk-collection".length)
      const pathParts = path.split("/").filter(Boolean)
      try {
        return withCors(request, await handleMilkCollection(request, env, pathParts))
      } catch (error) {
        console.error("Milk collection API error:", error)
        return withCors(request, Response.json({ error: "Internal Server Error" }, { status: 500 }))
      }
    }

    if (
      url.pathname === "/api/minutes" ||
      url.pathname.startsWith("/api/minutes/")
    ) {
      const path = url.pathname.slice("/api/minutes".length)
      const pathParts = path.split("/").filter(Boolean)

      try {
        return withCors(
          request,
          await handleMinutes(request, env, pathParts),
        )
      } catch (error) {
        console.error("Minutes API error:", error)
        return withCors(
          request,
          Response.json({ error: "Internal Server Error" }, { status: 500 }),
        )
      }
    }

    if (
      url.pathname === "/api/decisions" ||
      url.pathname.startsWith("/api/decisions/")
    ) {
      const path = url.pathname.slice("/api/decisions".length)
      const pathParts = path.split("/").filter(Boolean)

      try {
        return withCors(
          request,
          await handleDecisions(request, env, pathParts),
        )
      } catch (error) {
        if (isFileLinkConflict(error)) {
          return withCors(
            request,
            Response.json(
              {
                error: "このファイルは別の領域ですでに使用されています",
                message: "このファイルは別の領域ですでに使用されています",
                code: "FILE_LINK_CONFLICT",
              },
              { status: 409 },
            ),
          )
        }

        console.error("Decisions API error:", error)
        return withCors(
          request,
          Response.json({ error: "Internal Server Error" }, { status: 500 }),
        )
      }
    }

    return withCors(
      request,
      Response.json(
        { error: "Not Found" },
        { status: 404 },
      ),
    )
  },

  async scheduled(_controller, env): Promise<void> {
    try {
      await processQueuedAvatarDeletions(env, 50)
    } catch (error) {
      console.error("Scheduled avatar cleanup failed:", error)
    }

    try {
      await processDuePushDeliveries(env)
    } catch (error) {
      console.error("Scheduled push delivery failed:", error)
    }

    try {
      await processDueNotificationPushDeliveries(env)
    } catch (error) {
      console.error("Scheduled notification push delivery failed:", error)
    }

    try {
      await processDueToolRentalNotifications(env)
    } catch (error) {
      console.error("Scheduled tool rental notification processing failed:", error)
    }

    try {
      await processDueTaskNotifications(env)
    } catch (error) {
      console.error("Scheduled task deadline notification processing failed:", error)
    }

    try {
      await processDueSubmissionNotifications(env)
    } catch (error) {
      console.error("Scheduled submission deadline notification processing failed:", error)
    }

    try {
      await processDueSurveyNotifications(env)
    } catch (error) {
      console.error("Scheduled survey notification processing failed:", error)
    }

    try {
      await processDueCalendarNotifications(env)
    } catch (error) {
      console.error("Scheduled calendar notification processing failed:", error)
    }

    try {
      await purgeAllExpiredNotifications(env)
    } catch (error) {
      console.error("Scheduled expired notification cleanup failed:", error)
    }
  },
} satisfies ExportedHandler<Env>
