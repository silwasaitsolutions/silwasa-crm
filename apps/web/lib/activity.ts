import type { ActivityEntry } from "@silwasa/shared";

const VERBS: Record<string, string> = {
  "auth.login": "signed in",
  "auth.logout": "signed out",
  "auth.logout_all": "signed out of all devices",
  "auth.login_failed": "had a failed sign-in attempt",
  "auth.account_locked": "was locked after failed sign-ins",
  "auth.login_blocked": "was blocked while locked",
  "auth.password_changed": "changed their password",
  "auth.password_reset": "reset their password",
  "auth.password_reset_requested": "requested a password reset",
  "user.create": "created a user",
  "user.update": "updated a user",
  "user.delete": "deleted a user",
  "user.restore": "restored a user",
  "user.bootstrap_super_admin": "was created as the first Super Admin",
  "role.create": "created a role",
  "role.update": "updated a role",
  "role.delete": "deleted a role",
  "role.update_permissions": "changed role permissions",
};

export function describeActivity(entry: Pick<ActivityEntry, "action" | "actor">): string {
  const who = entry.actor?.name ?? "Someone";
  const verb = VERBS[entry.action] ?? entry.action.replace(/[._]/g, " ");
  return `${who} ${verb}`;
}
