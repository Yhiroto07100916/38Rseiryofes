import { handleUsers } from "./routes/users"
import { handleAdminSetPassword, handleAuth } from "./routes/auth"
import { handleRoles, handleUserRole, handleUserRoles } from "./routes/roles"
import { handleAccountRoles, handleUserAccountRoles } from "./routes/account-roles"
import { handleTasks } from "./routes/tasks"

function getCorsHeaders(request: Request): Headers {
  const origin = request.headers.get("Origin")
  const headers = new Headers()

  if (
    origin === "http://localhost:3000" ||
    origin === "http://127.0.0.1:3000" ||
    origin === "https://5d3f213d.38r-seiryofes.pages.dev" ||
    origin === "https://38r-seiryofes.pages.dev"
  ) {
    headers.set("Access-Control-Allow-Origin", origin)
    headers.set("Access-Control-Allow-Credentials", "true")
    headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
    headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type",
    )
    headers.set("Vary", "Origin")
  }

  return headers
}

function withCors(
  request: Request,
  response: Response,
): Response {
  const headers = new Headers(response.headers)
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
  async fetch(request, env): Promise<Response> {
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

    return withCors(
      request,
      Response.json(
        { error: "Not Found" },
        { status: 404 },
      ),
    )
  },
} satisfies ExportedHandler<Env>
