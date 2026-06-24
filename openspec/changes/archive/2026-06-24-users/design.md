## Context

The `auth` change established the `User` entity (`packages/db`), JWT access/refresh tokens with a Redis refresh-token store, global `JwtAuthGuard` + `RolesGuard`, bcrypt password hashing, and email-uniqueness enforcement. There is currently no way for an authenticated user to read or update their own profile, persist a display timezone or session-default preferences, or delete their account.

This change adds a self-service `UsersModule` to `apps/api`, extends the `users` table via a migration (no new entity — per the Entity Ownership table, `auth` owns `User`; `users` only adds columns), and adds a worker-side hard-purge cron to `apps/worker`. It is a prerequisite for `user-certifications` (per-cert preference overrides inherit profile defaults) and `web-auth` (profile/preferences UI).

## Goals / Non-Goals

**Goals:**
- `GET`/`PATCH /api/v1/users/me` for self profile read/update (display timezone + the five session-default preferences), scoped implicitly to the authenticated principal.
- Two-stage account deletion: immediate soft delete (revoke refresh tokens, release email, block auth, last-admin guard, password re-confirm) + worker hard-purge cron cascading to all user-scoped records after the grace window.
- Extend the `users` table and adjust the email-uniqueness constraint so a released email is re-registerable while the soft-deleted row is retained for the grace window.
- Add validated config: `LIFECYCLE_DELETION_GRACE_DAYS` (default 14), `DEFAULT_DISPLAY_TIMEZONE` (default `Europe/Helsinki`).

**Non-Goals:**
- Any frontend/UI (belongs to `web-auth`).
- Admin-initiated deletion of other users and the `AdminModule` user list (belongs to `admin`); only the shared last-admin guard is introduced here as a reusable rule.
- Consuming the session defaults to actually plan a session (belongs to `sessions`/`user-certifications`).
- Changing authentication/authorization spec requirements — those specs are unmodified.

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (`users` + cascade tables) | real (Testcontainers) | real (Testcontainers) for entity/repo; n/a for pure logic |
| Redis refresh-token store (`auth`) | real (Testcontainers) | mocked at the store interface for service-level logic |
| API HTTP layer | real (Supertest + `@nestjs/testing`) | n/a |
| Worker scheduler (`@nestjs/schedule`) | cron method invoked directly (not waiting on timer) against real test DB | pure window/eligibility logic unit-tested |
| Playwright e2e | drives real API; mailbox/login via existing auth flows | n/a |
| Clock / grace-window boundary | injectable clock or seeded `deletedAt` timestamps in test DB | injected fixed clock |

## Decisions

- **No new entity; extend `users` via migration.** The Entity Ownership table assigns `User` to `auth`; `users` adds `display_timezone`, session-default-pref columns, and `deleted_at`. Alternative (a separate `UserProfile` table) was rejected — it adds a join for fields that are 1:1 with the user and complicates the cascade purge.
- **Email release via soft-delete-aware unique index.** Replace the plain unique constraint on `email` with a partial unique index `WHERE deleted_at IS NULL`, so the soft-deleted row keeps its real email (needed for support-assisted recovery and audit) while a new active registration of the same address is allowed. Alternative (mangling the deleted row's email, e.g. appending the id) was rejected as lossy and harder to recover/audit. The `auth` registration lookup must already scope to active users; if it does not, this change tightens it.
- **Session defaults stored as typed columns/JSON with shared option sets.** The five parameters and their allowed values live in `packages/shared` constants reused by the DTO validators and the entity, keeping the cache-relevant option sets single-sourced. Validation uses `class-validator` enums; timezone validated against the IANA set (`Intl.supportedValuesOf('timeZone')`).
- **Deletion reuses the auth refresh-token store.** The `UsersService` depends on the auth-exposed revoke-all-for-user capability rather than reaching into Redis directly, keeping token semantics owned by `auth`.
- **Hard purge is a single transactional cascade in the worker.** The cron selects users with `deleted_at < now - grace`, then deletes user-scoped rows in FK-safe order (children first) within one transaction per user; `AuditLog` rows are updated (identifier-stripped), not deleted. `ContentChunk` is never touched. DB-level `ON DELETE CASCADE` is a fallback, but the explicit ordered delete keeps the audit-strip step and the `ContentChunk` exclusion unambiguous and testable. Note several cascade tables (`StudySession`, `MockExam`, `ReviewItem`, `AgentConversation`, …) are owned by later changes and may not exist yet — the purge cascade is written defensively to delete from whichever user-scoped tables exist, and is extended as those changes land.
- **Last-admin guard as a shared rule.** Implemented as a query (`count active admins`) invoked before soft delete; surfaced as `409`. Lives where deletion happens now (`users`) and is reused by `admin` later.

## Risks / Trade-offs

- **Cascade tables don't all exist yet** → Write the purge against the set of user-scoped tables present at implementation time; gate each delete on table existence / entity registration, and add a checklist item so later changes (`sessions`, `mock-exam`, `review-srs`, `agent`, `user-certifications`) wire their tables into the cascade. Integration test asserts cascade for the tables that exist now (`UserCertification` once `user-certifications` lands; until then only `User` + auth-owned rows) and that `ContentChunk` is untouched.
- **Partial unique index + ORM** → MikroORM must emit a partial unique index, not a column-level unique; verify the generated migration SQL and assert re-registration works in an integration test.
- **Race: login during the soft-delete transaction** → Soft delete revokes refresh tokens and sets `deleted_at` atomically; auth guards/login already reject users with `deleted_at` set (auth lookup scoped to active). Add an integration test for post-delete login `401`.
- **Grace-window clock skew / test flakiness** → Use seeded `deleted_at` timestamps and an injectable clock rather than real sleeps so the boundary is deterministic.

## Open Questions

- Does the existing `auth` registration/login query already filter `deleted_at IS NULL`, or must this change add that filter? (Resolve by reading the auth `UsersRepository`/login service during task 1.)
- Should `AuditLog` identifier-stripping null the `userId` FK or move to a retained denormalized `actorEmailHash`? Deferred to when `admin` introduces `AuditLog`; until then the purge has no `AuditLog` rows to strip and the scenario is covered by a forward-looking task.
