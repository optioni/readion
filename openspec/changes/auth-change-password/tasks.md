## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Add a NestJS integration test (Supertest + `@nestjs/testing` + Testcontainers) for `POST /api/v1/auth/change-password` as the outer loop: authenticated user, real Postgres + Redis refresh store.
- [x] 0.2 Write the failing acceptance scenarios: success (hash rotates, other refresh tokens revoked, caller's new token works); wrong current → `401`/`403`; weak new → `422`; unauthenticated → `401`.
- [x] 0.3 Confirm it fails because the route doesn't exist yet (404/handler missing), not a harness error.

## 1. Shared contract

- [x] 1.1 RED: unit test for the `@readion/shared` change-password request schema (requires `currentPassword`; `newPassword` ≥ 8) and its TS type.
- [x] 1.2 GREEN: add the Zod schema + type, reusing the existing password-strength constant/rule.
- [x] 1.3 REFACTOR: ensure the strength rule has a single source of truth shared with registration.

## 2. AuthService.changePassword

- [x] 2.1 RED: unit/integration test for the service — bcrypt-compare current; on match, hash new + persist + revoke all refresh tokens then issue a fresh one for the caller; on mismatch, throw the bad-credentials problem and mutate nothing; assert revoke happens only after a successful hash write.
- [x] 2.2 GREEN: implement `changePassword(userId, dto)` reusing existing bcrypt + refresh rotation/revocation helpers.
- [x] 2.3 REFACTOR: deduplicate against login/refresh token handling.

## 3. Controller route + DTO

- [x] 3.1 RED: integration test asserting the route is `JwtAuthGuard`-protected (no `@Public()`), validates via Zod `parseBody` (`422` on weak/missing `newPassword`/`currentPassword`), and returns the resolved success shape — `200` + `{ accessToken }` envelope + rotated refresh/CSRF cookies (matching `auth/refresh`).
- [x] 3.2 GREEN: add `POST /auth/change-password` validating with the shared `changePasswordRequestSchema` via the existing `parseBody` helper (Zod, matching the other auth routes — no class-validator DTO); set cookies via `setSessionCookies`; apply `@AuthThrottle()`.
- [x] 3.3 REFACTOR: align response/transport with the existing `refresh` endpoint (shared cookie/envelope helpers).

## 4. Codegen + client

- [ ] 4.1 Run `yarn codegen` (api running) and commit the regenerated Orval client containing `authControllerChangePassword`.

## 5. web-settings Account tab rewire

- [ ] 5.1 RED: unit test — Account password section renders current/new/confirm; submit calls `authControllerChangePassword`; `422`→new-password field error, `401`/`403`→current-password field error; success clears form + shows confirmation; no `forgot-password` call.
- [ ] 5.2 GREEN: replace the forgot-password stopgap with the change-password form.
- [ ] 5.3 REFACTOR: clean up form/error state; remove now-dead forgot-password-from-settings copy.

## 6. e2e + close the outer loop

- [ ] 6.1 Update/Add Playwright e2e (`apps/web/e2e/`) for the Settings change-password happy path + wrong-current inline error with the endpoint mocked.
- [ ] 6.2 Make the Section 0 acceptance test green end-to-end.

## 7. Verification gates

- [ ] 7.1 `yarn lint`, `yarn typecheck`, `yarn test` (≥80% coverage), `yarn build` all green; generated client committed.
