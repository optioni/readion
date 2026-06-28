## Context

`apps/web` was bootstrapped by `web-foundation` (Nuxt UI, Tailwind, Pinia, vue-query, a credentialed fetch mutator, typed problem-details, an SSE composable) and `web-auth` added the auth store, silent-refresh bootstrap, and global route protection, leaving the post-login home (`/`) a placeholder. This change builds that home: the **Dashboard** defined by SPEC → Frontend → Dashboard and SPEC → Layout Decisions → Dashboard.

Every datum the dashboard renders is already exposed by archived backend changes and present in the committed Orval client (`apps/web/src/api`). The dashboard is an **assembly layer** over those endpoints — no new API, no `yarn codegen`, no entities, migrations, crons, or metrics.

The implemented backend contract (verified against the NestJS controllers):

- `GET /api/v1/user-certifications?status=active` → `data[]` of `{ id, certificationId, status, enrolledAt, sessionDefaults, readinessScore: number | null }` + `meta`. **`readinessScore` is on each enrollment row**, so the list can be sorted for the hero without N readiness calls.
- `GET /api/v1/certifications` (`@Public`) → `data[]` of `{ id, name, provider, code, domains[], questionCount, passingScore, timeLimitMinutes, state }`. The only source of certification **name + provider** (the enrollment row carries `certificationId` only) and the source for the add-cert picker.
- `GET /api/v1/user-certifications/:id/readiness` → `{ calibrated: boolean, score: number | null, trajectory: { weeksToReady } | null }`.
- `GET /api/v1/user-certifications/:id/weak-areas` → `data[]` of `{ id, domain, score, accuracy, meanConfidence, responseCount }` (ranked).
- `GET /api/v1/sessions?certificationId=<Certification.id>&limit=3` → recent sessions. `certificationId` filters on `UserCertification.certification_id` (the underlying cert id, available as `enrollment.certificationId`), **not** the enrollment id. `SessionResponse` carries `focusArea` but **no `accuracy` and no single `domain`**.
- `GET /api/v1/sessions/:id/summary` → `{ accuracy, domains[], readiness: { before, after, delta }, ... }` — the source of per-recent-session **accuracy** and the readiness **delta since last session**.
- `GET /api/v1/user-certifications/:id/review` → `{ items[], meta: { dueCount, total } }` — the due-review count.
- Quick-start actions: `POST /user-certifications/:id/sessions`, `POST /user-certifications/:id/mock-exams`, `POST /user-certifications/:id/review/start`. Add-cert: `POST /user-certifications`.

## Goals / Non-Goals

**Goals:**
- A dashboard home (`pages/index.vue`) that renders the **vertical cert list** with the hero/standard card split.
- Each card: name + provider, readiness (with calibration state + delta), top-3 weak areas (status-coloured), last-3 recent sessions (domain + accuracy), conditional due-review quick-start, Start-Session + Mock-Exam actions.
- Sorting: lowest-readiness calibrated cert → gradient hero at top; remaining sorted by readiness ascending; uncalibrated certs placed after calibrated ones.
- Add-certification modal (enroll into a not-yet-enrolled cert with defaults).
- Empty state for an authenticated user with no active enrollments.
- Composables that fan in the per-card data over the existing client, with reasonable loading/error states.

**Non-Goals:**
- Any API/backend change, new entity, migration, cron, metric, or Orval regeneration — the contract is consumed as-is.
- The per-cert deep-dive (Overview/Sessions tabs, exam history) — owned by `web-cert-detail`.
- Onboarding cert-select / default-prefs / diagnostic offer and the first-admin → admin-setup / zero-available-certs routing — owned by `web-onboarding`.
- The actual Session runner, Mock-exam runner, and Quick-review run loop screens — owned by `web-session-view`, `web-mock-exam`, `web-progress`. This change wires the quick-start buttons to those routes (stubs) only.
- Per-cert exam-date countdowns (no backend field — see reconciliation).

## Visual Design

The visual source of truth is the **"Readion app onboarding flow"** Claude Design project (`projectId 4526b72d-50eb-4140-8cf3-39f776743a65`), `Dashboard.html` artboard. The **canonical artboard was pulled via `DesignSync get_file`** and is stored verbatim at `design/Dashboard.html` (real React/Babel artboard referencing the `_ds/readion-38736cfc-…` design-system bundle). The reconciliation table below was re-diffed against this canonical artboard: it matches the intended layout (lowest-readiness gradient hero card, vertical cert list, weak-area domain badges, recent-sessions row, due-reviews + 5-min review, Mock-exam / Start-session actions, dashed Add-certification card, and the day-one empty state with diagnostic CTA). The behavioural spec remains authoritative where the artboard and the implemented backend contract differ.

**Layout to implement** (DESIGN.md → Layout → Dashboard): a single full-width column of cert cards, max-width container, top nav bar. The **hero card** uses the gradient (`primary.default` → `accent.gradient`) with the inset-glow `box-shadow` exception and white text; **standard cards** use `surface` background. Section label "MY CERTIFICATIONS" uses the uppercase `label` style. Readiness percentage uses the `readinessScore` (28px/700) style. Weak-area scores use the status colour scale (<50 poor, 50–65 warning, 65–80 medium, >80 good). No `box-shadow` for depth elsewhere; depth via background layers.

### Design ↔ contract reconciliation

The mockup was drawn ahead of the contract. The behavioural specs win; resolve as follows during implementation:

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Per-cert exam-date countdown ("Exam in 23 days", "No exam date set") | No per-user exam-date field exists on `UserCertification` or `Certification` in the implemented backend | **Omit** the countdown. (If a target-date feature is wanted, it is a backend change in its own right — out of scope here.) |
| Readiness "+3% since last session" | Not on `GET /:id/readiness`; the delta lives in the **latest completed session's** `GET /sessions/:id/summary` → `readiness.delta` | Derive the delta from the most recent completed session's summary; hide it when there is no prior session or `delta` is `null` |
| Recent session rows showing accuracy ("Today · Security 82%") | `SessionResponse` has no `accuracy` and no single `domain` — only `focusArea` | Fetch `GET /sessions/:id/summary` per recent **completed** session for `accuracy`; use the summary's `nextFocus`/dominant domain or the session `focusArea` as the row label. Bounded to ≤3 summary calls per cert |
| Readiness shown as a number even when there is little signal | SPEC: below the calibration bar readiness is **"not yet calibrated"**, not a misleading number | When `readiness.calibrated === false` (equivalently `readinessScore === null`), render **"not yet calibrated"** and suppress the delta; the cert cannot win the hero slot on score |
| "5-minute review" quick-start absent from the mockup | SPEC mandates a due-review quick-start "shown only when items are due" | **Add** the review quick-start; render it only when `review.meta.dueCount > 0` |
| "Behind pace — needs more attention" hero copy | No such field; closest signal is `readiness.trajectory.weeksToReady` | Optional informational copy derived from `trajectory`; never invent a deadline (passive, no dates — consistent with SPEC's trajectory being informational only) |
| App/nav chrome in the mockup (Study/Progress/Admin links, user menu) | Owned by the `web-foundation` shell + `web-auth` user menu | Use the existing shell/nav; don't re-implement nav here |

**Keep from the design:** the vertical cert list, the gradient hero card for the lowest-readiness cert with the inset-glow, the standard surface cards sorted by readiness ascending, the two-panel "WEAK AREAS" / "RECENT SESSIONS" split inside each card, status-coloured weak-area scores, the Start-Session (primary) + Mock-Exam (secondary) quick-start stack, and the dashed "+ Add certification" entry at the bottom.

## Test Boundaries

Acceptance tests are Playwright e2e specs in `apps/web/e2e/` running the real Nuxt app against the real NestJS API + Postgres + Redis (Testcontainers / docker-compose), per CLAUDE.md outside-in TDD (no DB mocking in integration). Component/composable unit tests (Vitest + `@nuxt/test-utils`) mock the HTTP layer.

| Dependency | In acceptance test (Playwright e2e) | In unit tests (Vitest) |
|---|---|---|
| NestJS user-certifications / readiness / weak-areas / sessions / review / mock-exam / certifications API | real (running API) | HTTP mock (mocked `fetch` / MSW) |
| Postgres + Redis | real (Testcontainers / docker-compose) | not involved |
| Seed state (enrolled certs, graded answers, sessions, due reviews) | seeded via the real API before assertions | fixture DTOs |
| Auth store + route protection (`web-auth`) | real (authenticated session) | real store / stubbed route |
| Generated Orval client | real | mocked at the fetch layer |
| Hero-sort / status-colour / calibration logic | exercised via rendered UI | unit-tested as pure functions |

## Decisions

- **No `yarn codegen`.** Unlike `web-auth`, every endpoint the dashboard consumes is already in the committed client; this change adds no backend surface. Skipping codegen avoids a needless regeneration diff. A task asserts the required client methods already exist before building against them.
- **Sort + hero selection is a pure function over the enrollment list.** `readinessScore` is on each enrollment row, so the list sort (calibrated ascending, then uncalibrated) and hero pick (lowest calibrated score) are computed from the single list response — no per-cert readiness call is needed just to order the list. Per-cert `GET /:id/readiness` is still used per card to get `calibrated`/`trajectory` detail. Alternative (N readiness calls to sort) rejected as wasteful.
- **Per-card data fans out in parallel, degrades gracefully.** Each card independently loads readiness, weak areas, recent sessions (+ their summaries), and the due-review count via vue-query. A slow or failing sub-request shows a per-panel skeleton/empty state rather than failing the whole dashboard. Alternative (one blocking aggregate) rejected: there is no aggregate endpoint and it would couple unrelated panels.
- **Recent-session accuracy via per-session summary, bounded to 3.** Accuracy is not on the session list; the summary endpoint supplies it. Capping at the last 3 completed sessions per cert (the SPEC card limit) bounds the fan-out. Reading-only/abandoned sessions without a summary fall back to a date + `focusArea` row without an accuracy figure. Flagged as a known N (≤3) cost, acceptable for the dashboard card.
- **"Not yet calibrated" is a first-class card state.** When `calibrated === false`, the card shows the calibration message instead of a percentage, suppresses the delta, and is sorted after calibrated certs (it cannot be the lowest-score hero). Matches SPEC → Exam Readiness Score.
- **Add-cert enrolls with defaults; override UI deferred.** `POST /user-certifications` accepts optional `sessionDefaults`; the dashboard modal enrolls with defaults and lets `web-onboarding`/`web-settings` own the override UX. Keeps this change contained.
- **Quick-start buttons navigate to downstream routes (stubs here).** Start Session / Mock Exam / 5-min review call their POST actions (or navigate to the start screen owned downstream) and route into `web-session-view` / `web-mock-exam` / `web-progress`. This change provides sensible navigation targets, not the runner screens.

## Risks / Trade-offs

- **Per-card fan-out request volume** (readiness + weak-areas + sessions + ≤3 summaries + review per cert) → parallelize via vue-query with caching; lazy-load below-the-fold cards if the enrolled count is large. The typical learner has 1–3 certs (MVP is one cert), so volume is modest.
- **Hero selection when no cert is calibrated** → if every enrollment is uncalibrated there is no lowest-score hero; fall back to the most recently enrolled cert in the hero slot (still the "next to attend to") or render all as standard cards. Decided: most-recently-enrolled takes the hero slot when none are calibrated; an e2e/unit case covers it.
- **Design provenance** → `design/Dashboard.html` is the canonical artboard pulled via `DesignSync get_file` from the "Readion app onboarding flow" project; the reconciliation table was re-diffed against it and matches. The reconciliation table and behavioural spec remain authoritative where the artboard and the implemented backend contract diverge.
- **Stale readiness/weak-area reads** → the list `readinessScore` and the per-cert reads can momentarily disagree right after a session ends; vue-query invalidation on navigation back to the dashboard keeps them consistent.

## Open Questions

- Exact post-action navigation targets for Start Session / Mock Exam / 5-min review depend on the downstream `web-session-view` / `web-mock-exam` / `web-progress` route names — use placeholder routes now and reconcile when those changes land.
- Whether the add-cert modal should expose per-cert session-default overrides at enroll time — deferred to `web-onboarding`/`web-settings`; this change enrolls with defaults.
- Whether a future per-user target-exam-date feature should restore the mockup's countdown — out of scope; needs a backend field first.
