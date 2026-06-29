## Context

`apps/web` was bootstrapped by `web-foundation` (Nuxt UI, Tailwind, Pinia, vue-query, a credentialed fetch mutator, typed problem-details, an SSE composable). `web-auth` added the auth store and global route protection. `web-dashboard` built the post-login home and a reusable set of helpers (`statusColor`, `readinessFormat`, `recentSessionSummaries`, dashboard query-key convention, `AddCertificationModal`). `web-cert-detail` added the per-cert deep-dive (cert stat row, full domain breakdown over `certification.domains`, sessions/exam-history tabs, `useExamHistory`, `useSessionsHistory`, `suggestedNextFocus`). `web-session-view` built the in-session quiz loop (`QuizCard`, `QuizOption`, `ConfidenceRating`, `CitationChip`, report/explanation, `SessionSummaryBody`, `sessionViewApi`, `sessionViewQueryKeys`, `runnerRoutes`). `web-mock-exam` added the mock runner and `MockExamDomainBreakdown`.

This change builds the two screens defined by SPEC → Frontend → Progress and SPEC → Spaced Repetition & Review Queue, plus IMPLEMENTATION-ORDER → Phase 10 → `web-progress`: the **Progress page** (weak-area trend, accuracy charts, session history, trajectory, mark-as-mastered) and the **5-minute review run loop** (queue entry → question/confidence loop → completion breakdown). Both are an **assembly layer** over endpoints shipped by archived backend changes (`readiness`, `weak-areas`, `sessions`, `end-of-session-summary`, `review-srs`, `mock-exam`, `quiz`) and already present in the committed Orval client (`apps/web/src/api`). No new API, `yarn codegen`, entities, migrations, crons, or metrics.

Implemented backend contract (verified against the running source):

- `GET /api/v1/user-certifications/:id/readiness` → `{ data: { calibrated: boolean, score: number | null, trajectory: { weeksToReady: number } | null } }`. The **only** readiness shape — a single current value plus an optional trajectory. There is **no per-session / time-series readiness endpoint**. (`apps/api/src/readiness/readiness.controller.ts`)
- `GET /api/v1/user-certifications/:id/weak-areas` → `{ data: WeakArea[], meta }`, each `{ id, domain, score, accuracy, meanConfidence, responseCount }`, ranked. A **current snapshot**, only for domains the user has answered — **no per-domain trend / history series and no per-domain delta**. (`user-certifications.controller.ts` → `WeakAreasService`)
- `GET /api/v1/sessions?certificationId=<Certification.id>&status=&page=&limit=` → `{ data: SessionResponse[], meta }`. `SessionResponse` = `{ id, userCertificationId, kind: 'study'|'review', status: 'active'|'completed'|'partial'|'abandoned', durationMinutes, contentMix, difficulty, focusArea, learningStyle, lastItemIndex, startedAt, endedAt }` — **no `accuracy`, no question count, no per-session domain, no `kind` query param**. (`sessions.controller.ts`)
- `GET /api/v1/sessions/:id/summary` → `{ data: { questionsAnswered, accuracy, domains[], weakAreaDeltas[], readiness: { before, after, delta }, strongestQuestion, weakestQuestion, nextFocus } }` — the source of per-session **accuracy, question count, readiness-after (for the trend line), and per-domain deltas**. `409` while a session is still active; absent for sessions that never completed. (`session-summary.controller.ts`)
- `GET /api/v1/user-certifications/:id/review` → `{ items: ReviewItem[], meta: { dueCount, total } }`, each item `{ id, userCertificationId, anchorChunkId, domain, box, state, dueAt, lastReviewedAt }`. (`review.controller.ts`)
- `POST /api/v1/user-certifications/:id/review/start` → `{ data: { status: 'started', session } | { status: 'all_caught_up' } }`. The `session` is a `review`-kind `StudySession` with pre-generated quiz items, capped at `REVIEW_SESSION_QUESTION_CAP`. (`review.controller.ts` / `review.service.ts`)
- `POST /api/v1/user-certifications/:id/review/suppress-domain` `{ domain }` → `{ data: { suppressedCount } }`. Sets `state: 'suppressed'` on all the domain's review items. **One-way — no un-suppress endpoint.**
- `POST /api/v1/review-items/:id/master` → `{ data: ReviewItem }`. Retires one concept (`state: 'suppressed'`). **One-way.**
- `POST /api/v1/quiz/:questionId/submit` `{ userCertificationId, answer, confidence: 1–5, timeTakenMs }` → `{ data: SubmitAnswerResponse }`. Emits `QuizAnsweredEvent`, consumed by `ReviewAccrualService`, which applies the Leitner schedule from **correctness + confidence**. Plus `quiz/:id/explanation` and `quiz/:id/report`. (`quiz.controller.ts`, `review-accrual.service.ts`, `leitner.ts`)
- `GET /api/v1/user-certifications/:id/mock-exams` → `{ data: MockExamResponse[], meta }` — the mock/diagnostic attempts for the history table.

## Goals / Non-Goals

**Goals:**
- A Progress page per `UserCertification` with a cert-switcher: derived readiness-over-time trend, derived quiz-accuracy chart, per-domain scores (status-coloured) with deltas and mark-as-mastered, passive trajectory call-out, and a merged session-history table.
- A standalone 5-minute review run loop: due-queue entry (by domain) → quiz-question + confidence loop (reusing the session-view surfaces) → completion breakdown (reusing `SessionSummaryBody`) → drill-my-misses.
- Maximum reuse of the archived `apps/web` helpers/components; new logic confined to small, unit-tested derivation composables.

**Non-Goals:**
- Any backend change, new endpoint, entity, migration, cron, metric, or `yarn codegen`.
- A real time-series readiness/accuracy store, a per-domain trend history, an un-suppress/un-master path, a self-graded Again/Hard/Good/Easy SRS rating, an enforced review countdown timer, or a "This month" usage/streak aggregate — none exist in the contract (see reconciliation).
- The in-session study runner, mock runner, dashboard, and cert-detail pages (owned by their own archived changes) — this change links to those routes via `runnerRoutes`.

## Visual Design

Visual source of truth: the canonical artboards committed in the shared design mirror — `../../design/Progress.html` and `../../design/QuickReview.html` (they render over HTTP next to `app-shell.jsx` and the `_ds/` token bundle). The `DesignSync` connector is **not used** here (absent from this toolset) and **no per-change copies** are made; the design files are referenced in place and never modified.

| Artboard / screen | Maps to |
|---|---|
| `../../design/Progress.html` → header + `CertTabs` | Progress page header and cert-switcher |
| `../../design/Progress.html` → `ReadinessChart` (line + 80% target + projection) | Readiness-over-time trend (SVG line; series derived from session summaries) |
| `../../design/Progress.html` → `AccuracyBars` | Historical quiz-accuracy bar chart (derived from session summaries) |
| `../../design/Progress.html` → `TrajectoryCallout` / `TrajectoryInsufficient` | Passive trajectory call-out (driven by `readiness.trajectory`) |
| `../../design/Progress.html` → `DomainRow` | Per-domain score rows + mark-as-mastered |
| `../../design/Progress.html` → `SessionHistoryTable` | Merged session + mock history table |
| `../../design/Progress.html` → `UsageStats` ("This month") | See reconciliation — no backend source |
| `../../design/QuickReview.html` → `QueueEntry` | Review queue-entry screen |
| `../../design/QuickReview.html` → `CardFrontScreen` / `CardBackScreen` | Per-item review step (mapped to the quiz-card + confidence loop, not a flashcard) |
| `../../design/QuickReview.html` → `SRSButton` row | See reconciliation — no Again/Hard/Good/Easy enum |
| `../../design/QuickReview.html` → `CompletionScreen` | Review completion breakdown (mapped to `SessionSummaryBody`) |
| `../../design/QuickReview.html` → `ReviewHeader` | Review run-loop header (progress + cert chip; countdown is decorative) |

**Layout to implement:** the Progress page is a standard sidebar + scroll content layout reusing the app shell (`AppNavBar`/sidebar) and the `web-cert-detail` section-label/status-colour conventions. The review run loop is a focused full-width flow (its own header, no agent panel) reusing the `web-session-view` quiz surfaces and `SessionSummaryBody`. Build the trend SVGs (`ReadinessTrend`, `AccuracyBars`) once as presentational components fed by derivation composables.

### Design ↔ contract reconciliation

The mockups were drawn ahead of the API. Behavioral spec + the implemented backend contract win on every divergence below.

| Design element | Conflict with contract | Resolution |
|---|---|---|
| `QuickReview` **flashcard** front→reveal→back | Backend review session is a `review`-kind `StudySession` of **quiz questions** ("the existing quiz pipeline generates a fresh question from that chunk"), answered via `quiz/:id/submit`. There is no reveal-answer flashcard. | Run the loop as the `web-session-view` quiz-card flow (`QuizCard` + `QuizOption` + `ConfidenceRating` + `CitationChip` + report/explanation). Keep the design's focused, single-card-at-a-time framing and `ReviewHeader` progress; drop front/reveal/back. |
| `SRSButton` **Again / Hard / Good / Easy** self-rating with interval preview | **No such enum exists.** Leitner scheduling (`leitner.ts`, `review-accrual.service.ts`) is driven by **correctness + confidence (1–5)** from the submitted quiz answer; `correct && confidence≥3` promotes a box, `wrong` resets to box 1, `correct && confidence≤2` holds. Box intervals are server-side; the client cannot preview the next interval. | Replace the 4-button self-rating with answer-the-question + the existing 1–5 `ConfidenceRating`. Do not show a per-button next-interval preview. (If a future change wants Anki-style self-grading, that is a backend change introducing a rating enum.) |
| `QueueEntry` **"Review all 23"** (beyond the due set) and **per-card "Skip"** | `review/start` pulls only *due* items capped at `REVIEW_SESSION_QUESTION_CAP`; there is no "review all" or per-item skip endpoint. | Offer only "Start review" (the capped due set). Omit "Review all"/"Skip" unless/until a backend affordance exists. Keep the due count + per-domain breakdown (derivable from queue items' `domain`). |
| `ReviewHeader` **5:00 countdown timer** (`timeUrgent`) | The review session is a `StudySession`, not a wall-clock-deadlined `MockExam`; no countdown is enforced server-side. | Render the header progress (current/total) and cert chip; treat "~5 min" as informational copy, not an enforced countdown. Reuse `useElapsedTimer` for an optional elapsed display, not a deadline. |
| `CompletionScreen` **Again/Hard/Good/Easy bucket tally** + "next due tomorrow/in 2 days" | No per-rating buckets exist; completion data is the end-of-session summary (`sessions/:id/summary`: accuracy, domain breakdown, readiness change). Next-due previews are not returned. | Render the completion via the reused `SessionSummaryBody` for the review session. The "Drill the Again cards" CTA maps to the existing **"Drill my misses"** action (end-of-session-summary). Drop the rating-bucket bar and the precise next-due forecast (or show the queue's current `meta` counts only). |
| `Progress` **"This month" usage card** (Sessions / Questions answered / Study time / Current streak) | **No per-user usage/streak/study-time endpoint.** Sessions count is derivable from the list; questions answered would require summing every summary; `durationMinutes` is the *configured* length, not elapsed time; **streak has no source at all.** | Drop the streak metric. Show only honestly-derivable figures: session count (from the list `meta.total`) and, optionally, questions-answered summed from the bounded summary fan-out already loaded for the table. Do not fabricate study-time or streak. |
| `Progress` readiness **time-series line** + **80% target line** | No time-series endpoint; readiness gives a single current value. `passingScore` is an exam-score threshold, not a readiness target. | Derive the line from completed-session summaries' `readiness.after`, ending at the current `readiness.score`. Treat the 80% "target" line as a fixed decorative reference (not a real per-cert threshold) or omit it; never present it as a backend target. |
| `Progress` **per-domain delta** ("↑7%") on every domain row | Weak-areas snapshot carries **no delta**; only the latest session summary's `weakAreaDeltas` carries change. | Show the delta only for domains present in the latest completed summary's `weakAreaDeltas`; omit it elsewhere. |
| `Progress` **"Mastered" domain section** + **"Unretire"** button | There is no "mastered" state on `WeakArea`, and **no un-suppress endpoint.** Domain mastery maps to `suppress-domain` (one-way) over `ReviewItem`s, not a `WeakArea` flag. | "Mark mastered" on a domain calls `suppress-domain` and invalidates queries; render the retired state from the resulting empty/suppressed review queue. Omit the functional "Unretire" control (no endpoint); if shown, disable with explanatory copy. |
| `Progress` **`CardFront` hint** field | Quiz questions are not guaranteed to carry a separate "hint". | Use only fields present on the generated quiz question; omit the hint affordance if absent. |
| `SessionHistoryTable` **Type "Mock"** rows alongside study | Sessions list and mock-exams are **separate endpoints**; the list has no mock rows and no `kind`/`type` query param. | Merge `sessionsControllerList` (study/review) with `enrollmentMockExamControllerList` (mock/diagnostic) client-side, sort by start time, render type pills; link mock rows into the mock review route via `runnerRoutes`. |

**Keep from the design intent:** the cert-switcher tabbed Progress page; the readiness trend with a passive projection; the status-coloured per-domain score rows with mark-as-mastered; the full session-history table with type pills, accuracy, and readiness delta; and a focused, single-question-at-a-time review run loop ending in a completion breakdown with a drill-my-misses follow-up.

## Test Boundaries

Outside-in TDD. The e2e (Playwright) acceptance test drives the real Nuxt app with the backend HTTP layer mocked (the established `apps/web` pattern — mocked `fetch`/route fulfilment of the Orval endpoints), exactly as `web-dashboard`/`web-cert-detail`/`web-session-view` e2e tests do. Derivation logic is unit-tested in isolation.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| NestJS API (readiness / weak-areas / sessions / session-summary / review / quiz / mock-exam) | HTTP mock (Playwright route fulfilment / mocked `fetch`) returning contract-shaped DTOs | not called (logic tested against fixture DTOs) |
| Orval-generated vue-query client | real (generated client against the mocked HTTP) | n/a |
| Auth store + route protection (`web-auth`) | real store, authenticated test session | n/a |
| Trend/accuracy/usage derivation, history merge, domain-join, due-domain breakdown composables | exercised via the page | real (pure functions over fixture DTOs) |
| Reused components (`QuizCard`, `ConfidenceRating`, `CitationChip`, `SessionSummaryBody`, `statusColor`, `readinessFormat`, `recentSessionSummaries`, `runnerRoutes`) | real | real / shallow-mounted |
| Vue Query cache / network timing | real | n/a |

## Decisions

- **Assemble over existing endpoints; no codegen.** Every datum is already exposed and present in the committed client. Confirmed methods: `readinessControllerRead`, `userCertificationsControllerListWeakAreas`, `userCertificationsControllerList`/`Detail`, `certificationsControllerDetail`, `sessionsControllerList`, `sessionSummaryControllerSummary`, `enrollmentReviewControllerQueue`/`Start`/`SuppressDomain`, `reviewItemsControllerMaster`, `quizControllerSubmitAnswer`/`GenerateExplanation`/`ReportQuestion`, `enrollmentMockExamControllerList`. A task asserts their presence before building. _Alternative:_ add time-series/usage endpoints — rejected: out of this frontend change's scope and the roadmap explicitly slices backend before frontend.
- **Derive trend/accuracy/usage from per-session summaries.** No time-series store exists; the honest series is the ordered `readiness.after` / `accuracy` from completed-session summaries, reusing the `recentSessionSummaries` bounded fan-out. _Alternative:_ fabricate a synthetic series or block on a new endpoint — rejected.
- **Review loop = quiz loop, not flashcard.** The backend review session is quiz-question based and scheduled by correctness+confidence; reusing the `web-session-view` quiz surfaces is both correct to the contract and maximal reuse. _Alternative:_ build a bespoke flashcard component matching the artboard — rejected (no backend reveal/rating model).
- **Mark-as-mastered maps to suppress-domain / review-items master, one-way.** Domain rows use `suppress-domain`; the per-concept master action lives inside the review loop. No un-retire UI is wired. _Alternative:_ model a reversible mastery toggle — rejected (no endpoint).
- **Reuse helpers, isolate new logic.** `statusColor`, `readinessFormat`, `recentSessionSummaries`, `runnerRoutes`, `useSessionsHistory`, `useExamHistory`, `suggestedNextFocus` are imported; new pure logic (trend builder, history merge/sort, domain-join, due-domain breakdown) lives in co-located unit-tested composables, not components. Progress query keys follow the established per-change scheme.

## Risks / Trade-offs

- **Summary fan-out request volume** (one `summary` call per completed visible/charted session) → bound to the visible history page and the charted recent window; cache per session id via vue-query so paging back is free; rows/points without a summary degrade to "—" rather than blocking.
- **Derived trend can differ from a future real readiness history** → label it as derived from session results; the current value still comes authoritatively from `readinessControllerRead`.
- **Design divergence is large for QuickReview** (flashcard/SRS-rating vs quiz/confidence) → the reconciliation table is the contract; reviewers should check the implemented loop against it, not pixel-match the artboard.
- **One-way mastery** can surprise users expecting to un-retire → omit/disable the un-retire control with explanatory copy; revisit if a backend reversal lands.

## Open Questions

- Should the 80% target line on the readiness trend be shown as a fixed decorative reference or dropped entirely? (Leaning: drop or clearly de-emphasise, since it is not a real per-cert readiness threshold.)
- Should the "This month" card survive at all once streak/study-time are removed, or collapse into the existing trend header counts? (Leaning: keep only session count + questions-answered, derived from already-loaded summaries.)
- Exact Progress/review route paths (`pages/user-certifications/[id]/progress.vue`, `.../review.vue`) and their alignment with the `runnerRoutes` helper — settle when wiring navigation from the dashboard/cert-detail.
