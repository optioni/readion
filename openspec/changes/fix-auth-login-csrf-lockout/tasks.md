> This is a **spec catch-up** change: the behavior is already implemented (commit `16e6111`) and
> already covered by passing tests. The outside-in section headers are kept for consistency, but
> the tests are **already GREEN** — tasks verify and codify existing behavior rather than drive new
> RED → GREEN work. No source code is modified.

## 0. Acceptance Test — Already GREEN (verification, not RED)

- [x] 0.1 Confirm the existing acceptance test proves the exemption at the controller pipeline level: `apps/api/src/auth/auth.acceptance.spec.ts` — "lets a user log in and register when a stale refresh_token cookie without a matching csrf token lingers" (`POST /auth/login` with `Cookie: refresh_token=staleleftover` ⇒ `200` + refresh cookie reissued; `POST /auth/register` with the same cookie ⇒ `201`)
- [x] 0.2 Confirm the existing guard unit test proves the exempt path AND the retained double-submit behavior: `apps/api/src/auth/csrf.guard.spec.ts` — "allows exempt handlers even when a refresh cookie is present without a csrf token" (exemption), "rejects cookie-authenticated state changes without a matching double-submit token" (covers the "Missing CSRF token is rejected" scenario) and the matching-token pass case (covers the "Matching CSRF token is accepted" scenario)
- [x] 0.3 Run `yarn workspace apps/api test src/auth` and confirm both tests pass (evidence they are already GREEN — no new RED test is required)

## 1. Codify the CSRF exemption for session-establishing endpoints

- [x] 1.1 VERIFY: read `apps/api/src/auth/csrf.guard.ts` and `auth.controller.ts` — confirm `@CsrfExempt()` is applied to `login` and `register`, `CsrfGuard.isExempt()` reads the metadata via `Reflector`, and the guard returns `true` for an exempt handler regardless of the refresh cookie (mark tests from §0 as the coverage)
- [x] 1.2 SPEC: MODIFY the `authentication` requirement "State-changing requests are CSRF-protected" in `specs/authentication/spec.md` to carve out the session-establishing-endpoint (`login`, `register`) exemption while leaving the double-submit rule intact for `refresh`/`logout`/`change-password`; add scenarios for login/register succeeding with a stale/absent/mismatched csrf cookie
- [x] 1.3 CONFIRM: the modified requirement's scenarios match the assertions already made by the tests referenced in §0 (spec ↔ code alignment; no test edits)

## 2. Codify the no-permanent-lockout recovery guarantee

- [x] 2.1 SPEC: ADD the `authentication` requirement "No permanent login lockout from a stale refresh cookie" in `specs/authentication/spec.md`, guaranteeing a lingering/mismatched `refresh_token` cookie can never permanently block login or registration, and that a successful login/register reissues a fresh `csrf_token` cookie (recovery path)
- [x] 2.2 CONFIRM: the guarantee is already satisfied by the exemption in §1 plus `AuthController.setSessionCookies` (reissues both refresh and csrf cookies on login/register); reference the §0 tests as coverage

## 3. Validate the change

- [x] 3.1 Run `openspec validate fix-auth-login-csrf-lockout` and fix any structural errors
- [x] 3.2 Confirm no source files or existing specs outside this change directory were modified (spec-catch-up scope only)
