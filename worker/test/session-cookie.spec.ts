import { SELF } from "cloudflare:test";
import {
  createExpiredSessionCookie,
  createLoginSessionHeaders,
  createLogoutSessionHeaders,
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
    expect(
      getSessionCookieDomain(
        new Request("https://api.38r-seiryofes.com.attacker.example/api/auth/login"),
      ),
    ).toBeUndefined();
    expect(
      createSessionCookie("local-token", true),
    ).not.toContain("Domain=");
  });

  it("sends legacy-cookie cleanup and the new session cookie as separate headers", () => {
    const headers = createLoginSessionHeaders(
      "session-token",
      true,
      ".38r-seiryofes.com",
    );
    const cookies = headers.getAll("Set-Cookie");

    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain("Max-Age=0");
    expect(cookies[0]).not.toContain("Domain=");
    expect(cookies[1]).toContain("session_id=session-token");
    expect(cookies[1]).toContain("Domain=.38r-seiryofes.com");
    expect(cookies[1]).toContain("HttpOnly");
    expect(cookies[1]).toContain("Secure");
    expect(cookies[1]).toContain("SameSite=Lax");
  });

  it("expires both legacy and shared-domain cookies on logout", () => {
    const headers = createLogoutSessionHeaders(
      true,
      ".38r-seiryofes.com",
    );
    const cookies = headers.getAll("Set-Cookie");

    expect(cookies).toHaveLength(2);
    expect(cookies[0]).toContain("Max-Age=0");
    expect(cookies[0]).not.toContain("Domain=");
    expect(cookies[1]).toContain("Max-Age=0");
    expect(cookies[1]).toContain("Domain=.38r-seiryofes.com");
  });

});
