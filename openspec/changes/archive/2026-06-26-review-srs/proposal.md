## Why

A time-constrained learner retains more per minute when shaky concepts resurface at lengthening intervals instead of re-covering everything. Quiz answering, study sessions, and weak-area aggregation already exist, but nothing turns a wrong-or-unsure answer into scheduled, spaced review. `review-srs` adds the spaced-repetition queue that closes that loop: it accrues shaky concepts, schedules them on a Leitner ladder, and lets the user clear due items in a 5-minute standalone review or woven into a normal session.

## What Changes

- New `ReviewModule` in `apps/api` owning the `ReviewItem` entity (table + migration) — spaced-repetition state per `UserCertification`, anchored to the source `ContentChunk` a question was generated from.
- **Accrual**: on quiz answer submission, a concept enters the queue when the answer is **incorrect**, or **correct with low confidence (1–2)**. Confident-correct concepts not already queued stay out. (Diagnostic misses also seed the queue, but the diagnostic change wires that later — this change exposes the accrual entry point only.)
- **Leitner schedule**: boxes with intervals `1d → 3d → 7d → 16d → 35d` (configurable). On each review answer: correct+confident (≥3) → promote one box and reschedule at the new interval; wrong → reset to box 1; correct-but-unsure (1–2) → hold the current box and reschedule at the short interval; promoted past the top box → `state: mastered` and exit the queue.
- **Due queue read model**: expose the due-item count and the due list per `UserCertification` (state `active`, `dueAt <= now`).
- **Standalone "5-minute review"**: creates a quiz-only `review`-kind `StudySession` (reusing `SessionsModule`'s creation path) pulling only due items, capped ~5–7 questions, no reading blocks. Each due item generates a **fresh** question from its anchor chunk via the existing quiz pipeline (varied format/difficulty, never a verbatim repeat). When nothing is due, return an "all caught up" empty state that offers a normal session instead. Honors the one-active-session-per-enrollment invariant (spanning `study` + `review` kinds) already enforced by `SessionsModule`.
- **Woven-into-sessions front-loading**: the "spaced repetition" learning style front-loads due `ReviewItem`s at the start of a normal session before new material. The `sessions` change explicitly deferred this here — `SessionPlanner` consumes a due-items provider from `ReviewModule` when `learningStyle` is spaced-repetition.
- **Mark-as-mastered / suppress**: endpoints to manually retire a single concept or an entire domain → sets `state: suppressed`, removing it from both the review queue and new-material selection.
- **Re-anchoring on supersession**: when a `ReviewItem`'s anchor chunk is superseded, re-anchor to `supersededById` where lineage exists; otherwise on next due-generation retrieve a fresh chunk for the same concept/domain via semantic search; if nothing clears the similarity threshold, **hold** the item (may trigger `fetchMoreMaterial`) rather than silently dropping it.
- Review answers are ordinary `QuizResponse`s, so they feed weak areas and readiness through the existing scoring path — no special path. Cold-start: the queue is empty until the user answers quizzes or takes the diagnostic.
- All review resources enforce repository-layer ownership scoping on `userId`; cross-user access returns `404`.

## Capabilities

### New Capabilities
- `spaced-repetition`: `ReviewItem` ownership + accrual, the Leitner schedule, the due-queue read model, the standalone 5-minute `review`-kind session, mark-as-mastered/suppress, and re-anchoring on chunk supersession.

### Modified Capabilities
- `study-sessions`: the "spaced repetition" learning style now front-loads due `ReviewItem`s before new material (a behavior the `sessions` change deferred to this change). The `SessionPlanner` consumes `ReviewModule`'s due-items provider.

## Impact

- **Entities owned (new table + migration):** `ReviewItem` (FK to `UserCertification`, anchor FK to `ContentChunk`, Leitner `box`, `dueAt`, `lastReviewedAt`, `state` enum `active`|`mastered`|`suppressed`). `StudySession.kind: review` already exists (owned by `sessions`) — exercised here, not migrated.
- **API:** new endpoints under `/api/v1` — get the review queue + due count for an enrollment, start a standalone 5-minute review (action creating a `review`-kind session), mark a `ReviewItem` mastered/suppressed, and a domain-level suppress. Orval client regenerated and committed.
- **Depends on:** `quiz` (fresh question generation, scoring, `QuizResponse`), `sessions` (`review`-kind `StudySession` creation, one-active invariant, `SessionPlanner`), `weak-areas` (review answers feed aggregation). All archived.
- **Consumed downstream by:** `diagnostic` (seeds queue from misses), `end-of-session-summary` ("Drill my misses" enqueues concepts), `readiness`/`email-lifecycle`/`web-progress` (mark-as-mastered, due counts).
- **No worker cron and no new Prometheus metric** are owned here — due scheduling is data-driven via `dueAt`, and `ReviewItem` hard-purge belongs to the `users` cron.
- **Boundaries kept out of scope:** diagnostic-miss seeding (`diagnostic`), "Drill my misses" UI action (`end-of-session-summary`), quiz generation/scoring internals (`quiz`), session lifecycle internals (`sessions`).
