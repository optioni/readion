## Context

`apps/web` was bootstrapped by `web-foundation` (Nuxt UI, Tailwind, Pinia, vue-query, a credentialed fetch mutator, typed problem-details, an SSE composable), `web-auth` added the auth store and global route protection, and `web-dashboard` built the post-login home (the vertical cert-card list) plus a reusable set of dashboard helpers. This change builds the **per-certification deep-dive** reached from that home: the cert-detail page defined by SPEC → Frontend → Dashboard (cert detail) and SPEC → Layout Decisions, and by IMPLEMENTATION-ORDER → Phase 10 → `web-cert-detail` (Overview tab + Sessions tab + exam-history).

Every datum the page renders is already exposed by archived backend changes and present in the committed Orval client (`apps/web/src/api`). The page is an **assembly layer** over those endpoints — no new API, no `yarn codegen`, no entities, migrations, crons, or metrics.

### Implemented backend contract (verified against the NestJS controllers)

- `GET /api/v1/user-certifications/:id?include=weakAreas` → `{ data: { id, certificationId, status, enrolledAt, sessionDefaults, readinessScore: number | null }, relationships: { weakAreas: { href, data?: WeakArea[] } } }`. The enrollment row carries `certificationId` only (no cert name/provider). (`apps/api/src/user-certifications/user-certifications.controller.ts`)
- `GET /api/v1/certifications/:id` (`@Public`) → `{ data: { id, name, provider, code, domains[], questionCount, passingScore, timeLimitMinutes, state } }`. The source of certification **name + provider** and the **full domain list** for the per-domain breakdown. (`apps/api/src/certifications/certifications.controller.ts`)
- `GET /api/v1/user-certifications/:id/readiness` → `{ data: { calibrated: boolean, score: number | null, trajectory: { weeksToReady } | null } }`. (`apps/api/src/readiness/readiness.controller.ts`)
- `GET /api/v1/user-certifications/:id/weak-areas` → `{ data: WeakArea[], meta }`, each `{ id, domain, score, accuracy, meanConfidence, responseCount }`, ranked. Includes **only domains the user has answered** — not every certification domain. (`user-certifications.controller.ts` → `WeakAreasService`)
- `GET /api/v1/sessions?certificationId=<Certification.id>&page=&limit=` → `{ data: SessionResponse[], meta: { total, page, limit } }`. `certificationId` filters on the underlying `Certification.id` (available as `enrollment.certificationId`), **not** the enrollment id. `SessionResponse` = `{ id, userCertificationId, kind: 'study'|'review', status: 'active'|'completed'|'partial'|'abandoned', durationMinutes, contentMix, difficulty, focusArea, learningStyle, lastItemIndex, startedAt, endedAt: string|null }` — **no `accuracy` and no single `domain`**. The query DTO accepts only `certificationId`, `status`, `page`, `limit` — **there is no `kind`/`type` query param**. (`apps/api/src/sessions/sessions.controller.ts`)
- `GET /api/v1/sessions/:id/summary` → `{ data: { questionsAnswered, accuracy, domains[], weakAreaDeltas[], readiness: { before, after, delta }, strongestQuestion, weakestQuestion, nextFocus: { domain } | null } }` — the source of per-session **accuracy**, the readiness **delta**, and the **suggested next focus**. `409` while a session is still active; no summary for sessions that never completed. (`apps/api/src/session-summary/session-summary.controller.ts`)
- `GET /api/v1/user-certifications/:id/review` → `{ items[], meta: { dueCount, total } }` — the due-review count for the stat row.
- `GET /api/v1/user-certifications/:id/mock-exams` → `{ data: MockExamResponse[], meta }`, each `{ id, userCertificationId, type: 'mock'|'diagnostic', status: 'in_progress'|'submitted'|'expired', generation, startedAt: string|null, deadline: string|null, remainingSeconds: number|null, score: number|null, passed: boolean|null, domainBreakdown, questions[] }` — enrollment-scoped, the **exam-history** source. (`apps/api/src/mock-exam/mock-exam.controller.ts`)

## Goals / Non-Goals

**Goals:**
- A cert-detail page (`pages/user-certifications/[id]/index.vue`) reached from the dashboard card, with Overview / Sessions / Exam-History tabs.
- Overview: readiness/trajectory stat row, full per-domain status-coloured scores (all cert domains, "no data" where unanswered), suggested next focus, recent sessions with accuracy.
- Sessions: full paginated per-cert history table with a client-side study/review type filter.
- Exam History: mock + diagnostic attempts with type, status, score, pass/fail, and a link into the mock review route.
- An entry point added to the existing dashboard `CertCard`.
- Composables that fan in the per-tab data over the existing client, with reasonable loading/error states; reuse the `web-dashboard` helpers.

**Non-Goals:**
- Any API/backend change, new entity, migration, cron, metric, or Orval regeneration — the contract is consumed as-is.
- A **server-side** session type filter or a per-cert exam-date field (neither exists in the backend — see reconciliation).
- The session runner, mock-exam runner, and review run-loop screens (`web-session-view`, `web-mock-exam`, `web-progress`) — this page links to those routes only.
- Re-implementing the dashboard list, nav chrome, or user menu (owned by `web-dashboard` / `web-foundation` / `web-auth`).
- Charts / trend-over-time visualisations (owned by `web-progress` → Progress page); the cert detail shows current scores and history lists/tables, not trend charts.

## Visual Design

**Design provenance — canonical artboard in shared mirror.** The canonical artboard for this screen is **`CertDetail.html`** in the "Readion app onboarding flow" Claude Design project (`projectId 4526b72d-50eb-4140-8cf3-39f776743a65`). The token-only design system (`projectId 38736cfc-91fa-45ef-8524-8103e746ef9f`) is already wired into `apps/web`. The `DesignSync` connector is **not available to the automated implementer subagents** (it is an interactively-authenticated claude.ai connector, absent from headless/background toolsets), so no reconstructed artboard was fabricated during implementation — correctly. The canonical `CertDetail.html` was subsequently **pulled via `DesignSync get_file` from the interactive session** and stored verbatim in the shared design mirror at **`../../../design/CertDetail.html`** (renders over HTTP next to `app-shell.jsx` + the `_ds` token bundle). The reconciliation table below was checked against this canonical artboard: the Overview (stat row, domain-score bars, suggested-next-focus, recent sessions) and Sessions (history table with type pills) match the implemented layout; the artboard shows an **"Exam history" tab** alongside Overview/Sessions, consistent with the roadmap's third tab. The behavioural spec remains authoritative where the artboard and the implemented backend contract diverge.

This visual section is therefore driven by **SPEC → Frontend (cert detail) + Layout Decisions**, **DESIGN.md token values**, and the **archived `web-dashboard` component patterns** (the canonical design system tokens are already wired in via `app/design/tokens.ts`).

**Layout to implement** (DESIGN.md → Layout, Colors, Typography, Shapes):
- Full-height layout with the existing top nav bar; centred max-width container; single column (DESIGN.md → Layout). Section spacing `xl` (24px); internal panel padding `xl`; inline gaps `sm`/`md`.
- **Tab strip** (Overview / Sessions / Exam History) under a page header showing certification name + provider; the active tab uses `text.primary`, inactive `text.secondary`.
- **Panels** use the `surface` background (`#1e293b`), `lg` radius for cards, `md` radius for inner panels; **no `box-shadow` for depth** — depth via background layers (DESIGN.md → Elevation & Depth).
- **Section labels** ("DOMAIN SCORES", "SUGGESTED NEXT FOCUS", "RECENT SESSIONS", "EXAM HISTORY") use the uppercase `label` style (11px/500/0.1em).
- **Readiness percentage** in the stat row uses the `readinessScore` style (28px/700); inline readiness uses the `readinessChip` (`primary.default` bg, white, `full` radius).
- **Domain scores** use the status-colour scale via the reused `statusColorForScore` helper: `<50` poor (`#f87171`), `50–65` warning (`#fb923c`), `65–80` medium (`#fbbf24`), `>80` good (`#34d399`) — coloured text on transparent, matching the dashboard weak-area badges. No decorative colour.
- **Tables/lists** (sessions history, exam history) are minimal rows separated by `border.default`; status/type rendered as inline pills; no row shadows.
- The hero gradient is **not** used on this page (reserved for the dashboard's lowest-readiness hero card only — DESIGN.md → Do's and Don'ts).

### Design ↔ contract reconciliation

This table reconciles the **SPEC/roadmap intent** (now confirmed against the canonical `../../../design/CertDetail.html` artboard) against the **implemented backend contract**. The behavioural specs win; resolve as follows.

| Element (SPEC/roadmap intent) | Conflict with contract | Resolution |
|---|---|---|
| Sessions-tab **type filter** (study/review) | `GET /sessions` has no `kind`/`type` query param — only `certificationId`/`status`/`page`/`limit` | Filter **client-side** over `SessionResponse.kind` on the loaded rows. The filter is a view over the currently-loaded page(s); document that it does not change the server query. (If a server-side kind filter is wanted later, it is a backend change of its own.) |
| Sessions table showing **accuracy** per row | `SessionResponse` has no `accuracy`/`domain` — only `focusArea` | Fetch `GET /sessions/:id/summary` for **completed** rows on the **visible page only** (bounded fan-out, like the dashboard's ≤3 cap but page-sized); rows without a summary (active/abandoned) show a "—" accuracy. |
| Overview **recent sessions** with accuracy | same as above | Reuse the `web-dashboard` `fetchRecentSessionSummaries` helper (bounded to the last 3 completed). |
| **Suggested next focus** | No dedicated "suggested session/focus" endpoint | Derive from the most recent completed session's `summary.nextFocus.domain`; fall back to the lowest-scoring weak-area domain. Informational only — never invent a deadline (SPEC: trajectory is passive, no dates). |
| **Domain scores** for every cert domain | `GET /:id/weak-areas` returns only domains the user has answered, not the full `certification.domains` list | Render one row per `certification.domains` entry; populate the score/colour from the matching weak-area record, and show a neutral "no data yet" for domains with no record. |
| Readiness shown as a number with little signal | SPEC: below the calibration bar readiness is **"not yet calibrated"**, not a misleading number | When `readiness.calibrated === false` (equivalently `readinessScore === null`), render "not yet calibrated" via the reused `formatReadiness` helper; suppress the trajectory line if absent. |
| Per-cert **exam-date countdown** ("Exam in N days") | No per-user exam-date field on `UserCertification` or `Certification` | **Omit** (same resolution as `web-dashboard`). A target-date feature would be a backend change first. |
| Passive **trajectory** ("exam-ready in ~N weeks") | Only `readiness.trajectory.weeksToReady` exists | Render the informational line only when `trajectory` is present; no dates, no reminders (SPEC: informational only). |
| **Exam history** rows with full question payloads | `GET /:id/mock-exams` returns each attempt's full `questions[]` | Use only the header fields (type/status/score/passed/startedAt/domainBreakdown) for the list; note the payload weight — acceptable for the typical low attempt count, revisit if it grows. |
| App/nav chrome, user menu | Owned by `web-foundation` shell + `web-auth` | Reuse the existing shell/nav; this change adds only the dashboard-card → detail link and the page itself. |

**Keep from the SPEC intent:** the tabbed deep-dive (Overview / Sessions / Exam History), the readiness/trajectory stat row, the full status-coloured per-domain breakdown, the suggested-next-focus call-out, the recent-sessions list with accuracy, the complete paginated session-history table with a study/review filter, and the mock/diagnostic exam-history list with status and pass/fail.

## Test Boundaries

Acceptance tests are Playwright e2e specs in `apps/web/e2e/` running the real Nuxt app against the real NestJS API + Postgres + Redis (Testcontainers / docker-compose), per CLAUDE.md outside-in TDD (no DB mocking in integration). Component/composable unit tests (Vitest + `@nuxt/test-utils`) mock the HTTP layer. The `web-dashboard` seed helper (`apps/web/e2e/support/dashboard-seed.ts`) is reused/extended to land on a cert's detail page.

| Dependency | In acceptance test (Playwright e2e) | In unit tests (Vitest) |
|---|---|---|
| NestJS user-certifications / certifications / readiness / weak-areas / sessions / session-summary / review / mock-exam API | real (running API) | HTTP mock (mocked `fetch` / MSW) |
| Postgres + Redis | real (Testcontainers / docker-compose) | not involved |
| Seed state (enrolled cert, weak areas, sessions, mock/diagnostic attempts, due reviews) | seeded via the real API (+ direct rows where the LLM path can't run locally, as in `dashboard-seed.ts`) | fixture DTOs |
| Auth store + route protection (`web-auth`) | real (authenticated session) | real store / stubbed route |
| Generated Orval client | real | mocked at the fetch layer |
| Status-colour / readiness-format / type-filter / next-focus logic | exercised via rendered UI | unit-tested as pure functions |

## Decisions

- **No `yarn codegen`.** Every endpoint the page consumes (`userCertificationsControllerDetail`, `certificationsControllerDetail`, `readinessControllerRead`, `userCertificationsControllerListWeakAreas`, `sessionsControllerList`, `sessionSummaryControllerSummary`, `enrollmentReviewControllerQueue` (due count via `meta.dueCount`), `enrollmentMockExamControllerList`) is already in the committed client. A task asserts they exist before building. Skipping codegen avoids a needless regeneration diff.
- **Client-side type filter.** The sessions list endpoint exposes no `kind`/`type` param, so the Study/Review filter is a pure view over `SessionResponse.kind` on the loaded rows. Documented as a known limitation (it filters the loaded page, not the server query); a server-side filter would be a separate backend change.
- **Bounded summary fan-out.** Accuracy is not on the session list; it comes from per-session summaries. The Overview reuses the dashboard's ≤3 bound; the Sessions tab fetches summaries for completed rows on the **visible page only** to keep request volume proportional to what's on screen.
- **Domain breakdown is over `certification.domains`, not the weak-area list.** Weak areas only cover answered domains; iterating the certification's full domain list and joining the weak-area record gives an honest "every domain, with a 'no data' state" view (matches SPEC → Weak Area Tracking surfacing).
- **Suggested next focus is derived, not fetched.** No endpoint returns it; the latest completed session's `summary.nextFocus` is the primary signal, with the lowest weak-area domain as the fallback (SPEC: "suggested next session based on weak areas and last session").
- **Reuse over re-implement.** `statusColor`, `readinessFormat`, `recentSessionSummaries`, `runnerRoutes`, and the dashboard query-key convention are imported from the archived `web-dashboard`; cert-detail adds its own query keys under the same scheme. Pure logic (type filter, next-focus selection, domain join) lives in co-located unit-tested helpers, not in components.
- **Route + entry point.** The page lives at `/user-certifications/:id` (`pages/user-certifications/[id]/index.vue`), sibling to the review run loop the dashboard already routes to (`/user-certifications/:id/review`). The dashboard `CertCard` header becomes a link to it — the only change to dashboard code.

## Risks / Trade-offs

- **Sessions-table request volume** (one summary per completed visible row) → bound to the visible page; use vue-query caching keyed per session id so paging back is free; rows without summaries render without accuracy rather than blocking.
- **Client-side type filter vs. pagination** → filtering a single loaded page can show fewer than `limit` rows after filtering. Mitigation: keep the filter a clearly-scoped view of loaded rows; if this proves confusing, a follow-up backend `kind` param closes the gap (out of scope here).
- **Mock-exam list payload weight** (full `questions[]` per attempt) → acceptable at typical attempt counts; only header fields are rendered. Flagged for revisit if attempts grow large.
- **Design provenance** → canonical `CertDetail.html` pulled via `DesignSync get_file` (interactive session) and stored in the shared mirror at `../../../design/CertDetail.html`; visuals follow it plus DESIGN.md tokens and the dashboard patterns. Reconciliation table checked against the artboard — matches.

## Open Questions

- Exact downstream route names for a session row, a mock-exam review, and the review run loop depend on `web-session-view` / `web-mock-exam` / `web-progress`; reuse the `runnerRoutes` helper and reconcile when those land.
- Whether Exam History should be a third tab or a section within Overview — modelled here as a third tab per the roadmap's explicit "exam-history"; **the canonical `CertDetail.html` artboard confirms a third "Exam history" tab** (alongside Overview/Sessions), so the third-tab modelling stands.
- Whether a future per-user target-exam-date should add a countdown to the stat row — out of scope; needs a backend field first.
