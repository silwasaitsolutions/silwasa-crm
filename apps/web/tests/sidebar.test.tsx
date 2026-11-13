// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/users", useRouter: () => ({ push: vi.fn() }) }));

import { AdminProvider } from "../features/admin-shell/auth-context";
import { Sidebar } from "../features/admin-shell/sidebar";

afterEach(cleanup);

const renderSidebar = (user: { roleKeys: string[]; permissions: string[] }) =>
  render(
    <AdminProvider user={{ id: "1", email: "a@x.io", name: "A", ...user }}>
      <Sidebar collapsed={false} onToggleCollapsed={() => {}} mobileOpen={false} onCloseMobile={() => {}} />
    </AdminProvider>,
  );

describe("Sidebar", () => {
  it("shows admin links only to users who hold the permission", () => {
    renderSidebar({ roleKeys: ["EDITOR"], permissions: ["pages:read"] });
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "My account" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Users" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Roles & Permissions" })).toBeNull();
  });

  it("shows everything to a Super Admin and marks the current page", () => {
    renderSidebar({ roleKeys: ["SUPER_ADMIN"], permissions: [] });
    expect(screen.getByRole("link", { name: "Roles & Permissions" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Users" }).getAttribute("aria-current")).toBe("page");
  });

  it("lists upcoming modules as disabled placeholders, not links", () => {
    renderSidebar({ roleKeys: ["SUPER_ADMIN"], permissions: [] });
    expect(screen.queryByRole("link", { name: /Blog Posts/ })).toBeNull();
    expect(screen.getByText("Blog Posts").closest("[aria-disabled='true']")).toBeTruthy();
  });
});
