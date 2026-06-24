## Context

`Certification` (with a `state` of `draft`/`live`) and `User` (with profile session defaults) already exist as archived changes. There is no entity joining the two, so a user cannot enroll in a cert and no downstream study feature has a per-user, per-cert anchor. This change owns the `UserCertification` join entity and the `UserCertificationsModule` that operates on it.

Constraints from SPEC.md / CLAUDE.md:
- Ownership is enforced at the **repository layer** — every query is scoped on `userId`. Cross-user access returns `404`, never `403` (SPEC "Authentication and Authorisation"). No fetch-then-check.
- Standard JSON:API-inspired envelope: single resource `{ data, relationships }`, collection `{ data[], meta }`. Global `ResponseInterceptor` wraps success; global `ExceptionFilter` formats RFC 7807 errors.
- MikroORM entity-definition style is the `defineEntity`/`p.` builder with a `[OptionalProps]` class, matching `certification.entity.ts` and `user.entity.ts`.
- Per-cert session preference override fields mirror the existing user-profile session-default shape (`sessionDefaultsSchema` in `packages/shared/src/users`).

## Goals / Non-Goals

**Goals:**
- Own the `UserCertification` entity + its migration (ManyToOne → `User`, ManyToOne → `Certification`, unique on the pair).
- Enroll (live-cert only, restore-on-re-enroll, reject duplicate active), list (by status), detail, update per-cert overrides, archive/restore — all authenticated and ownership-scoped.
- Publish `enrollment` DTOs/schemas in `packages/shared` and regenerate the Orval client.

**Non-Goals:**
- No readiness, weak-area, or session columns/relations on `UserCertification` — those are added by their owning downstream changes (`readiness`, `weak-areas`, `sessions`); this change only creates the join row they will reference.
- No onboarding/dashboard enrollment UI (`web-onboarding`, `web-dashboard`).
- No diagnostic-exam offer at enrollment (`diagnostic` change owns that flow).
- No worker cron — account hard-purge cascade to `UserCertification` is owned by `users`.

## Test Boundaries

Per outside-in TDD: a Playwright e2e drives the enrollment flow against the running app, NestJS integration tests (Supertest + `@nestjs/testing` + Testcontainers) cover the endpoints against real Postgres, and unit tests cover the pure restore-vs-create / override-merge logic. The database is never mocked.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (`UserCertification`, `Certification`, `User` tables) | real (Testcontainers) | real (Testcontainers) for service tests; not used for pure-logic unit tests |
| Auth / `JwtAuthGuard` (current user) | real guard, real issued JWT for the test user | n/a (service called with a `userId`) |
| `Certification` records (live vs draft) | real rows seeded in the test DB | real rows / fixtures |
| `ResponseInterceptor` + `ExceptionFilter` | real (full Nest app) | n/a |
| Redis | not exercised by this module | not exercised |

## Decisions

- **Enroll is idempotent against archived rows, conflicting against active rows.** Because `(user, certification)` is unique, the service first looks up an existing enrollment for the pair (scoped to the current user). None → create `active`. Exists and `archived` → flip to `active` (restore), preserving `enrolledAt`. Exists and `active` → `409 Conflict`. *Alternative considered:* a dedicated `/restore` being the only path back from archived, and enroll always 409-ing on any existing row. Rejected because the SPEC frames each cert as mapping to one enrollment and the dashboard "+ Add certification" should transparently bring an archived cert back without the user needing to find it in an archived list.
- **Live-only enrollment is checked in the service, returning 404 for draft/missing.** A draft cert is intentionally indistinguishable from a non-existent one to a regular user (drafts are admin-only, per `certifications`), so both map to `404` rather than `403`/`422`. *Alternative:* `422 Unprocessable` for draft. Rejected to avoid leaking draft-cert existence.
- **Overrides stored as nullable columns mirroring the user session-default fields**, not a single JSON blob. Keeps them individually validatable/queryable and lets a null mean "fall back to the user profile default", consistent with how `User` stores its own defaults as discrete columns. *Alternative:* one `json` column `overrides`. Rejected — discrete nullable columns match the existing `user.entity.ts` shape and make "clear this one override" a simple null set.
- **Ownership scoping via `em.findOne(UserCertification, { id, user: userId })`.** Single scoped query; a non-owner or missing id both yield `null` → `NotFoundException` → `404`. No separate authorization check. Matches the SPEC's repository-layer ownership rule.
- **Module placement:** `apps/api/src/user-certifications/` (controller, service, mapper, module), registered in `AppModule`, sitting behind the already-global `JwtAuthGuard` (no `@Public()`). Shared types in `packages/shared/src/user-certifications` (or extend `enrollment` schemas), reusing `sessionDefaultsSchema.partial()` for overrides.

## Risks / Trade-offs

- **Restore-on-re-enroll could surprise a caller expecting a hard 409 for any existing pair** → spec'd explicitly: archived → restore (201), active → 409. Documented in the `enrollment` spec scenarios so the contract is unambiguous and tested.
- **Unique constraint races** (two concurrent enroll requests for the same new pair) → rely on the DB unique constraint on `(user, certification)`; the second insert fails and is translated to `409`. The find-then-create window is closed by the constraint, not by app-level locking.
- **Override fallback semantics live in two places** (null column here, default on `User`) → resolution of effective session config is deferred to the `sessions` change; this change only stores/returns the raw overrides, so there is no duplicated merge logic yet.

## Open Questions

- Should the enrollment detail/list responses expose the **effective** session config (overrides merged over user defaults) or only the raw overrides? Deferring to raw overrides for now; the `sessions`/`web-dashboard` changes can compute the effective view when they need it. Revisit if `web-dashboard` needs the merged value directly.
