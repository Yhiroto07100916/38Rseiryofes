import { handleUsers } from "./routes/users"

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
