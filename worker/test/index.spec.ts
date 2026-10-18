import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Worker API routing", () => {
  it("returns 401 for an unauthenticated task request", async () => {
    const response = await SELF.fetch(
      "http://example.com/api/tasks",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "テストタスク",
          scope: "class",
        }),
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "Unauthorized",
    });
  });

  it("returns 404 for an unknown route", async () => {
    const response = await SELF.fetch(
      "http://example.com/this-route-does-not-exist",
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Not Found",
    });
  });
});
