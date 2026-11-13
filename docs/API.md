# API reference (Phase 2)

Base path `/api/v1`. All responses use `{ success, data, meta: { requestId, pagination? } }`;
errors use `{ success:false, error:{ code, message, details? }, meta }`.

Auth uses cookies: `sw_access` (HttpOnly, 15 min), `sw_refresh` (HttpOnly, 7 days, path `/api/v1/auth`),
and `sw_csrf` (readable). Every `POST/PUT/DELETE` under `/auth` and `/admin` (except login,
forgot-password, reset-password) must send header `x-csrf-token` equal to the `sw_csrf` cookie.

## Auth
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /auth/login | – | `{email,password}`. 10 attempts / 15 min / IP. Account locks 15 min after 5 failures. |
| POST | /auth/refresh | refresh cookie | Rotates the refresh token; the old one stops working. |
| POST | /auth/logout | optional | Revokes the session server-side and clears cookies. |
| POST | /auth/logout-all | yes | Revokes every session of the user. |
| GET | /auth/me | yes | Current user, roles, permissions. |
| POST | /auth/forgot-password | – | Always `202`; never reveals whether the email exists. |
| POST | /auth/reset-password | – | `{token,password}`; one-time, 1 hour; revokes all sessions. |
| POST | /auth/change-password | yes | `{currentPassword,newPassword}`; signs out other sessions. |

## Admin: users and roles (Super Admin by default)
| Method | Path | Permission |
|---|---|---|
| GET | /admin/users?page&pageSize&search | users:read |
| POST | /admin/users | users:create — returns `inviteUrl` when no email provider delivered it |
| GET | /admin/users/:id | users:read |
| PUT | /admin/users/:id | users:update — `{name?,isActive?,roleKeys?}` |
| DELETE | /admin/users/:id | users:delete — soft delete |
| GET | /admin/roles | roles:read |
| GET | /admin/permissions | roles:read |
| PUT | /admin/roles/:id/permissions | roles:manage — `{permissions:[...]}`; SUPER_ADMIN is immutable |

Guards: no self-delete/self-demote/self-deactivate; the last active Super Admin cannot be removed.
