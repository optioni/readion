## Why

A time-constrained learner needs one place to see whether their effort is paying off and to top up retention in spare moments. The backend already exposes readiness, weak-area, session-history, and spaced-repetition data (all archived), but `apps/web` has no Progress page and no "5-minute review" run loop — the two screens SPEC → Frontend → Progress and SPEC → Spaced Repetition & Review Queue call for. This change builds both as an assembly layer over the existing API; no new backend.

## What Changes

- A **Progress page** (per enrolled certification, cert-switcher tabs) rendering: a passive **readiness-over-time** trend, **historical quiz-accuracy** chart, **per-domain scores** with deltas and a **mark-as-mastered** action, a passive **readiness trajectory** call-out ("exam-ready in ~N weeks"), and a full **session-history** table merging study sessions and mock/diagnostic attempts.
- A **5-minute review run loop** (`QuickReview`): queue-entry screen (items due, by domain) → per-item question card → answer + confidence → next, ending in a **completion breakdown** reusing the session-summary surface, with a "drill my misses" follow-up.
- Both screens are **assembly over archived endpoints** — they reuse the established `apps/web` patterns from `web-dashboard` / `web-cert-detail` / `web-session-view` (query-key composables, `statusColor`, `readinessFormat`, `recentSessionSummaries`, `runnerRoutes`, `QuizCard` / `ConfidenceRating` / `CitationChip`, the reused `SessionSummaryBody`, markdown/citation rendering) rather than introducing new primitives.
- Trend/accuracy/usage series and per-session readiness are **derived client-side** from per-session summaries (no time-series endpoint exists); derivation logic lives in co-located, unit-tested composables.
- **No** new API, entities, migrations, crons, metrics, or `yarn codegen` — every consumed endpoint is already in the committed Orval client.

## Capabilities

### New Capabilities
- `web-progress`: the `apps/web` Progress page (readiness/accuracy trend, per-domain scores + mark-as-mastered, trajectory, session history) and the standalone 5-minute review run loop (due-queue entry → question/confidence loop → completion breakdown), assembled over the readiness, weak-areas, sessions, session-summary, review (spaced-repetition), and mock-exam APIs.

### Modified Capabilities
<!-- None — this is a frontend assembly change; no backend spec requirements change. -->

## Impact

- **New frontend code** in `apps/web/app`: a Progress page (`pages/user-certifications/[id]/progress.vue` or equivalent) and a review run-loop page (`pages/user-certifications/[id]/review.vue`), plus co-located components and derivation composables; query keys under the established scheme.
- **Consumed APIs** (all already in `apps/web/src/api`, no regeneration): `readinessControllerRead`, `userCertificationsControllerListWeakAreas`, `userCertificationsControllerList`/`Detail`, `sessionsControllerList`, `sessionSummaryControllerSummary`, `enrollmentReviewControllerQueue`/`Start`/`SuppressDomain`, `reviewItemsControllerMaster`, `quizControllerSubmitAnswer`/`GenerateExplanation`/`ReportQuestion`, `enrollmentMockExamControllerList`.
- **Reconciliation required** against the canonical artboards `../../design/Progress.html` and `../../design/QuickReview.html`: the QuickReview flashcard + Again/Hard/Good/Easy self-rating metaphor and the Progress "This month" usage card have no backing contract and must be mapped to the implemented quiz-answer + confidence model / derived data or dropped (behavioral spec + real contract win).
- **No** changes to `apps/api`, `apps/worker`, `packages/db`, or `packages/shared`.
