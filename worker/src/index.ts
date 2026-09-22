import { handleUsers } from "./routes/users"
import { handleAuth } from "./routes/auth"
import { handleRoles, handleUserRole, handleUserRoles } from "./routes/roles"

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        service: "38r-seiryofes",
      })
    }

    if (url.pathname === "/health/db") {
      try {
        const result = await env.DB
          .prepare("SELECT 1 AS ok")
          .first<{ ok: number }>()

        return Response.json({
          status: "ok",
          database: result?.ok === 1 ? "connected" : "unknown",
        })
      } catch (error) {
        console.error("D1 connection error:", error)

        return Response.json(
          {
            status: "error",
            database: "disconnected",
          },
          { status: 500 },
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
        return await handleAuth(request, env, pathParts)
      } catch (error) {
        console.error("Auth API error:", error)

        return Response.json(
          { error: "Internal Server Error" },
          { status: 500 },
        )
      }
    }

    if (url.pathname === "/api/roles" || url.pathname.startsWith("/api/roles/")) {
      const path = url.pathname.slice("/api/roles".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return await handleRoles(request, env, pathParts)
      } catch (error) {
        console.error("Roles API error:", error)

        return Response.json(
          { error: "Internal Server Error" },
          { status: 500 },
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
          return auth
        }

        if (pathParts[1] === "roles" && pathParts.length === 2) {
          return await handleUserRoles(
            request,
            env,
            [pathParts[0]],
          )
        }

        if (pathParts[1] === "roles" && pathParts.length === 3) {
          return await handleUserRole(
            request,
            env,
            [pathParts[0], pathParts[2]],
          )
        }
      } catch (error) {
        console.error("User roles API error:", error)

        return Response.json(
          { error: "Internal Server Error" },
          { status: 500 },
        )
      }
    }

    if (url.pathname === "/api/users" || url.pathname.startsWith("/api/users/")) {
      const path = url.pathname.slice("/api/users".length)
      const pathParts = path
        .split("/")
        .filter(Boolean)

      try {
        return await handleUsers(request, env, pathParts)
      } catch (error) {
        console.error("Users API error:", error)

        return Response.json(
          { error: "Internal Server Error" },
          { status: 500 },
        )
      }
    }

    return Response.json(
      { error: "Not Found" },
      { status: 404 },
    )
  },
} satisfies ExportedHandler<Env>
