import { SELF } from "cloudflare:test";
import {
  createExpiredSessionCookie,
  createSessionCookie,
  getSessionCookieDomain,
} from "../src/lib/session";
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


describe("Session cookie domain", () => {
  it("shares production API session cookies with the frontend subdomain", () => {
    const request = new Request("https://api.38r-seiryofes.com/api/auth/login");
    const domain = getSessionCookieDomain(request);

    expect(domain).toBe(".38r-seiryofes.com");
    expect(createSessionCookie("session-token", true, domain)).toContain(
      "Domain=.38r-seiryofes.com",
    );
    expect(createExpiredSessionCookie(true, domain)).toContain(
      "Domain=.38r-seiryofes.com",
    );
  });

  it("does not widen the cookie domain for preview or local environments", () => {
    expect(
      getSessionCookieDomain(
        new Request("https://preview.example.pages.dev/api/auth/login"),
      ),
    ).toBeUndefined();
    expect(
      getSessionCookieDomain(
        new Request("http://localhost:8787/api/auth/login"),
      ),
    ).toBeUndefined();
  });
});
