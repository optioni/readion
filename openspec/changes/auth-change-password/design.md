# Design — auth-change-password

## Context

`authentication` (archived) exposes registration, login, refresh, logout, email verification, and forgot/reset-password, but no authenticated change-password. `web-settings` (archived) ships an Account-tab "Change password" action that triggers `POST /auth/forgot-password` as a contained stopgap. This change adds the real endpoint and rewires the Account tab to it.

## Approach

- **API**: add `POST /api/v1/auth/change-password` to `AuthController`, guarded by the global `JwtAuthGuard` (no `@Public()` decorator). Validation follows the established controller pattern: a `changePasswordRequestSchema` Zod schema in `@readion/shared` validated via the controller's existing `parseBody(schema, body)` helper (the codebase uses Zod schemas, not class-validator DTOs — there are no class-validator DTOs or swagger decorators in `auth`). The schema requires `currentPassword` (non-empty) and `newPassword` (the shared min-length-8 password rule reused from `registerRequestSchema`, not a duplicated literal). `AuthService.changePassword(userId, dto)`:
  1. Load the user; bcrypt-compare `currentPassword` against `passwordHash` via `PasswordHashingService.verify`. Mismatch → throw `UnauthorizedException` (the same bad-credentials problem `login` uses).
  2. Bcrypt-hash `newPassword` via `PasswordHashingService.hash`, persist via the EntityManager (`flush`).
  3. Revoke all of the user's refresh tokens with `RefreshTokenStore.revokeAllForUser`, then `issue` a fresh rotating refresh token for the caller (so the current session survives) — reuse the existing helpers (the same ones `resetPassword` and `issueSession` use); do not reimplement.
- **Response**: match the existing `auth/refresh` endpoint — `200` with a `{ accessToken }` envelope and the rotated refresh + CSRF cookies set via the controller's `setSessionCookies` helper. (Resolved: refresh returns `200 { accessToken }` + rotated cookie, so change-password mirrors it rather than `204`.)
- **Shared**: add request schema/types to `@readion/shared` mirroring the DTO.
- **Web**: replace the Account-tab password section's forgot-password action with a current/new/confirm form calling the regenerated `authControllerChangePassword`; map `422`→field error on new password, `401`/`403`→field error on current password.

## Test boundaries

- **Integration (Testcontainers, real Postgres+Redis)**: success rotates hash + revokes other refresh tokens (assert an old refresh token no longer works, the caller's new one does); wrong current → `401`/`403`, hash unchanged; weak new → `422`; missing/!auth → `401`. No DB mocking.
- **Unit**: the strength rule reuse and the compare→hash→revoke ordering (e.g. that revocation only happens after a successful hash write).
- **e2e (Playwright)**: Settings Account tab happy path + wrong-current-password inline error, with `/api/v1/auth/change-password` mocked.
- **Outside-in order**: e2e RED → integration RED → unit RED → implement.

## Decisions

- **Reuse, don't duplicate**: the password-strength rule, bcrypt helpers, and refresh-token rotation/revocation already exist in `auth`; this change wires them, adding only the controller route + service method + DTO.
- **Revoke-others, keep-caller**: matches the capability invariant ("credential-changing operations revoke outstanding sessions") without logging the user out of the device they just used.

## Resolved questions

- Response shape: matches `auth/refresh` → `200` with `{ accessToken }` envelope + rotated refresh/CSRF cookies (not `204`).
- Rate limiting: reuse the `@AuthThrottle()` tier applied to login/register (yes).
- Validation: Zod `parseBody` + a shared `changePasswordRequestSchema`, matching every other `auth` route (no class-validator).
