## Why

The `authentication` capability's **"State-changing requests are CSRF-protected"** requirement (`openspec/specs/authentication/spec.md`) currently mandates a blanket rule: *any* refresh-cookie-bearing, state-changing request lacking a valid CSRF token MUST be rejected with `403`. Read literally, that rule covers `POST /auth/login` and `POST /auth/register` too — and a browser holding a stale `refresh_token` cookie without a matching `csrf_token` cookie would then be permanently locked out: `refresh` 403s (bouncing the user to login) and `login` itself — the one request that reissues a fresh `csrf_token` cookie — also 403s, leaving no recovery path.

The **code no longer behaves that way**. Commit `16e6111` ("fix(auth): exempt login and register from CSRF guard", 2026-07-06) added a `@CsrfExempt()` decorator, applied it to `login` and `register`, and taught `CsrfGuard` to honor it via `Reflector` — session-establishing endpoints authenticate from body credentials, not ambient cookies, so the double-submit check is meaningless there. That fix shipped **with regression tests** (`auth.acceptance.spec.ts`, `csrf.guard.spec.ts`) that are currently green.

So the implementation is correct and covered, but the **spec still describes the old, locked-out behavior**. This change is a spec catch-up: it aligns the written requirement with the already-implemented, already-tested behavior. **No source code changes.**

## What Changes

- **MODIFY** the `authentication` requirement *"State-changing requests are CSRF-protected"* to carve out an explicit exemption for **session-establishing endpoints** (`POST /auth/login`, `POST /auth/register`): they MUST remain reachable and succeed even when a `refresh_token` cookie is present without a matching/valid `csrf_token`. The double-submit rule continues to apply unchanged to cookie-authenticated state changes (`refresh`, `logout`, `change-password`).
- **ADD** an `authentication` requirement *"No permanent login lockout from a stale refresh cookie"* — a recovery guarantee that a lingering or mismatched `refresh_token` cookie can never permanently block a user from logging in or registering.
- Reference the **existing** proving tests (`apps/api/src/auth/auth.acceptance.spec.ts`, `apps/api/src/auth/csrf.guard.spec.ts`) as the coverage for both requirements — no new RED tests are needed because the behavior already passes.

## Capabilities

### Modified Capabilities
- `authentication`: clarify that session-establishing endpoints (`login`, `register`) are CSRF-exempt even when a refresh cookie lingers, and guarantee no permanent login lockout — codifying behavior already implemented by commit `16e6111`.

## Impact

- **Spec only:** `openspec/specs/authentication/spec.md` — one requirement modified, one added. No entity, migration, API, or web changes.
- **No source changes:** the described behavior already lives in `apps/api/src/auth/csrf.guard.ts` (`CsrfExempt` + `isExempt`) and `apps/api/src/auth/auth.controller.ts` (`@CsrfExempt()` on `login`/`register`).
- **Existing coverage cited, not added:** `apps/api/src/auth/auth.acceptance.spec.ts` (login/register with a stale `refresh_token` cookie ⇒ `200`/`201`) and `apps/api/src/auth/csrf.guard.spec.ts` (exempt handler passes with a refresh cookie and no csrf token).
- **Downstream:** none. This removes a latent spec↔code contradiction so future work reads the correct CSRF contract.
