import { describe, expect, it } from "vitest"
import { jstExpiry } from "../src/routes/presence-notifications"

describe("presence state expiry (JST)", () => {
  it("expires an inside result before 18:00 at 18:00 JST", () => {
    expect(jstExpiry("inside", new Date("2026-11-10T08:59:59.000Z")))
      .toBe("2026-11-10T09:00:00.000Z")
  })

  it("keeps a new inside result at exactly 18:00 valid until the end of the JST day", () => {
    expect(jstExpiry("inside", new Date("2026-11-10T09:00:00.000Z")))
      .toBe("2026-11-10T15:00:00.000Z")
  })

  it("keeps a new inside result after 18:00 valid until the end of the JST day", () => {
    expect(jstExpiry("inside", new Date("2026-11-10T09:30:00.000Z")))
      .toBe("2026-11-10T15:00:00.000Z")
  })

  it("expires an outside result at the end of the JST day", () => {
    expect(jstExpiry("outside", new Date("2026-11-10T02:00:00.000Z")))
      .toBe("2026-11-10T15:00:00.000Z")
  })

  it("does not assign an expiry to unknown", () => {
    expect(jstExpiry("unknown", new Date("2026-11-10T02:00:00.000Z")))
      .toBeNull()
  })
})
