## Reviewed Artifacts

- proposal.md
- specs/web-progress/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | The review run loop runs the quiz items of the `review`-kind `StudySession` returned by `enrollmentReviewControllerStart`, which the frontend must load (via `sessionsControllerDetail` with `?include=items`), but the acceptance-test mock set in 0.1 did not name that endpoint — leaving the loop's data source unmocked. | Added `sessionsControllerDetail` (review session items) to the mocked endpoint list. | tasks.md § 0.1 |
| WARNING | tasks.md | The spec scenario "Opening Progress for an enrollment the user does not own" (uniform 404 / no-leak not-found state) had no corresponding acceptance-test task. | Added a failing acceptance-test task for the ownership/404 not-found state; renumbered the fail-for-right-reason confirmation. | tasks.md § 0.5–0.6 |
| SUGGESTION | design.md / specs | Design and spec correctly resolve the largest divergence (QuickReview flashcard + Again/Hard/Good/Easy self-rating vs the implemented quiz-question + confidence 1–5 + server-side Leitner contract). Verified the reconciliation table names each diverging element (flashcard reveal, SRS buttons + interval preview, "Review all"/"Skip", 5:00 countdown, per-rating completion buckets, "This month" streak/study-time, readiness time-series + 80% target, per-domain delta, "Mastered" section + "Unretire", `CardFront` hint, merged Mock rows) and that every spec scenario asserts the contract-true behavior. No change needed. | None (confirmation only). | — |

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved.

- **Capability coverage** — proposal names exactly one new capability (`web-progress`); `specs/web-progress/spec.md` exists and carries it; no Modified Capabilities are claimed (correct — this is a pure frontend assembly change with no backend spec changes); no capability appears only in design/tasks.
- **Scenario coverage** — every spec scenario (Progress reachability + cert-switch + 404; readiness/accuracy trend calibrated vs uncalibrated; trajectory present vs null; domain scores with/without delta; mark-as-mastered domain + no-un-retire; session-history completed/mock/no-summary; review queue due vs all-caught-up; question+confidence submit + report; completion-from-summary) now maps to acceptance-test work in tasks §0 and to a unit/component group in §2–§4.
- **Pinned contract** — every consumed endpoint is confirmed present in the committed Orval client (`apps/web/src/api`), so no `yarn codegen` is required; tasks §1.1 asserts this before building. The SRS rating contract is pinned: there is **no** Again/Hard/Good/Easy enum — answers go through `quizControllerSubmitAnswer` `{ answer, confidence: 1–5, timeTakenMs }` and Leitner scheduling is server-side. Trajectory shape is pinned to `{ weeksToReady } | null`. Mark-as-mastered is pinned to one-way `suppress-domain` (domain) / `review-items/:id/master` (concept). The readiness/accuracy time-series and "this month" usage have no endpoint and are derived from per-session summaries or dropped (streak/study-time), per the reconciliation.
- **Test boundaries** — design.md Test Boundaries names each collaborator (API HTTP-mocked, Orval client real, auth store real, derivation composables real over fixtures); no task invents a mock boundary design.md does not name.
- **Task alignment** — tasks follow outside-in order (acceptance RED → derivation units → page/loop components → nav → outer GREEN → subagent review → polish), include the design-asset references (`../../design/Progress.html`, `../../design/QuickReview.html`) with the reconciliation applied, and end with the mandatory subagent-review and four-task polish groups.

## Deferred Non-Blocking Notes

- Two cosmetic design choices are intentionally left to implementation and recorded as Open Questions in design.md: whether to keep a de-emphasised decorative 80% reference line on the readiness trend, and whether the trimmed "This month" card survives (session count + optional questions-answered only). Neither blocks implementation; both resolve while building Progress §3.
