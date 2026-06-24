## Context

`apps/web` was bootstrapped by `web-foundation` (Nuxt UI, Tailwind, Pinia, vue-query, a credentialed fetch mutator, typed problem-details errors, an SSE composable). The `auth` and `users` backend changes are merged and expose the full credential lifecycle: `POST /auth/register|login|refresh|logout|verify-email|resend-verification|forgot-password|reset-password`, `GET /auth/reset-password?token=`, and `GET /users/me`.

The transport contract is fixed by SPEC → Authentication & Authorisation → Token transport and verified against the implemented API: the **refresh token** lives in an `httpOnly`, `Secure`, `SameSite=Lax` cookie; the **access token** is returned in the response body and must be held **in memory in Pinia** (never `localStorage`); CSRF uses a double-submit pair — non-`httpOnly` cookie `csrf_token` echoed in the `x-csrf-token` header — enforced by the API only on unsafe methods when a refresh cookie is present.

This change is frontend-only: no entities, migrations, crons, or metrics. It is the gate for every Phase 10 web feature.

## Goals / Non-Goals

**Goals:**
- A Pinia auth store with an in-memory access token, current-user hydration, and login/register/logout/refresh actions.
- The five auth pages: login, register, verify-email, forgot-password, reset-password (plus resend-verification affordance).
- A client-side silent-refresh bootstrap so a hard reload restores the session from the cookie before route decisions are made.
- Global route middleware that protects authenticated routes and gates the public auth pages.
- Extend the `web-foundation` mutator to attach the bearer token, echo the CSRF header on unsafe methods, and do a single refresh-and-retry on `401`.
- Regenerate and commit the Orval client so `auth`/`users` endpoints exist in `apps/web/src/api`.

**Non-Goals:**
- Dashboard content, onboarding flow, and no-certifications routing (owned by `web-dashboard` / `web-onboarding`). This change routes an authenticated user to the app home; what that home renders is out of scope.
- Any API/backend change — the contract is consumed as-is.
- Profile editing, account deletion UI, timezone/preferences screens (`users` UI lands with later web features).

## Visual Design

The visual source of truth is the **"Readion app onboarding flow"** Claude Design project (`Login.html`), imported into this change at `design/login-flow.html`. It defines eight artboards built on the Readion tokens already wired into `apps/web`:

| Artboard | Maps to |
|---|---|
| Sign in | `/login` page |
| Sign in — error state | `/login` `401` handling |
| Create account | `/register` page |
| Forgot password | `/forgot-password` page |
| Email sent | forgot-password confirmation state |
| Set new password | `/reset-password` form |
| Verify email — post-registration | signed-in-but-unverified interstitial + `/verify-email` |
| Email verified — account activated | `/verify-email` success state |

**Layout to implement:** a shared **split-panel auth layout** — a fixed 280px brand panel (logo, tagline, feature list, testimonial) on `--readion-background-elevated`, beside a centered form panel on `--readion-background-surface`. The same layout wraps every auth state. This becomes a reusable Nuxt layout (e.g. `layouts/auth.vue`) consumed by all auth pages. Colors/typography/spacing come from the wired tokens — no new token work.

### Design ↔ contract reconciliation

The mockup was drawn ahead of the contract and diverges from the implemented `auth`/`users` API in several places. The behavioral specs win; resolve as follows during implementation:

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Per-field error "No account found with this email" (error state) | SPEC + `auth` mandate a **uniform** `401` that never reveals which field was wrong | Render the error banner ("Incorrect email or password.") **only**; drop the per-field "no account found" message |
| "Sign in/up with SSO" buttons + "or" divider | No SSO/OAuth exists in the backend or SPEC | **Omit** the SSO buttons and divider (out of scope) |
| Register "Full name" field | `POST /auth/register` accepts `email` + `password` only; no name column on `User` | **Omit** the name field (no backend support; not in `web-auth` scope) |
| Register "Terms of Service / Privacy Policy" checkbox | No ToS acceptance in the backend contract | **Omit** the stored checkbox; keep static policy links only if desired (no gating state) |
| Forgot/Email-sent copy: reset link "expires in 15 minutes" | `auth` issues the reset token with a **1-hour** TTL | Use copy matching the real TTL (1 hour) — derive from config rather than hardcoding 15 min |
| Verify-email copy: "expires in 24 hours" | Verification-token TTL is set by `auth` config | Confirm the actual TTL against `auth` config and match the copy |
| "Open email app" / "Continue to setup →" CTAs | Post-auth landing (onboarding) is owned by `web-onboarding` | Keep as a simple forward navigation to the app home; final destination settled downstream |

**Keep from the design:** the split-panel layout, password show/hide toggle, password-strength meter (client-side hint over the API's ≥8-char rule), the success/check-your-email confirmation states, "resend link" and "use a different email" affordances, and the post-registration "verify your email" interstitial (aligns with the spec's signed-in-but-unverified state).

## Test Boundaries

The acceptance tests are Playwright e2e specs in `apps/web/e2e/`. Per project convention (CLAUDE.md: outside-in TDD; no DB mocking in integration), the e2e flows run the real Nuxt app against the real NestJS API + Postgres + Redis (Testcontainers / docker-compose). Component/store unit tests (Vitest + `@nuxt/test-utils`) mock the HTTP layer.

| Dependency | In acceptance test (Playwright e2e) | In unit tests (Vitest) |
|---|---|---|
| NestJS `auth`/`users` API | real (running API) | HTTP mock (mocked `fetch` / MSW) |
| Postgres + Redis | real (Testcontainers / docker-compose) | not involved |
| `httpOnly` refresh cookie + `csrf_token` cookie | real (set by API, exercised by browser) | simulated cookie/header values |
| Email delivery (verification/reset links) | token captured from the API/mail test double; link visited directly | n/a (page reads `token` query param) |
| Pinia auth store | real store in the app | real store under test |
| Fetch mutator (token/CSRF/refresh-retry) | real | unit-tested directly with a mocked fetch |
| Nuxt router / middleware | real navigation | route-middleware unit tests with stubbed route + store |

## Decisions

- **Access token in a Pinia store, in memory only.** Mandated by SPEC. Alternative (`localStorage`) is rejected: it is XSS-exfiltratable and the spec explicitly forbids it. Consequence: a hard reload loses the token, so the silent-refresh bootstrap is mandatory, not optional.

- **Silent refresh runs client-side on app load, not during SSR.** `/auth/refresh` rotates the refresh token; running it inside SSR would consume/rotate the cookie on every server render and complicate `Set-Cookie` propagation. Decision: gate the bootstrap to the client (a plugin / `app:mounted`-style hook) and have route middleware await a `ready` promise on the store before deciding. Alternative (SSR refresh) rejected for rotation/cookie-forwarding complexity; the brief client-only auth resolution is acceptable for an installable SPA.

- **CSRF + bearer injection live in the mutator, not per-call.** Centralizing in the existing `web-foundation` mutator keeps every generated client method correct by default and avoids sprinkling header logic across composables. This is the MODIFIED `api-client` requirement. Alternative (per-request wiring) rejected as error-prone.

- **Single refresh-and-retry on `401`, no loop.** A `401` triggers exactly one `/auth/refresh`; success retries the original request once, failure clears the store and surfaces the `401`. A concurrency guard (shared in-flight refresh promise) prevents a burst of parallel `401`s from firing N refreshes. Alternative (no auto-retry) rejected: it would bounce users to `/login` on every expired-access-token boundary.

- **Route protection via global middleware with an explicit public allowlist.** The auth/verify/reset pages are public; everything else requires auth. Modeled as global middleware that awaits the auth bootstrap. Alternative (per-page `definePageMeta` middleware) is more repetitive and risks a new protected page shipping unguarded.

- **Shared split-panel `auth.vue` layout.** Per the imported design (`design/login-flow.html`), every auth state uses one split-panel layout (brand panel + form panel). Implement it once as a Nuxt layout that all auth pages opt into, rather than repeating the chrome per page. Where the design conflicts with the backend contract (uniform login error, no SSO/name/ToS, TTL copy), the behavioral spec wins — see Visual Design → Design ↔ contract reconciliation.

- **Regenerate the Orval client as part of this change.** The committed `apps/web/src/api` currently only has health/metrics/model; `yarn codegen` (with `apps/api` running) is required to pull in `auth`/`users` and the generated output is committed, per CLAUDE.md.

## Risks / Trade-offs

- **Hard-reload flash of `/login` before refresh resolves** → middleware awaits the store's bootstrap `ready` promise; render a minimal loading state until it settles rather than deciding on an empty token.
- **Parallel `401`s causing a refresh storm** → a single shared in-flight refresh promise so concurrent failures await one refresh, then all retry.
- **CSRF cookie name drift** → names are pinned to the verified API constants (`csrf_token` / `x-csrf-token`); a unit test asserts the mutator reads/writes exactly those.
- **Codegen requires a running API** → documented as a task prerequisite; CI does not regenerate, so the committed client must be up to date before merge.
- **Verification/reset link origin** → the API already builds links against the configured web base URL; the frontend only needs matching routes (`/verify-email`, `/reset-password`) that read the `token` query param.

## Open Questions

- Exact post-login destination when no intended route was captured — default to the app home (`/`); final landing UX is settled by `web-dashboard`/`web-onboarding`, so this change only needs a sensible default redirect. The design's "Continue to setup →" CTA confirms the intended forward is onboarding.
- Whether the signed-in-but-unverified state should soft-block protected routes (verification banner) or hard-block — default to a non-blocking "resend verification" affordance here (matching the design's "verify your email" interstitial), deferring any hard gate to the feature that requires verification.
- Verification-token TTL copy: the design says "24 hours" — confirm against `auth` config before using that exact wording, and source the reset-link TTL copy from config rather than the design's "15 minutes".
- The remaining screens in the design project (`Dashboard`, `Session`, `MockExam`, `Progress`, `AgentChat`, `Onboarding`, admin screens) belong to later `web-*` changes — import them into their own changes when those are authored, not here.
