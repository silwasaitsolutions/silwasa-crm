import { titleCase } from "./permissions";

export interface Crumb {
  label: string;
  href?: string;
}

const LABELS: Record<string, string> = {
  admin: "Dashboard",
  users: "Users",
  roles: "Roles & Permissions",
  account: "My account",
};

/** Builds breadcrumbs from an /admin/... pathname. The last crumb has no link. */
export function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("?")[0]!.split("/").filter(Boolean);
  if (segments[0] !== "admin") return [];
  const crumbs: Crumb[] = [];
  let href = "";
  segments.forEach((segment, i) => {
    href += `/${segment}`;
    crumbs.push({ label: LABELS[segment] ?? titleCase(segment), href: i === segments.length - 1 ? undefined : href });
  });
  return crumbs;
}
