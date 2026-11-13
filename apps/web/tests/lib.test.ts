import { describe, expect, it } from "vitest";
import { describeActivity } from "../lib/activity";
import { buildBreadcrumbs } from "../lib/breadcrumbs";
import { initials, timeAgo } from "../lib/format";
import { can, groupPermissions, titleCase } from "../lib/permissions";

describe("can()", () => {
  it("lets SUPER_ADMIN do everything and checks explicit permissions for others", () => {
    expect(can({ roleKeys: ["SUPER_ADMIN"], permissions: [] }, "users:delete")).toBe(true);
    expect(can({ roleKeys: ["EDITOR"], permissions: ["pages:read"] }, "pages:read")).toBe(true);
    expect(can({ roleKeys: ["EDITOR"], permissions: ["pages:read"] }, "users:read")).toBe(false);
    expect(can(null, "pages:read")).toBe(false);
  });
});

describe("groupPermissions()", () => {
  it("groups by module in catalog order with readable labels", () => {
    const groups = groupPermissions([
      { key: "pages:read", module: "pages" },
      { key: "pages:publish", module: "pages" },
      { key: "blog-taxonomy:manage", module: "blog-taxonomy" },
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Pages", "Blog Taxonomy"]);
    expect(groups[0]!.permissions).toEqual([
      { key: "pages:read", label: "Read" },
      { key: "pages:publish", label: "Publish" },
    ]);
  });

  it("title-cases keys", () => {
    expect(titleCase("SEO_MANAGER")).toBe("SEO MANAGER");
    expect(titleCase("blog-taxonomy")).toBe("Blog Taxonomy");
  });
});

describe("buildBreadcrumbs()", () => {
  it("builds linked crumbs with an unlinked last item", () => {
    expect(buildBreadcrumbs("/admin")).toEqual([{ label: "Dashboard", href: undefined }]);
    expect(buildBreadcrumbs("/admin/users")).toEqual([
      { label: "Dashboard", href: "/admin" },
      { label: "Users", href: undefined },
    ]);
    expect(buildBreadcrumbs("/admin/roles?x=1").at(-1)?.label).toBe("Roles & Permissions");
  });

  it("returns nothing outside the admin area", () => {
    expect(buildBreadcrumbs("/blog")).toEqual([]);
  });
});

describe("describeActivity()", () => {
  it("humanises known actions and falls back for unknown ones", () => {
    expect(describeActivity({ action: "user.restore", actor: { name: "Ann", email: "a@x.io" } })).toBe("Ann restored a user");
    expect(describeActivity({ action: "page.publish", actor: null })).toBe("Someone page publish");
  });
});

describe("format helpers", () => {
  it("computes relative times and initials", () => {
    const now = Date.parse("2026-11-13T12:00:00Z");
    expect(timeAgo("2026-11-13T11:30:00Z", now)).toBe("30 minutes ago");
    expect(timeAgo("2026-11-11T12:00:00Z", now)).toBe("2 days ago");
    expect(timeAgo("2026-11-13T11:59:50Z", now)).toBe("just now");
    expect(initials("Vimal Kumar")).toBe("VK");
    expect(initials("  ")).toBe("?");
  });
});
