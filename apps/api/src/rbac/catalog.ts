/**
 * Single source of truth for permissions and the default role -> permission mapping.
 * The seed script upserts these; request handlers only ever check permission keys.
 */
export const PERMISSIONS = {
  users: ["users:read", "users:create", "users:update", "users:delete", "roles:read", "roles:manage"],
  pages: ["pages:read", "pages:create", "pages:update", "pages:delete", "pages:publish"],
  navigation: ["navigation:manage"],
  blog: ["blog:read", "blog:create", "blog:update", "blog:delete", "blog:publish", "blog-taxonomy:manage"],
  services: ["services:manage"],
  pricing: ["pricing:manage"],
  industries: ["industries:manage"],
  portfolio: ["portfolio:manage"],
  testimonials: ["testimonials:manage"],
  media: ["media:read", "media:upload", "media:update", "media:delete"],
  enquiries: ["enquiries:read", "enquiries:update", "enquiries:export"],
  newsletter: ["newsletter:manage"],
  seo: ["seo:manage", "redirects:manage"],
  email: ["email-settings:manage"],
  theme: ["theme:manage"],
  settings: ["settings:read", "settings:manage"],
  activity: ["activity:read"],
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS][number];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS).flat() as PermissionKey[];

export const SYSTEM_ROLES = ["SUPER_ADMIN", "ADMIN", "EDITOR", "SEO_MANAGER"] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLES)[number];

const USER_AND_ROLE_ADMIN: PermissionKey[] = [...PERMISSIONS.users];
const SECURITY_ONLY: PermissionKey[] = ["email-settings:manage", "activity:read"];

export const ROLE_DEFINITIONS: Record<
  SystemRoleKey,
  { name: string; description: string; permissions: PermissionKey[] }
> = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Full access, including users, roles and global configuration.",
    permissions: ALL_PERMISSIONS,
  },
  ADMIN: {
    name: "Admin",
    description: "Manages website content, enquiries, media and most settings.",
    permissions: ALL_PERMISSIONS.filter(
      (p) => !USER_AND_ROLE_ADMIN.includes(p) && !SECURITY_ONLY.includes(p),
    ).concat(["activity:read"]),
  },
  EDITOR: {
    name: "Editor",
    description: "Creates and edits pages and blog content. No user or security access.",
    permissions: [
      "pages:read", "pages:create", "pages:update",
      "blog:read", "blog:create", "blog:update", "blog-taxonomy:manage",
      "media:read", "media:upload", "media:update",
    ],
  },
  SEO_MANAGER: {
    name: "SEO Manager",
    description: "Manages SEO metadata, redirects and content SEO.",
    permissions: [
      "pages:read", "pages:update", "blog:read", "blog:update",
      "seo:manage", "redirects:manage", "media:read",
    ],
  },
};

/** SUPER_ADMIN passes every permission check even if a new permission was never assigned to it. */
export function roleHasAll(roleKeys: string[]): boolean {
  return roleKeys.includes("SUPER_ADMIN");
}
