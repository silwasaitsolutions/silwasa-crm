import {
  FileText,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Newspaper,
  Search,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Item is hidden unless the user holds this permission. */
  permission?: string;
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface UpcomingItem {
  label: string;
  icon: LucideIcon;
  phase: number;
}

export const NAV_GROUPS: NavGroup[] = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true }] },
  {
    label: "Administration",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, permission: "users:read" },
      { label: "Roles & Permissions", href: "/admin/roles", icon: ShieldCheck, permission: "roles:read" },
    ],
  },
  { label: "Account", items: [{ label: "My account", href: "/admin/account", icon: UserCog }] },
];

/** Shown as disabled placeholders so the roadmap is visible without presenting fake functionality. */
export const UPCOMING: UpcomingItem[] = [
  { label: "Media Library", icon: ImageIcon, phase: 4 },
  { label: "Pages", icon: FileText, phase: 5 },
  { label: "Blog Posts", icon: Newspaper, phase: 7 },
  { label: "Enquiries", icon: Inbox, phase: 9 },
  { label: "SEO", icon: Search, phase: 10 },
  { label: "Settings", icon: Settings, phase: 4 },
];

export function isActive(pathname: string, item: Pick<NavItem, "href" | "exact">): boolean {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
