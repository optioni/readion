## Context

`auth` is the first domain layer on top of the platform primitives. `api-foundation` already provides the global `ResponseInterceptor`/`ExceptionFilter` envelopes, `@nestjs/config` + Zod validation, helmet, CORS (`credentials: true` against an explicit origin), and the Redis-backed `@nestjs/throttler`. `db-foundation` provides MikroORM + the migration harness and Testcontainers. `mail` provides a typed `MailService.send(template, to, payload)` with a capturing transport in tests.

This change owns the `User` entity (first domain table + migration) and the `AuthModule`. It establishes the security posture every later module inherits: a global `JwtAuthGuard` with a `@Public()` opt-out, a `RolesGuard` for admin routes, and the repository-layer ownership-scoping convention.

## Goals / Non-Goals

**Goals:**
- Email/password registration + login with bcrypt hashing.
- JWT access tokens (15 min) + Redis-stored refresh tokens (7 day) with rotation-on-use and reuse detection.
- httpOnly/Secure/SameSite=Lax refresh cookie transport; access token in body; CSRF double-submit for cookie-auth state changes.
- Email verification + resend; password reset flow; session revocation on password change/reset.
- First-user-admin assignment; `RolesGuard` + `@Roles()`.
- Reusable repository-layer ownership scoping (scope by `userId`, `404` on cross-user).
- JWT + web-base-URL env keys added to the api Zod schema.

**Non-Goals:**
- Profile read/update, timezone, session-default preferences, soft-delete, account deletion + hard-purge cron — all owned by `users`.
- Frontend login/register/verify/reset pages, silent-refresh client, auth store — owned by `web-auth`.
- Admin user-management endpoints + `AuditLog` — owned by `admin`. (This change only provides the guard/role primitives they build on.)
- OAuth/social login, MFA — out of scope for v1.

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (User table) | real (Testcontainers) | real (Testcontainers) for repo/integration; n/a for pure logic |
| Redis (refresh + reset token store, throttler) | real (Testcontainers) | mocked store for pure token-service logic |
| `MailService` (verification + reset emails) | real module wired with the capturing (non-SMTP) transport; assert captured messages | mocked `MailService` (assert called with template + payload) |
| SMTP2GO | never contacted (capturing transport) | never contacted |
| Clock / token TTL expiry | inject a controllable clock (or fast-forward Redis TTL) to assert expiry | injected clock |
| bcrypt | real (low cost factor in tests) | real |
| Frontend (Playwright e2e) | drives register → verify → login → refresh against the running API | n/a |

## Decisions

- **Refresh token storage: Redis with per-token keys + a per-user index.** Each refresh token is a random opaque id stored under `refresh:{userId}:{tokenId}` with a 7-day TTL; rotation deletes the consumed key and writes a new one. A per-user set enables "revoke all" on password change/reset/logout. Alternative — self-contained JWT refresh tokens — rejected because revocation and rotation-reuse detection require server state anyway.
- **Refresh-token reuse detection.** A presented refresh token that is not in Redis (because it was already rotated) returns `401`. Keeping this simple (no automatic family-wide nuke) is acceptable for v1; password-change/reset already revokes the whole family.
- **CSRF: double-submit cookie.** Issue a non-httpOnly CSRF token cookie alongside the httpOnly refresh cookie; require the matching value in a header on cookie-authenticated state-changing requests. Chosen over synchronizer-token server state to stay stateless and align with the SPA + `SameSite=Lax` model.
- **Access token in body, refresh in cookie.** Matches SPEC token-transport: access token held in memory by the frontend; refresh token never exposed to JS. `/auth/refresh` is the only way to mint a new access token.
- **Verification + reset tokens.** Random opaque tokens stored in Redis with TTLs (verification longer-lived; reset = 1 hour), single-use (deleted on consume). Links are built from the configured web base URL pointing at frontend routes. Chosen over signed-stateless tokens so they can be invalidated/single-used.
- **Global `JwtAuthGuard` + `@Public()`.** Registered as an `APP_GUARD`; `@Public()` sets metadata the guard reads to skip auth. This makes "secure by default" the standard for every future module. `RolesGuard` is a second `APP_GUARD` (or applied per-route) that runs after authentication and reads `@Roles()` metadata.
- **First-user-admin.** Determined at registration by checking whether any user exists; wrapped so a race between two concurrent first-registrations cannot mint two admins (unique-email + transactional check).
- **Ownership scoping as a convention, not concrete resources.** This change ships a reusable scoped-repository helper/base and documents the `404`-on-cross-user rule; the first guarded user-scoped resources land in `user-certifications`/`sessions`. Acceptance coverage uses a representative scoped query.
- **`Role` enum + auth DTOs in `packages/shared`** so `web` and other apps reuse them and Orval types stay consistent.

## Risks / Trade-offs

- **bcrypt cost in tests slows the suite** → use a low cost factor in the test profile; keep production cost in config.
- **Account enumeration via timing/responses** → uniform `401` on login, uniform `202` on forgot-password, identical `404` for missing-vs-unauthorized resources.
- **CSRF + CORS misconfiguration breaks the SPA** → pin CORS to the explicit frontend origin with `credentials: true`; cover the cookie attributes and CSRF reject/accept paths with integration tests.
- **Refresh-token race during rotation (double refresh)** → treat the consumed token as immediately invalid; concurrent reuse returns `401`, the client retries with the surviving token.
- **Migration is the first domain table** → keep the `User` migration minimal and additive so `users` can extend it later without editing a committed migration.

## Open Questions

- Verification-token TTL value (e.g. 24h) and whether an unverified account is allowed to log in or only blocked from protected features — defaulting to: login allowed, verification gating left to consuming features unless the SPEC later requires hard-gating.
- Exact CSRF header name and cookie name — pick conventional defaults (`X-CSRF-Token` / `csrf_token`) unless `web-auth` needs otherwise.
