export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method !== "GET") {
      return Response.json(
        { error: "Method Not Allowed" },
        { status: 405 },
      )
    }

    switch (url.pathname) {
      case "/health":
        return Response.json({
          status: "ok",
          service: "38r-seiryofes",
        })

      case "/health/db": {
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

      default:
        return Response.json(
          { error: "Not Found" },
          { status: 404 },
        )
    }
  },
} satisfies ExportedHandler<Env>
