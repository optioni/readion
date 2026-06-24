## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Ensure `apps/api` (+ Postgres/Redis via docker-compose/Testcontainers) is runnable for e2e, then run `yarn codegen` against the running API so `apps/web/src/api` includes the `auth` and `users` endpoints; commit the regenerated client
- [x] 0.2 Set up the Playwright e2e harness in `apps/web/e2e/` against the real Nuxt app + real API (per design.md Test Boundaries); add a helper to capture the verification/reset `token` the API issues
- [x] 0.3 Write failing acceptance test `auth-flow.e2e.ts` covering PRD §5 J1: register → verify email via captured token → land authenticated → reach a protected route without redirect → reload (hard refresh) still authenticated → logout returns to `/login`
- [x] 0.4 Confirm it fails for the right reason (pages/store/middleware missing — not a harness/config error)

## 1. Auth store (Pinia)

- [x] 1.1 RED: Unit-test the auth store — access token held in reactive state and never written to `localStorage`/`sessionStorage`; `isAuthenticated` reflects token presence; `setSession`/`clear`/user hydration behavior
- [x] 1.2 GREEN: Implement `stores/auth.ts` (in-memory token, current user, `login`/`register`/`logout`/`refresh` actions, `isAuthenticated` getter, a `ready` promise the bootstrap resolves)
- [x] 1.3 REFACTOR: Clean up store typing against the generated client/user DTO

## 2. Fetch mutator extension (api-client MODIFIED)

- [x] 2.1 RED: Unit-test the mutator with a mocked fetch — attaches `Authorization: Bearer` when the store has a token and omits it otherwise; echoes `csrf_token` cookie into `x-csrf-token` on POST/PUT/PATCH/DELETE but not GET; still sends `credentials: 'include'` and the configured base URL
- [x] 2.2 RED: Unit-test the `401` path — single silent refresh via `/auth/refresh`, retry original request exactly once on success; on refresh failure clear the store and surface the typed `401` without re-looping; concurrent `401`s share one in-flight refresh
- [x] 2.3 GREEN: Extend the `web-foundation` mutator to inject the bearer token + CSRF header and implement the single refresh-and-retry with a shared in-flight refresh promise
- [x] 2.4 REFACTOR: Centralize CSRF cookie/header name constants (`csrf_token` / `x-csrf-token`) and de-duplicate header logic

## 3. Silent-refresh bootstrap

- [x] 3.1 RED: Unit-test the bootstrap — on load calls `/auth/refresh`; on success stores the new access token and hydrates the user from `/users/me`; on `401` leaves the store unauthenticated; resolves the store `ready` promise either way; runs client-side only
- [x] 3.2 GREEN: Implement the client-only bootstrap (plugin/app hook) wiring `/auth/refresh` → token → `/users/me`
- [x] 3.3 REFACTOR: Ensure the bootstrap runs once and route decisions await `ready`

## 4. Route middleware

- [x] 4.1 RED: Unit-test global middleware with stubbed route + store — unauthenticated → protected route redirects to `/login` preserving the intended path; authenticated → `/login` redirects to home; public auth/verify/reset routes always allowed; decision awaits the bootstrap `ready` promise
- [x] 4.2 GREEN: Implement global route middleware with an explicit public-route allowlist
- [x] 4.3 REFACTOR: Extract the public-route list and post-login redirect helper

## 5. Shared auth layout

- [x] 5.1 GREEN: Build the split-panel `layouts/auth.vue` (brand panel + form panel) to match `design/login-flow.html`, using the wired Readion tokens; reusable across all auth pages

## 6. Login & register pages

- [x] 6.1 RED: Component-test `/login` — success stores token, hydrates user, navigates to intended destination; `401` shows the **uniform** error banner only ("Incorrect email or password.") and stays put (no per-field "no account found" — see design.md reconciliation)
- [x] 6.2 RED: Component-test `/register` — 8+ char password rule enforced before submit; success signs in and routes onward; `422` renders field-level problem-details errors; duplicate email shows "email already registered"
- [x] 6.3 GREEN: Implement `/login` and `/register` against the auth store, matching the Sign-in / Create-account artboards in `design/login-flow.html`; **omit** SSO buttons, the "Full name" field, and the ToS checkbox (no backend support); keep password show/hide + strength meter
- [x] 6.4 REFACTOR: Share the credential form fields/validation between the two pages

## 7. Email verification page

- [x] 7.1 RED: Component-test the verify page — valid `token` query → POST `/auth/verify-email` → success state; non-2xx → "invalid or expired link" state; unverified user resend triggers `/auth/resend-verification` and a "sent" confirmation
- [x] 7.2 GREEN: Implement `/verify-email` (reads `token`, calls verify, resend affordance) plus the signed-in-but-unverified "verify your email" interstitial, matching the Verify-email / Email-verified artboards in `design/login-flow.html`; source the TTL copy from config, not the design's "24 hours"
- [x] 7.3 REFACTOR: Clean up state handling (loading/success/error)

## 8. Forgot- & reset-password pages

- [x] 8.1 RED: Component-test `/forgot-password` — any email yields the identical neutral "if an account exists…" confirmation on `202`
- [x] 8.2 RED: Component-test `/reset-password` — valid token (`GET /auth/reset-password?token=` → `200`) renders the form; `400` shows "invalid or expired link" with no form; successful POST routes to `/login` with a confirmation; new password enforces the strength rule
- [x] 8.3 GREEN: Implement `/forgot-password` and `/reset-password` matching the Forgot-password / Email-sent / Set-new-password artboards in `design/login-flow.html`; reset-link TTL copy comes from config (not the design's "15 minutes")
- [x] 8.4 REFACTOR: Reuse the password field/validation from the register form

## 9. Logout

- [x] 9.1 RED: Unit/component-test logout — calls `/auth/logout`, clears token and user, navigates to `/login`
- [x] 9.2 GREEN: Wire the logout action into the shell (e.g. user menu) using the store action
- [x] 9.3 REFACTOR: Clean up

## 10. Acceptance Test — Outer Loop GREEN

- [x] 10.1 Confirm the `auth-flow.e2e.ts` acceptance test passes end-to-end
- [x] 10.2 Verify all affected apps start in the local environment (smoke test) — boot `apps/web` (and `apps/api` it depends on) and confirm no startup/config errors
- [x] 10.3 REFACTOR: Clean up e2e setup, helpers, and any duplicated test scaffolding

## 11. Change Review — Subagent Verification

- [x] 11.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 11.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 12. Polish

- [x] 12.1 Run linter and fix all errors (`yarn lint`)
- [x] 12.2 Run formatter and apply fixes (`yarn format`)
- [x] 12.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [x] 12.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
