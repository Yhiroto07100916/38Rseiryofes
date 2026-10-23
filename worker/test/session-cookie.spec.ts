import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const malformedCookie = "session_id=%E0%A4%A";

describe("Malformed session cookie handling", () => {
  it("treats a malformed session cookie as unauthenticated for protected task routes", async () => {
    const response = await SELF.fetch("http://example.com/api/tasks", {
      method: "POST",
      headers: {
        Cookie: malformedCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: "cookie parsing regression test",
        scope: "class",
      }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("treats a malformed session cookie as unauthenticated for /api/auth/me", async () => {
    const response = await SELF.fetch("http://example.com/api/auth/me", {
      headers: { Cookie: malformedCookie },
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});
