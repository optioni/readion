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

**Canonical artboard:** [`../../design/Onboarding.html`](../../design/Onboarding.html) (the shared DesignSync mirror committed under `openspec/design/`; it loads the sibling `app-shell.jsx` + `_ds/readion-…/_ds_bundle.{css,js}` token bundle — do **not** copy either into this change). The artboard renders three canvas sections: the chosen **onboarding wizard** (the `V3*` "structured / sidebar" variant — the one wired into `App()`), the **setup-complete** hand-offs, and the **edge-case** empty states. The `V1`/`V2` variants in the file are exploration alternates and are **not** the chosen design; build to the `V3*` components and the two `EmptyState*` components.

Token values are read from the bundle (`--readion-*`): `base #0f172a`, `surface #1e293b`, `elevated #0a0f1e`, `primary #1d4ed8`, `accent-label #7c8cf8`, `text-primary #e2e8f0`, `text-secondary #94a3b8`, `text-muted #64748b`, `text-subtle #475569`, `border-strong #334155`, `status-good #34d399`, `rounded-md 6px`, `rounded-lg 8px`, `rounded-xl 12px`, `rounded-full 9999px`, `font-mono` for code badges. Use the Tailwind/`readion-*` token aliases already wired in `apps/web`, never raw hex.

Designed surfaces this change owns (mapped to the artboard):

| Surface | Artboard component | Maps to |
|---|---|---|
| Wizard chrome (sidebar + step nav) | `V3Sidebar` / `V3Layout` | `app/pages/onboarding/index.vue` shell |
| Step 1 — cert select | `V3Step1` | cert-select step component |
| Step 2 — default prefs | `V3Step2` | session-defaults form component |
| Step 3 — diagnostic offer | `V3Step3` | diagnostic offer step component |
| No-certs empty state (non-admin) | `EmptyStateUser` | onboarding empty-state view |
| No-certs empty state (admin) | `EmptyStateAdmin` | **owned by `web-admin`** — this change routes to it, does not render it |
| Setup-complete / baseline result | `V3Complete` / `V3DiagnosticResult` | **post-flow** — Skip lands straight on the dashboard; the baseline screen is the `web-mock-exam` runner's result. Not built here |
| Diagnostic re-prompt nudge | (not in artboard) | dashboard-mounted nudge — design to the `surface`-card + primary-button pattern |

**Layout to implement** (from the `V3*` artboard): a two-pane wizard on the `base` background. Left: a fixed **~200px sidebar** (`elevated` bg, right border `border-strong`, `32px 20px` padding) carrying the uppercase letter-spaced `accent-label` "Readion" wordmark, a `text-subtle` "Setup" label, and the three step rows **Certification / Preferences / Diagnostic**. Each step row shows a 20px status circle — a `primary`-filled circle with the index for the active step, a translucent-primary circle with a check for completed steps, a `border-strong` outline circle for upcoming — and a footer line ("Setup takes about 2 minutes." / "✓ Setup complete"). Right: the **content pane** (`40px 48px` padding, content `max-width ~520px`) with, per step, an uppercase letter-spaced `accent-label` eyebrow ("Step N of 3"), a ~22px `text-primary` heading, a 13px `text-muted` sub-line, the step body, then a footer rule (`border-strong` top border) holding a muted **← Back** control (steps 2–3) and a right-aligned `primary` **Continue →** button.

- **Step 1 — cert select:** heading "Choose your target certification", sub "You can add more certifications later from your profile." Each certification renders as a selectable row: a leading radio circle (filled `primary` when selected), the certification **name** (`text-primary` when selected, `text-secondary` otherwise), the **provider**, and a trailing mono `code` badge on an `elevated` chip. The selected row gets a `primary` border + translucent-primary (`rgba(29,78,216,0.12)`) fill. Continue is **disabled until a row is chosen**. The artboard groups rows under uppercase `text-subtle` provider headers and shows a search box with an "N available" suffix — both are optional enhancements over the spec's required name+provider; include vendor grouping if cheap, treat search as non-essential.
- **Step 2 — default prefs:** heading "Study preferences", sub "Readion adapts over time — these are your starting defaults." Render the five session-default fields as labelled **pill-group rows** (uppercase `text-muted` field label above a row of pills; the selected pill is `primary`-filled white text, the rest are `border-strong` outline on `elevated`). Reuse the dashboard quiz-option / selected-state token convention. Each pill carries a `data-testid` the acceptance test drives (e.g. `duration-option-60`, `learning-style-spaced-repetition`).
- **Step 3 — diagnostic offer:** heading framing the **optional** diagnostic. Primary action "Take" (full-width `primary` button) and a clearly muted **Skip** control. Copy uses the spec's "Take a 2-minute diagnostic to personalize your first session" framing (see reconciliation — this overrides the artboard's "~15 min / 30 questions" stat).
- **No-certs empty state (non-admin):** centered `surface` card with the star/cert glyph, an 18px `text-primary` "No certifications available yet" heading, an explanatory `text-secondary` paragraph, and an inset `base` info panel ("Certifications are added by your account admin…"). No cert picker / prefs / offer is rendered. The "Notify me" secondary button and support line are optional copy.
- **Diagnostic re-prompt nudge (dashboard):** a compact dismissible `surface` card with the same Take / Skip actions, mounted on the dashboard; rendered **only** when the enrollment's offer is `re-prompt`. Not present in the artboard, so it follows the dashboard card pattern.

Status colours are not used in the flow (no scores are shown during onboarding); `status-good` only appears as the sidebar "Setup complete" affordance.

### Design ↔ contract reconciliation

Reconciled against the actual `../../design/Onboarding.html`. The behavioral spec + the real backend contract remain authoritative where they diverge from the artboard:

| Design element (artboard) | Conflict with contract / spec | Resolution |
|---|---|---|
| Cert picker shows a fixed 7-cert catalog grouped by vendor, with "N available" + search | `GET /certifications` returns **live certs only** (service filters `state: 'live'`); the real catalog is dynamic and may be 1..n | Render exactly what the API returns (name + provider + code); vendor grouping/search are optional chrome over the live list. Empty list ⇒ no-certs routing, never an empty picker |
| Step 2 "Session length" is a **slider** (5/15/30/45/60m) and difficulty is "Adaptive by default, set-manually" | `sessionDefaults` duration enum is **15/30/60/90**; difficulty enum is **beginner/intermediate/advanced/adaptive**; the acceptance test clicks a discrete `duration-option-60` | Use **discrete pill options** bound to the shared enums for all five fields (not a slider); keep the artboard's pill-row visual. The slider and "set manually" affordance are dropped as they conflict with the enum + testids |
| Step 2 shows only length / content-mix / difficulty / learning-style (no focus area); some labels (Questions/Mixed, Easy/Medium/Hard, Spaced rep./Intensive) differ from the enums | Spec/contract require **all five** fields — duration, contentMix (`balanced`/`reading-heavy`/`quiz-heavy`), difficulty, focusArea (`auto`/`weak-areas`/`new-material`/`review`), learningStyle (`weak-area-focus`/`spaced-repetition`/`scenario-based`) | Add the missing **focus area** row and bind every option set to the shared `sessionDefaults*` enums; the artboard's friendly labels map onto the enum values (artboard under-specifies the field set — spec wins) |
| Step 3 advertises "~15 min / 30 adaptive questions / Start diagnostic" as a graded baseline | Diagnostic is `MockExam` `type: 'diagnostic'` — no pass/fail; SPEC + the acceptance test pin the copy to **"Take a 2-minute diagnostic to personalize your first session"** | Use the spec's "2-minute… personalize your first session" framing with a clear Skip; do not surface the artboard's fabricated 15-min/30-question stat or any pass/fail copy |
| "Start diagnostic" opens an inline assessment; the artboard then shows a `V3DiagnosticResult` baseline screen | Diagnostic taking + result reuse the mock-exam runner, owned by `web-mock-exam` (not yet built) | Take → `POST /:id/diagnostic` then **navigate to the mock-exam runner route** for the returned attempt (placeholder constant, reconciled when `web-mock-exam` lands); the baseline-result screen is not built here |
| `V3Complete` "Setup complete" summary screen on Skip | SPEC + the acceptance test require Skip → `POST /:id/diagnostic-offer/dismiss` then land **directly on the dashboard (`/`)** | Skip navigates straight to `/`; no interstitial completion-summary screen in this change |
| `EmptyStateAdmin` "Set up your first certification" screen | The admin cert-setup screen is owned by `web-admin` (not yet built); the gate routes admins away **before** the onboarding page renders | The onboarding page renders only the **non-admin** `EmptyStateUser`; an admin with zero certs is routed to the placeholder admin cert-setup route |
| Role read implicitly (artboard is static) | The `apps/web` `useAuthStore` `AuthUser` type omits `role`, even though `authUserSchema` / `GET /users/me` expose it | Source `role` from `GET /users/me` (`usersControllerGetMe`), not the trimmed store type |
| Offer/nudge always shown | Offer visibility is driven by `GET /:id/diagnostic-offer`: `onboarding` (show in flow), `re-prompt` (show nudge on dashboard), `none` (hide) | Drive all offer/nudge visibility off the endpoint value; never show when `none` |

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
- [Design vs. enum/testid drift] → the artboard's slider for session length and its "~15 min / 30-question" diagnostic stat conflict with the `sessionDefaults` enums and the spec's "2-minute diagnostic" copy → resolved in the reconciliation table to discrete enum-bound pills + the spec copy; the acceptance test's `data-testid`s pin the option values.

## Open Questions

- Exact route names for the diagnostic/mock-exam runner (`web-mock-exam`) and the admin cert-setup flow (`web-admin`) — use placeholders now, reconcile when those changes land.
- Whether to widen the `apps/web` `useAuthStore` `AuthUser` type to include `role` (so other features can read it from the store) — deferred; this change reads role from `GET /users/me`.
- Canonical layout is reconciled against `../../design/Onboarding.html` (the `V3*` sidebar-wizard variant + `EmptyState*`); the `V1`/`V2` variants and the post-flow `V3Complete`/`V3DiagnosticResult` screens are intentionally out of scope here.
