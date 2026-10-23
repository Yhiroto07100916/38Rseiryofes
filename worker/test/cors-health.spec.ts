import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const allowedOrigin = "https://38r-seiryofes.com";
const untrustedOrigin = "https://attacker.example";

describe("CORS and health endpoint security baseline", () => {
  it("returns a minimal healthy response and allows the configured site origin", async () => {
    const response = await SELF.fetch("http://example.com/health", {
      headers: { Origin: allowedOrigin },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      status: "ok",
      service: "38r-seiryofes",
    });
    expect(response.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("vary")).toContain("Origin");
  });

  it("does not grant CORS access to an untrusted origin", async () => {
    const response = await SELF.fetch("http://example.com/health", {
      headers: { Origin: untrustedOrigin },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("answers preflight for a configured origin with 204 and the expected CORS policy", async () => {
    const response = await SELF.fetch("http://example.com/api/tasks", {
      method: "OPTIONS",
      headers: {
        Origin: allowedOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(allowedOrigin);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
    expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type");
  });

  it("does not grant CORS access to an untrusted origin during preflight", async () => {
    const response = await SELF.fetch("http://example.com/api/tasks", {
      method: "OPTIONS",
      headers: {
        Origin: untrustedOrigin,
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  });
});
