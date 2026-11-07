import { describe, expect, it } from "vitest";
import { isFileLinkConflict } from "../src/lib/file-link-errors";

describe("isFileLinkConflict", () => {
  it("detects FILE_LINK_CONFLICT in an Error message", () => {
    expect(
      isFileLinkConflict(new Error("FILE_LINK_CONFLICT: already linked")),
    ).toBe(true);
  });

  it("detects FILE_LINK_CONFLICT in a nested cause", () => {
    const error = new Error("Database operation failed", {
      cause: new Error("FILE_LINK_CONFLICT: another domain"),
    });

    expect(isFileLinkConflict(error)).toBe(true);
  });

  it("detects FILE_LINK_CONFLICT in a string cause", () => {
    const error = new Error("Database operation failed", {
      cause: "FILE_LINK_CONFLICT",
    });

    expect(isFileLinkConflict(error)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isFileLinkConflict(new Error("Database unavailable"))).toBe(false);
    expect(isFileLinkConflict(null)).toBe(false);
    expect(isFileLinkConflict(undefined)).toBe(false);
  });

  it("handles circular causes safely", () => {
    const error: { message: string; cause?: unknown } = {
      message: "Database operation failed",
    };
    error.cause = error;

    expect(isFileLinkConflict(error)).toBe(false);
  });
});
