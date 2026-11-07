import { describe, expect, it } from "vitest"
import { withCors } from "../src/index"

describe("CORS response headers", () => {
  it("preserves both legacy cleanup and shared-domain session cookies", () => {
    const headers = new Headers()

    headers.append(
      "Set-Cookie",
      "session_id=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
    )
    headers.append(
      "Set-Cookie",
      "session_id=test-session; HttpOnly; Secure; SameSite=Lax; Path=/; Domain=.38r-seiryofes.com; Max-Age=604800",
    )

    const request = new Request(
      "https://api.38r-seiryofes.com/api/auth/login",
      {
        headers: {
          Origin: "https://38r-seiryofes.com",
        },
      },
    )

    const response = withCors(
      request,
      new Response(JSON.stringify({ success: true }), { headers }),
    )

    const cookies = response.headers.getAll("Set-Cookie")

    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toContain("Max-Age=0")
    expect(cookies[1]).toContain("session_id=test-session")
    expect(cookies[1]).toContain("Domain=.38r-seiryofes.com")

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://38r-seiryofes.com",
    )
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true")
  })
})
