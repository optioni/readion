## Context

`apps/web` was bootstrapped by `web-foundation` (Nuxt UI, Tailwind, Pinia, vue-query, a credentialed fetch mutator, typed problem-details, an SSE composable) and `web-auth` (auth store `useAuthStore`, silent-refresh bootstrap, global route protection). `web-dashboard` built the post-login home (`app/pages/index.vue`) with the vertical cert-card list, the `dashboardQueryKeys` query-key factory, the `useEnrollments` / `useCard*` composables, the `statusColor` helper, and the `AddCertificationModal` enroll flow. `web-cert-detail` added the per-cert deep-dive with its own `certDetailQueryKeys`.

This change builds the **first-run onboarding flow** defined by SPEC → Frontend → Onboarding and SPEC → Certification Enrollment, plus the **diagnostic re-prompt** from SPEC → Diagnostic Exam. It is an assembly layer over endpoints already shipped by archived backend changes and already present in the committed Orval client (`apps/web/src/api`) — no new API, entities, migrations, crons, metrics, or `yarn codegen`.

The implemented backend contract was verified against the NestJS controllers and shared schemas:

- `GET /certifications` (`@Public`) → `data[]` of `{ id, name, provider, code, domains[], questionCount, passingScore, timeLimitMinutes, state }`. The service filters to **`state: 'live'` only**, so the onboarding cert picker inherently lists only live certs. Empty array ⇒ no certs exist for routing purposes. Orval: `certificationsControllerList()`.
- `GET /users/me` → `UserProfileResponse` = `authUserSchema` (`{ id, email, role, emailVerified, ... }`) extended with `{ displayTimezone, sessionDefaults }`. **`role` (`'user' | 'admin'`) and `sessionDefaults` both come from here.** Orval: `usersControllerGetMe()`.
- `PATCH /users/me` → accepts `{ displayTimezone?, sessionDefaults?: Partial<SessionDefaults> }` (`updateUserProfileRequestSchema`). Saves user-level session-default prefs. Orval: `usersControllerUpdateMe()`.
- `POST /user-certifications` → body `{ certificationId: uuid, sessionDefaults?: {duration?, contentMix?, difficulty?, focusArea?, learningStyle?} }` (`enrollCertificationRequestSchema`); 201 → `{ data: EnrollmentResponse, relationships }`; 422 on validation error. Orval: `userCertificationsControllerEnroll({ body })`.
- `GET /user-certifications?status=active` → `data[]` of `EnrollmentResponse` + `meta`. Used by the entry gate to detect an existing enrollment. Orval: `userCertificationsControllerList({ status: 'active' })`.
- `GET /user-certifications/:id/diagnostic-offer` → `{ offer: 'onboarding' | 're-prompt' | 'none' }` (`DiagnosticOfferResponse`). `deriveOffer` returns `onboarding` for a fresh **live** enrollment with no completed diagnostic and `< repromptAfterSessions` completed sessions; `re-prompt` once after the first session(s) if still uncalibrated and not yet re-prompted; otherwise `none`. Orval: `diagnosticControllerGetOffer(id)`.
- `POST /user-certifications/:id/diagnostic` → creates the diagnostic attempt, returns `MockExamResponse` (`type: 'diagnostic'`); 409 if cert not live. Orval: `diagnosticControllerCreate(id)`.
- `POST /user-certifications/:id/diagnostic-offer/dismiss` → 200, records `diagnosticRePromptedAt`. Orval: `diagnosticControllerDismissOffer(id)`.

## Goals / Non-Goals

**Goals:**
- A first-run onboarding flow (`app/pages/onboarding/`): cert-select → default session-prefs → optional diagnostic offer, ending on the dashboard or in the diagnostic runner.
- Day-one routing: onboarding only reachable with ≥1 live cert; admin + no certs → admin cert-setup route; non-admin + no certs → "No certifications available yet" empty state; already-enrolled → dashboard.
- A reusable, dismissible diagnostic re-prompt nudge driven by `offer === 're-prompt'`, mounted on the dashboard.
- Composables that reuse the established vue-query + query-key + `statusColor` patterns and the `AddCertificationModal` enroll flow.

**Non-Goals:**
- Any backend/API change, new entity, migration, cron, emitted metric, or Orval regeneration — the contract is consumed as-is.
- The admin certification-setup screen (owned by `web-admin`) and the mock-exam / diagnostic **runner** screen (owned by `web-mock-exam`) — this change navigates to those routes as targets, not implements them.
- The dashboard cert-card list and add-cert modal themselves (owned by `web-dashboard`) — reused, not rebuilt; the re-prompt nudge mounts alongside them without modifying their internals.
- Per-cert session-default override UX at the dashboard add-cert path (that modal enrolls with defaults; the override step lives here in the onboarding flow and in `web-settings`).

## Visual Design

**Visual source could not be pulled — DesignSync is absent from this environment.** The canonical artboard for this change is `Onboarding.html` in the "Readion app onboarding flow" Claude Design project (`projectId 4526b72d-50eb-4140-8cf3-39f776743a65`). The `DesignSync` connector (`list_projects`/`list_files`/`get_file`) is **not present in this toolset** (verified), so the canonical artboard was **not** imported and **no `design/Onboarding.html` was reconstructed or fabricated**. The visual section below is therefore driven from SPEC → Frontend (Onboarding) + DESIGN.md token values + the archived `web-dashboard` / `web-cert-detail` component patterns. **Action when DesignSync is available:** pull `Onboarding.html` via `get_file`, save it verbatim at `design/Onboarding.html`, and re-diff this section against it (a real reconciliation pass, the way `web-auth`/`web-dashboard` did).

Designed surfaces this change owns (provisional mapping, to be re-diffed against the canonical artboard):

| Surface (provisional) | Maps to |
|---|---|
| Onboarding — cert select | `app/pages/onboarding/index.vue` step 1 (cert picker) |
| Onboarding — default prefs | onboarding step 2 (session-defaults form) |
| Onboarding — diagnostic offer | onboarding step 3 (diagnostic offer card) |
| No-certs empty state | onboarding empty-state view (non-admin) |
| Diagnostic re-prompt nudge | dashboard-mounted nudge component |

**Layout to implement** (DESIGN.md → Layout, Components): a single centered max-width column on the page `base` (#0f172a) background; step panels use `surface` (#1e293b) cards with `lg` (8px) radius and `xl` padding, depth via background layers (no `box-shadow`). Step/section headings use the uppercase letter-spaced `label` style. Primary CTAs ("Continue", "Take the diagnostic") use `primary.default` (#1d4ed8); the Skip action is a muted/secondary control. The diagnostic offer card and re-prompt nudge reuse the `surface` card + primary-button pattern from the dashboard cards; status colours are not used here (no scores are shown during onboarding). Cert-select options reuse the `AddCertificationModal` row style (name + uppercase muted provider). Selection state uses `primary.default` (matching the quiz-option/selected-state convention).

### Design ↔ contract reconciliation

The behavioral spec + the real backend contract are authoritative. Until the canonical artboard is pulled, treat these as the known reconciliation points (re-diff when `Onboarding.html` is available):

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Cert picker shows all/"coming soon" certs | `GET /certifications` returns **live certs only** (service filters `state: 'live'`); draft certs are never returned | Render exactly what the API returns; no draft/"coming soon" affordance. Empty list ⇒ no-certs routing, not an empty picker |
| Role-based routing reading `role` from the auth store | The `apps/web` `useAuthStore` `AuthUser` type omits `role` (it carries `id, email, emailVerified, displayTimezone, createdAt`), even though `authUserSchema` and `GET /users/me` expose `role` | Source `role` from `GET /users/me` (`usersControllerGetMe`), which returns `role`, rather than the trimmed store type. (Optionally widen the store `AuthUser` type to include `role` later; not required here) |
| Diagnostic framed as a graded/pass-fail test | Diagnostic is `MockExam` `type: 'diagnostic'` — no pass/fail, optional/lenient timer | Use the "personalize your first session" framing with a clear Skip; no pass/fail copy |
| "Take diagnostic" opens an inline mini-exam in onboarding | Diagnostic taking reuses the mock-exam runner, owned by `web-mock-exam` (not yet built) | Navigate to the mock-exam runner route for the returned attempt; use a placeholder route now and reconcile when `web-mock-exam` lands |
| Admin "set up certifications" CTA | The admin cert-setup screen is owned by `web-admin` (not yet built) | Route to a placeholder admin cert-setup route; reconcile when `web-admin` lands |
| Diagnostic offer/nudge always shown | Offer visibility is driven by `GET /:id/diagnostic-offer`: `onboarding` (show in flow), `re-prompt` (show nudge on dashboard), `none` (hide) | Drive all offer/nudge visibility off the endpoint value; never show when `none` |

## Test Boundaries

Acceptance tests are Playwright e2e specs in `apps/web/e2e/` running the real Nuxt app against the real NestJS API + Postgres + Redis (Testcontainers / docker-compose), per CLAUDE.md outside-in TDD (no DB mocking in integration). Component/composable unit tests (Vitest + `@nuxt/test-utils`) mock the HTTP layer.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| NestJS certifications / users / user-certifications / diagnostic API | real (running API) | HTTP mock (mocked `fetch` / MSW) |
| Postgres + Redis | real (Testcontainers / docker-compose) | not involved |
| Seed state (available live certs, user role, existing enrollment) | seeded via the real API/DB before assertions (first-user-admin, a live cert, optionally a prior enrollment) | fixture DTOs |
| Auth store + route protection (`web-auth`) | real (authenticated session) | real store / stubbed route |
| Generated Orval client | real | mocked at the fetch layer |
| Admin cert-setup route / mock-exam runner route (downstream, unbuilt) | placeholder route target asserted (navigation occurs) | asserted as a navigation call |
| Entry-gate / role-routing / step-progression logic | exercised via rendered UI + redirects | unit-tested as pure functions over `{ certs, role, enrollments, offer }` |

## Decisions

- **No `yarn codegen`.** Every endpoint the flow consumes is already in the committed client; this change adds no backend surface. A task asserts the required client methods exist (`certificationsControllerList`, `usersControllerGetMe`, `usersControllerUpdateMe`, `userCertificationsControllerEnroll`, `userCertificationsControllerList`, `diagnosticControllerGetOffer`, `diagnosticControllerCreate`, `diagnosticControllerDismissOffer`) before building against them.
- **Role + defaults come from `GET /users/me`, not the auth store.** The web `AuthUser` store type omits `role`; `GET /users/me` returns both `role` and `sessionDefaults`. Onboarding reads them from there. Alternative (widen the store type / decode the JWT) rejected as more invasive than a single profile read the flow already needs for pre-filling defaults.
- **Cert picker lists exactly what `GET /certifications` returns.** The API already restricts to live certs, so no client-side `state` filtering and no draft affordance. An empty response is the canonical no-certs signal, branching routing on `role`.
- **Onboarding entry is a route gate, not a server flag.** First-run is detected from `GET /user-certifications?status=active` being empty (no enrollment) — there is no dedicated "has onboarded" backend field. The middleware/page guard: zero active enrollments + ≥1 live cert ⇒ onboarding; ≥1 enrollment ⇒ dashboard; zero certs ⇒ role-branch. Alternative (a new `onboardedAt` user column) rejected — out of scope and unnecessary; enrollment presence is the real signal SPEC uses ("Onboarding — first cert enrolled").
- **Default prefs are written to the profile AND used as the enroll `sessionDefaults`.** SPEC says onboarding "configures default session preferences" (user-level) and "enrollment creates a UserCertification" with optional per-cert overrides. The flow persists the chosen values via `PATCH /users/me` (user defaults) and passes the same values as the enrollment `sessionDefaults` so the first cert starts from the user's chosen baseline. Alternative (only one of the two) rejected — the user-level save is what makes subsequent enrollments inherit the choice; the per-cert copy is what SPEC's enrollment override hook expects.
- **Diagnostic visibility is fully endpoint-driven.** Both the in-flow offer and the dashboard re-prompt nudge read `GET /:id/diagnostic-offer` and render per its `offer` value, so the UI never has to re-derive calibration state. The re-prompt nudge is a standalone component mounted on the dashboard (no edits to `web-dashboard`'s owned card components beyond mounting), keeping the change contained.
- **Downstream runner/admin routes are placeholders.** `web-mock-exam` (diagnostic runner) and `web-admin` (cert-setup) are not built; navigation targets are placeholder routes asserted by tests and flagged for reconciliation, matching the `web-dashboard` precedent of stubbing quick-start navigation.

## Risks / Trade-offs

- [Placeholder downstream routes drift from the real route names] → assert navigation to a named placeholder now; reconcile route names when `web-mock-exam` and `web-admin` land (tracked in Open Questions).
- [Auth store `AuthUser` lacks `role`, so a careless implementer might read role from the store and always get `undefined`] → the reconciliation table and a unit test pin role sourcing to `usersControllerGetMe`; optionally widen the store type in a follow-up.
- [Race between enrolling and the dashboard's `enrollments` query cache] → invalidate `dashboardQueryKeys.enrollments()` after `POST /user-certifications` (same pattern as `AddCertificationModal`) so the dashboard reflects the new enrollment on arrival.
- [Diagnostic offer recomputed on each load could flicker the nudge] → key the offer query per enrollment and only render when `offer === 're-prompt'`; dismiss invalidates/refetches so it resolves to `none`.
- [Design provenance gap] → no canonical artboard was pulled (DesignSync absent); the visual section is spec/token-derived and explicitly flagged for a re-pull + re-diff against `Onboarding.html`. Behavioral spec is authoritative meanwhile.

## Open Questions

- Exact route names for the diagnostic/mock-exam runner (`web-mock-exam`) and the admin cert-setup flow (`web-admin`) — use placeholders now, reconcile when those changes land.
- Whether to widen the `apps/web` `useAuthStore` `AuthUser` type to include `role` (so other features can read it from the store) — deferred; this change reads role from `GET /users/me`.
- Canonical `Onboarding.html` layout details (exact step chrome, progress indicator, copy) — pending a DesignSync re-pull; current layout is spec/DESIGN.md-derived.
