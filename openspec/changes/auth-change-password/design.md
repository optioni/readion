# Design — auth-change-password

## Context

`authentication` (archived) exposes registration, login, refresh, logout, email verification, and forgot/reset-password, but no authenticated change-password. `web-settings` (archived) ships an Account-tab "Change password" action that triggers `POST /auth/forgot-password` as a contained stopgap. This change adds the real endpoint and rewires the Account tab to it.

## Approach

- **API**: add `POST /api/v1/auth/change-password` to `AuthController`, guarded by the global `JwtAuthGuard`. A `ChangePasswordDto` (class-validator) requires `currentPassword` (non-empty) and `newPassword` (min length 8, matching the registration rule — reuse the existing password-strength validator/constant rather than duplicating the literal). `AuthService.changePassword(userId, dto)`:
  1. Load the user; bcrypt-compare `currentPassword` against `passwordHash`. Mismatch → throw the same unauthorized problem used elsewhere for bad credentials.
  2. Bcrypt-hash `newPassword`, persist via the repository.
  3. Revoke all of the user's refresh tokens in the Redis store, then issue a fresh rotating refresh token for the caller (so the current session survives) — reuse the existing rotation/revocation helpers from login/refresh; do not reimplement.
- **Response**: `204 No Content`, setting the rotated refresh cookie (consistent with how login/refresh transport the refresh token). If the client needs a new access token inline, return it in the body envelope instead — pick whichever matches the existing refresh response shape; document the choice in tasks.
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

## Open questions

- `204` + rotated cookie vs. an envelope returning a fresh access token — resolve against the existing `auth/refresh` response shape during task 1.
- Rate limiting: reuse the auth throttler tier applied to login/reset (default yes).
