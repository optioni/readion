## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the e2e/integration harness per design Test Boundaries: Testcontainers Postgres + Redis, `MailModule` wired with the capturing (non-SMTP) transport, low bcrypt cost, controllable clock/TTL helper
- [x] 0.2 Write failing Playwright e2e (`apps/web/e2e`) for the happy path: register → receive verification email (captured) → verify-email → login → access a protected route → silent refresh → logout invalidates the refresh token
- [x] 0.3 Write the failing NestJS integration (Supertest) acceptance test covering the same flow at the API boundary
- [x] 0.4 Confirm both fail for the right reason (no `AuthModule`/routes yet), not a harness/setup error

## 1. Shared contracts (`packages/shared`)

- [x] 1.1 RED: Unit-test the `Role` enum/constants and auth request/response DTO shapes (register/login/refresh/forgot/reset payloads, sanitized user response with no password field)
- [x] 1.2 GREEN: Add `Role` enum and auth DTOs to `packages/shared`
- [x] 1.3 REFACTOR: De-duplicate against existing shared envelope/problem-details types

## 2. Env schema (JWT + web base URL)

- [x] 2.1 RED: Unit-test the api Zod schema — fails fast naming the missing JWT secret; fails on malformed web base URL; exposes typed access/refresh expiries
- [x] 2.2 GREEN: Extend the `apps/api` Zod env schema with the JWT config group + public web base URL; update `.env.example`
- [x] 2.3 REFACTOR: Group the new keys cleanly alongside existing config groups

## 3. User entity + migration (`packages/db`)

- [x] 3.1 RED: Integration-test (Testcontainers) that the `User` table persists email (unique, case-insensitive), `passwordHash`, `emailVerified` default `false`, and `role` enum default `user`
- [x] 3.2 GREEN: Add the `User` MikroORM entity and the first domain migration (minimal/additive so `users` can extend it later)
- [x] 3.3 REFACTOR: Confirm base-entity conventions (id/timestamps) from `db-foundation` are reused

## 4. Password hashing service

- [x] 4.1 RED: Unit-test bcrypt hash/verify — never stores plaintext, verifies a correct password, rejects a wrong one
- [x] 4.2 GREEN: Implement the password-hashing service reading cost from config
- [x] 4.3 REFACTOR: Clean up

## 5. Token services (access JWT + refresh + verification + reset)

- [x] 5.1 RED: Unit-test access-token issue/verify (15-min expiry, `sub`+`role` claims, rejects expired/malformed)
- [x] 5.2 GREEN: Implement the access-token service over `@nestjs/jwt`
- [x] 5.3 RED: Unit-test the Redis refresh-token store — issue, rotate-on-use (consumed token rejected), replay rejected, unknown rejected, revoke-all-for-user
- [x] 5.4 GREEN: Implement the refresh-token store (per-token key + per-user index, 7-day TTL)
- [x] 5.5 RED: Unit-test single-use verification and 1-hour reset tokens in Redis (issue, validate, consume, expire)
- [x] 5.6 GREEN: Implement verification + reset token services
- [x] 5.7 REFACTOR: Extract shared Redis key/TTL helpers

## 6. Guards, decorators, CSRF

- [x] 6.1 RED: Unit-test `JwtAuthGuard` — rejects unauthenticated `401`, allows valid token, honors `@Public()` metadata; `RolesGuard` — `403` for `user` on `@Roles('admin')`, allows `admin`, `401` before role when unauthenticated
- [x] 6.2 GREEN: Implement `JwtAuthGuard` (as `APP_GUARD`), `@Public()`, `RolesGuard`, `@Roles()`, and a current-user decorator
- [x] 6.3 RED: Unit/integration-test the CSRF double-submit guard — `403` when token missing on cookie-auth state change, passes when matching
- [x] 6.4 GREEN: Implement CSRF double-submit middleware/guard + token cookie issuance
- [x] 6.5 REFACTOR: Clean up metadata keys and guard ordering

## 7. Repository-layer ownership scoping convention

- [x] 7.1 RED: Integration-test a representative scoped query — owner reads own row; cross-user access returns `404` (identical to not-found); filter happens in a single `userId`-scoped query
- [x] 7.2 GREEN: Implement the reusable scoped-repository helper/base + documented `404`-on-cross-user rule
- [x] 7.3 REFACTOR: Ensure it composes with MikroORM repositories without fetch-then-check

## 8. AuthService + AuthController (wiring the flows)

- [x] 8.1 RED: Integration-test register — `201`, sanitized user, access token in body + refresh httpOnly cookie, verification email captured, weak password `422`, duplicate email `409`
- [x] 8.2 RED: Integration-test first-user-admin — first registration `admin`, second `user`
- [x] 8.3 RED: Integration-test login — `200` on correct creds, uniform `401` on wrong password vs unknown email
- [x] 8.4 RED: Integration-test refresh/logout — rotation issues new pair, replayed token `401`, logout clears cookie + invalidates token
- [x] 8.5 RED: Integration-test verify-email + resend — flag flips, token single-use, resend for verified is a no-op success
- [x] 8.6 RED: Integration-test password reset — `forgot-password` always `202` (no enumeration, email only when account exists), `GET reset-password` validates token, `POST reset-password` updates hash + revokes all refresh tokens + invalidates reset token; password change revokes sessions
- [x] 8.7 RED: Integration-test cookie attributes (HttpOnly/Secure/SameSite=Lax) and that no body field carries the refresh token
- [x] 8.8 GREEN: Implement `AuthService` + `AuthController` for all endpoints; register `AuthModule` and the global guards
- [x] 8.9 REFACTOR: Collapse duplication, ensure all responses use the global envelope/problem-details

## 9. Rate limiting on auth endpoints

- [x] 9.1 RED: Integration-test the strict throttle — 11th request to `/auth/login` within 15 min returns `429`
- [x] 9.2 GREEN: Apply the 10-req/15-min per-IP throttler override to `/auth/login` and `/auth/register`
- [x] 9.3 REFACTOR: Clean up throttler config

## 10. Acceptance Test — Outer Loop GREEN

- [x] 10.1 Confirm the e2e and integration acceptance tests pass end-to-end
- [x] 10.2 Verify `apps/api` (and `apps/web` for the e2e) boot in the local environment with the new env keys — no startup/config errors
- [x] 10.3 REFACTOR: Clean up test setup, fixtures, and the capturing-transport assertions

## 11. Change Review — Subagent Verification

- [x] 11.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md plus the diff and this task list (reviewer reports findings only, does not edit code)
- [x] 11.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 12. Polish

- [x] 12.1 Run linter and fix all errors (`yarn lint`)
- [x] 12.2 Run formatter and apply fixes (`yarn format`)
- [x] 12.3 Run type checker with zero errors (`yarn workspace apps/api typecheck` and shared/db)
- [x] 12.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
