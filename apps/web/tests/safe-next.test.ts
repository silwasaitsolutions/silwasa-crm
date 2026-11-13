import { describe, expect, it } from "vitest";
import { safeNext } from "../lib/safe-next";

describe("safeNext", () => {
  it("keeps same-site admin paths", () => {
    expect(safeNext("/admin")).toBe("/admin");
    expect(safeNext("/admin/pages/new")).toBe("/admin/pages/new");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/admin/../../etc",
    "javascript:alert(1)",
    "/blog",
    "",
    null,
    undefined,
  ])("falls back to /admin for %s", (value) => {
    expect(safeNext(value as string | null | undefined)).toBe("/admin");
  });
});
