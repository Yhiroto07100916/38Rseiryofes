import { describe, expect, it } from "vitest"
import {
  formatPushBody,
  isAllowedPushEndpoint,
  parseJstDateTime,
} from "../src/routes/push"

describe("web push helpers", () => {
  it("keeps notification bodies at 50 characters and adds an ellipsis when needed", () => {
    expect(formatPushBody("あ".repeat(50))).toBe("あ".repeat(50))
    expect(formatPushBody("あ".repeat(51))).toBe("あ".repeat(50) + "…")
  })

  it("counts Unicode code points rather than UTF-16 code units", () => {
    expect(formatPushBody("😀".repeat(51))).toBe("😀".repeat(50) + "…")
  })

  it("accepts known HTTPS push service endpoints", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/example")).toBe(true)
    expect(isAllowedPushEndpoint("https://web.push.apple.com/example")).toBe(true)
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/example")).toBe(true)
  })

  it("parses timezone-less tool rental deadlines as JST", () => {
    expect(parseJstDateTime("2026-11-10 20:00:00"))
      .toBe(Date.parse("2026-11-10T20:00:00+09:00"))
    expect(parseJstDateTime("2026-11-10T20:00:00Z"))
      .toBe(Date.parse("2026-11-10T20:00:00Z"))
  })

  it("rejects insecure and untrusted endpoints", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/example")).toBe(false)
    expect(isAllowedPushEndpoint("https://example.com/push")).toBe(false)
    expect(isAllowedPushEndpoint("https://localhost/push")).toBe(false)
    expect(isAllowedPushEndpoint("not a url")).toBe(false)
  })
})
