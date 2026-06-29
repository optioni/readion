## Why

Signed-in learners cannot change their password from the app. The `authentication` capability exposes register, login, refresh, logout, email verification, and forgot/reset-password — but **no authenticated change-password**. The archived `web-settings` Account tab works around this by triggering `POST /api/v1/auth/forgot-password` for the signed-in user ("we'll email you a secure reset link"), a documented stopgap that forces an email round-trip for a routine action. An in-session change-password is a baseline account-security expectation and removes that friction.

(Surfaced as a flagged follow-up in `web-settings` — Impact → "No dedicated change-password endpoint exists".)

## What Changes

- New authenticated `POST /api/v1/auth/change-password` accepting `currentPassword` and `newPassword`.
  - Verifies `currentPassword` against the stored bcrypt hash; mismatch → `401`/`403` RFC 7807.
  - Enforces the **same ≥8-char strength rule** as registration; violation → `422` with an `errors[]` entry for `newPassword`.
  - Re-hashes (bcrypt) and persists; the plaintext is never logged or returned.
- Per the spec invariant that "all credential-changing operations revoke outstanding sessions", on success **revoke all other refresh tokens** for the user and rotate the caller's. Return `204` (or an envelope with the rotated token).
- Rate-limited consistently with the other auth credential routes.
- Frontend: the `web-settings` Account tab replaces the forgot-password stopgap with a real change-password form (current / new / confirm).

## Capabilities

### Modified Capabilities
- `authentication`: add an authenticated change-password operation that verifies the current password, applies the registration password-strength rule, and revokes other sessions.
- `web-settings`: the Account tab drives the new endpoint instead of the forgot-password email flow.

## Impact

- **Code**: `apps/api/src/auth/` (controller route, service method, request DTO), `packages/shared` (request/response Zod schema + types), `apps/web/app/pages/settings/` (Account tab change-password form). New NestJS integration tests (Supertest + Testcontainers) for verify/strength/rotation; unit tests for the password-verify + session-revocation path; Playwright e2e for the Settings flow.
- **API**: new `POST /api/v1/auth/change-password` → run `yarn codegen` and commit the regenerated Orval client.
- **No new entity/migration**: reuses `User.passwordHash` and the existing Redis refresh-token store.
- **Dependencies**: archived `authentication`, `web-settings`. No new runtime dependencies.
