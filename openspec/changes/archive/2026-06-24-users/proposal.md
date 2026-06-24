## Why

Authenticated users have an account but no way to manage who they are or how the app behaves for them: there is no profile read/update, no display timezone, no saved session-default preferences to drive adaptive sessions, and no self-serve account deletion. PRD FR22 (account lifecycle & data ownership) requires that users can delete their own account with immediate access revocation, email release, and a hard purge of all personal data after a grace window — a legal/trust prerequisite for a multi-user product.

## What Changes

- Add a `UsersModule` to `apps/api` exposing the authenticated user's own profile:
  - `GET /api/v1/users/me` — read the current user's profile (id, email, role, `emailVerified`, display timezone, session default preferences).
  - `PATCH /api/v1/users/me` — update display timezone and session default preferences (duration, content mix, difficulty, focus area, learning style). Email and role are not editable here.
- Persist a **display timezone** on the user (default `Europe/Helsinki`; all timestamps remain stored in UTC) and validate it as a valid IANA zone.
- Persist **session default preferences** on the user profile (the five Session Personalization parameters), validated against their allowed option sets, used later as the defaults for new study sessions.
- Add **self-serve account deletion** `DELETE /api/v1/users/me` with password re-confirmation:
  - **Soft delete (immediate):** mark the account deleted, revoke all refresh tokens, and release the email for re-registration; the user can no longer authenticate. Configurable grace window (default 14 days).
  - Block deletion of the **last remaining admin**.
- Extend the existing `User` entity (owned by `auth`) via a new migration in `packages/db`: soft-delete marker (`deletedAt`), display timezone, and session-default-preference columns; adjust the email-uniqueness constraint so a released email can be re-registered while the soft-deleted row is retained for the grace window.
- Add a **worker-side hard-purge cron** (`apps/worker`) that permanently removes accounts whose grace window has elapsed, cascading to all user-scoped records (`UserCertification`, `StudySession`, `SessionItem`, `QuizResponse`, `MockExam`, `WeakArea`, `ReviewItem`, `AgentConversation`, `AgentMessage`); shared `ContentChunk`s are untouched and `AuditLog` entries are retained but stripped of direct identifiers.
- Add a `LIFECYCLE_DELETION_GRACE_DAYS` (default 14) config value and a `DEFAULT_DISPLAY_TIMEZONE` (default `Europe/Helsinki`) config value to the validated env schemas.

## Capabilities

### New Capabilities
- `user-profile`: Authenticated self-service read/update of profile data — display timezone (default `Europe/Helsinki`, UTC storage) and the five session-default preferences (duration, content mix, difficulty, focus area, learning style) — exposed via `GET`/`PATCH /api/v1/users/me`.
- `account-deletion`: Two-stage self-serve account deletion — immediate soft delete (revoke refresh tokens, release email, block auth, last-admin guard, password re-confirmation) plus a worker-side hard-purge cron that cascades to all user-scoped records after the configurable grace window.

### Modified Capabilities
<!-- None: this change extends the auth-owned User entity but does not alter the authentication/authorization spec requirements. -->

## Impact

- **apps/api:** new `UsersModule` (controller, service, DTOs) under the global `JwtAuthGuard`; ownership is implicitly `self` (the authenticated principal). Reuses the auth refresh-token store to revoke tokens on deletion.
- **apps/worker:** new scheduled processor for account hard-purge (`@nestjs/schedule`), cascading deletes within a transaction.
- **packages/db:** new migration extending the `users` table (`deletedAt`, `displayTimezone`, session-default-pref columns) and revising the email-uniqueness constraint to a partial/soft-delete-aware unique index; no new entity (FR per Entity Ownership: `users` owns no table, extends `User`).
- **packages/shared:** DTO/types and constants for session-default-preference option sets and the update payload; new env-schema keys (`LIFECYCLE_DELETION_GRACE_DAYS`, `DEFAULT_DISPLAY_TIMEZONE`).
- **apps/web:** new endpoints surface in the Orval-generated client (consumed later by `web-auth`/dashboard); no UI in this change.
- **Depends on:** `auth` (User entity, refresh-token store, global guards, password verification).
