## Why

The `auth` backend exposes register/login/refresh/logout, email verification, and password reset, and `users` exposes `GET /users/me` — but `apps/web` has no way to use any of it. Without an auth store, silent refresh, route protection, and the auth pages, no authenticated frontend feature (dashboard, sessions, agent) can be built. This change is the frontend half of the platform's authentication primitive and the gate for every Phase 10 web feature (PRD §5 J1: a new user must register and reach the app without dead-ends).

## What Changes

- **Auth pages** under `apps/web`: login, register, email verification (consumes the token from the verification link), forgot-password (request reset), and reset-password (validate token via `GET /auth/reset-password?token=`, then submit new password). A "resend verification" affordance for the signed-in-but-unverified state.
- **Auth store (Pinia)**: holds the access token **in memory only** (never `localStorage`), exposes the current user (hydrated from `GET /users/me`), and provides `login` / `register` / `logout` actions plus auth status getters.
- **Silent refresh**: a client-side auth bootstrap on app load calls `POST /auth/refresh` against the `httpOnly` cookie to re-mint an in-memory access token, then hydrates the user. The same refresh path runs once on a `401` to recover transparently before failing.
- **Route middleware**: global guard that redirects unauthenticated users to `/login` (preserving intended destination) and redirects already-authenticated users away from the auth pages. Waits for the auth bootstrap to settle before deciding.
- **Regenerate the Orval client** (`yarn codegen`) so the committed `apps/web/src/api` includes the `auth` and `users` endpoints, then commit the output.
- **Extend the credentialed fetch mutator** (from `web-foundation`) to attach `Authorization: Bearer <accessToken>` from the store, echo the `csrf_token` cookie into the `x-csrf-token` header on state-changing requests, and perform the single silent-refresh-and-retry on `401`.

## Capabilities

### New Capabilities
- `web-auth`: Frontend authentication — auth store with in-memory access token, login/register/verify/forgot/reset pages, silent-refresh bootstrap, and route middleware for protecting authenticated routes and gating the auth pages.

### Modified Capabilities
- `api-client`: The credentialed fetch mutator additionally attaches the `Authorization: Bearer` access token from the auth store, echoes the `csrf_token` cookie as the `x-csrf-token` header on unsafe methods, and retries once after a silent refresh on `401`.

## Impact

- **`apps/web`**: new `pages/` for the auth flows, a `stores/auth.ts` Pinia store, a `plugins/`/`app` bootstrap for silent refresh, route `middleware/` for auth gating, and an extension of the existing fetch mutator (`web-foundation`'s `api-client`).
- **Generated client**: `apps/web/src/api` regenerated and committed (requires `apps/api` running for `yarn codegen`).
- **Backend contract consumed (no API changes)**: `POST /auth/register|login|refresh|logout|verify-email|resend-verification|forgot-password|reset-password`, `GET /auth/reset-password?token=`, `GET /users/me`. CSRF: cookie `csrf_token` / header `x-csrf-token`.
- **Tests**: Playwright e2e for each flow (`apps/web/e2e/`), plus Vitest component/store unit tests. No new entities, migrations, crons, or metrics.
- **Depends on** the archived `web-foundation` (Pinia, vue-query, mutator, problem-details) and `auth`/`users` (endpoints). No downstream scope (dashboard routing/onboarding belongs to `web-dashboard`/`web-onboarding`).
