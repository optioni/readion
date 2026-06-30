## Reviewed Artifacts

- proposal.md
- specs/spaced-repetition/spec.md
- specs/web-progress/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | design.md | Open question: new `POST /review-items/:id/grade` vs. extending a "review-answer" action. Inspecting `ReviewModule` showed there is **no** review-answer action — the quiz+confidence path runs through `POST /api/v1/quiz/:id/submit` + the `QUIZ_ANSWERED_EVENT` listener (`ReviewAccrualService`). "Extend review-answer" was not implementable as written. | Resolved to a new `grade` action on the existing `ReviewItemsController`, alongside `master`, with ownership (`404`), due-check (`409`), and Zod body parse (`422`) reusing the controller's existing `parseBody` helper. | design.md → Resolved decisions (Endpoint shape) |
| CRITICAL | design.md / specs/web-progress | Open question: does a review session offer self-grade AND quiz+confidence, or pick a mode? The frontend needs one answer to be testable. The current review loop is `StudySession`-based (`review.vue` renders `QuizCard`); there is no reveal-step grade UI. | Resolved: self-grade is a distinct mode operating directly on the already-fetched due queue (`ReviewItemResponse[]`), no `StudySession` created; reveal card per item → tap grade → call grade endpoint → advance → local completion breakdown. Quiz+confidence "Start review" path unchanged (additive). | design.md → Resolved decisions (Frontend mode) |
| CRITICAL | design.md | Open question: does `easy` skip one box or two? Unresolved, blocking the unit mapping table and the endpoint. | Resolved: `good` +1, `easy` +2 (skip one); config-driven via shared `LEITNER_EASY_PROMOTION_DEFAULT = 2` + `REVIEW_LEITNER_EASY_PROMOTION` env override, passed as a parameter to the pure mapping fn. Top-box overflow → `mastered`, reusing the existing `applyLeitner` rule. | design.md → Resolved decisions (`easy` promotion) |
| WARNING | design.md | No concrete grade→box transition table existed, so the table-driven unit test (task 2.1) and the integration assertions (task 3.1) had no single source of truth and could diverge. | Added an explicit transition table (every grade × box, incl. top-box mastery and `lastReviewedAt`) for the unit test and endpoint to share. | design.md → Grade → Leitner mapping table |
| SUGGESTION | tasks.md | Task 1.x ("shared contract") implies the `ReviewGrade` enum/DTO but did not name the new easy-promotion config constant the mapping needs. | Captured `LEITNER_EASY_PROMOTION_DEFAULT` (shared) + `REVIEW_LEITNER_EASY_PROMOTION` (env) in design so the shared-contract and config work is unambiguous; no task reorder needed (still fits task 1 + 2). | design.md → Resolved decisions (`easy` promotion) |

## No Remaining Implementation-Blocking Gaps

All three design open questions are resolved against the actual `ReviewModule` shape, the existing `applyLeitner` Leitner logic, and the existing `review.vue` loop. Capability coverage holds: `spaced-repetition` (ADDED self-grade requirement) and `web-progress` (MODIFIED review-loop requirement) each have a spec file, concrete acceptance scenarios, and matching outside-in tasks. Test boundaries (pure-logic unit for the mapping, Testcontainers integration for the endpoint, Playwright e2e with the endpoint mocked) are named and consistent with the existing review test harness. No remaining implementation-blocking planning gaps.

## Deferred Non-Blocking Notes

- The self-grade completion breakdown is a **local** client-side tally over graded items (the self-grade mode creates no `StudySession`, so there is no server-side session summary for it). This is intentional and consistent with the "no new entity / additive" scope in the proposal; the existing quiz+confidence path keeps its server-side `SessionSummary`.
