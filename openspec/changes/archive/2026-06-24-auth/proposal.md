## Why

Every user-scoped feature in Readion (enrollments, sessions, quizzes, the agent) depends on knowing who is making a request and ensuring they can only touch their own data. The platform primitives (`api-foundation`, `db-foundation`, `mail`) are in place, so the first domain layer the product needs is identity: email/password accounts, proven address ownership, session tokens, and the role + ownership model that every later module guards against.

## What Changes

- Introduce the `User` entity (table + migration) — email, bcrypt password hash, `emailVerified` flag, `role` enum (`user` | `admin`). `auth` owns this table; later changes extend it (the `users` change adds the soft-delete marker and profile/preference columns).
- **Registration & login** — `POST /api/v1/auth/register`, `POST /api/v1/auth/login`. Passwords hashed with bcrypt. The **first user to register is automatically assigned `admin`**.
- **JWT access + refresh tokens** — 15-minute access token, 7-day refresh token stored in Redis. Refresh-token **rotation on every use**.
- **Token transport** — refresh token delivered as an `httpOnly`, `Secure`, `SameSite=Lax` cookie; access token returned in the response body (held in memory by the frontend). Silent refresh via `POST /api/v1/auth/refresh` reading the cookie. State-changing requests carry **CSRF protection** (double-submit token + `SameSite`).
- **Session invalidation** — all of a user's outstanding refresh tokens are revoked on password change, password reset, and (later) account deletion. `POST /api/v1/auth/logout` revokes the current session.
- **Email verification** — a verification link is emailed on registration via the `MailModule`; `emailVerified` flips when the user confirms. Resend endpoint for an unexpired/expired link.
- **Password reset flow** — `POST /api/v1/auth/forgot-password` (always 202, no account enumeration), signed 1-hour token in Redis, link points at a frontend route, `GET /api/v1/auth/reset-password?token=` validates, `POST /api/v1/auth/reset-password` sets the new password and invalidates the token + all refresh tokens.
- **Global `JwtAuthGuard`** applied app-wide with a `@Public()` decorator to opt routes out (register, login, refresh, forgot/reset password, verify, health).
- **`RolesGuard` + `@Roles()` decorator** for admin-only routes.
- **Repository-layer ownership scoping** — a reusable convention/base so user-scoped queries are always filtered by `userId`; cross-user access returns `404`, not `403`. (Establishes the pattern; concrete owned resources arrive in later changes.)
- Strict per-route rate limiting on auth endpoints (10 requests / 15 min per IP), reusing the throttler from `api-foundation`.
- Extend the `apps/api` Zod env schema with the JWT config group (secret, access/refresh expiries) and the public web base URL used to build verification/reset links.

## Capabilities

### New Capabilities
- `authentication`: account identity — register/login/logout, bcrypt hashing, JWT access + Redis-backed rotating refresh tokens, httpOnly cookie transport + CSRF, email verification, password reset, and global `JwtAuthGuard` with a `@Public()` opt-out.
- `authorization`: the `user`/`admin` role model — first-user-admin assignment, `RolesGuard` + `@Roles()` for admin routes, and the repository-layer ownership-scoping convention (scope by `userId`, return `404` on cross-user access).

### Modified Capabilities
<!-- None. The User entity is new (owned by this change); JWT/web-url env keys are additive to the api-foundation env schema and introduced here. -->

## Impact

- **New entity/migration:** `User` in `packages/db` (entity + first domain migration).
- **`apps/api`:** new `AuthModule` (controller, service, JWT strategy, guards, decorators), global guard registration, CSRF middleware, throttler overrides. New env keys (JWT secret + expiries, web base URL) added to the Zod schema.
- **Dependencies consumed:** `MailModule` (`MailService`) for verification + reset emails; Redis (already wired) for refresh-token and reset-token storage; `ResponseInterceptor` / `ExceptionFilter` envelopes from `api-foundation`.
- **`packages/shared`:** auth request/response DTOs and the `Role` enum/constants for cross-app reuse.
- **Downstream unblocked:** `users`, `web-auth`, `admin`, `content-admin` — and the global `JwtAuthGuard` now protects every future module by default.
- **New packages:** `bcrypt`, `@nestjs/jwt`, `@nestjs/passport` + `passport-jwt` (or equivalent), a CSRF helper.
