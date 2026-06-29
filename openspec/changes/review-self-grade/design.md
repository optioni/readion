# Design — review-self-grade

## Context

`spaced-repetition` (archived `review-srs`) owns `ReviewItem` and a Leitner model (boxes `1d → 3d → 7d → 16d → 35d`, config-driven) whose schedule advances from **quiz correctness + confidence**: correct+confident → promote, correct-but-unsure → keep, wrong → reset. The session/review design shows Anki-style Again/Hard/Good/Easy self-assessment buttons, but those have no backend, so `web-progress` runs the quiz+confidence path. This change adds an explicit self-grade entry point that reuses the same Leitner machinery.

## Approach

- **API**: add a self-grade action on a due `ReviewItem` — `POST /api/v1/review-items/:id/grade` with `{ grade: again|hard|good|easy }` (or extend the existing review-answer action; pick whichever fits the current `ReviewModule` controller shape — confirm in task 1). The handler:
  - Verifies ownership (item belongs to the caller's `UserCertification`) and that the item is due; else `403`/`404`/`409`.
  - Maps grade → Leitner transition reusing the **existing** box-interval config and promotion/mastery logic (do not fork the scheduler): `again`→box 1, `hard`→keep, `good`→promote 1, `easy`→promote (config may define a skip); top-box promotion → `mastered` + leave due queue.
  - Updates `box`, `dueAt`, `lastReviewedAt`, `state`.
- **Shared**: a `ReviewGrade` enum + request DTO in `@readion/shared`.
- **No entity/migration**: reuses `ReviewItem`; intervals stay in config.
- **Web**: `web-progress` review loop wires the reveal-step buttons to the endpoint.

## Test boundaries

- **Unit**: the grade→box mapping, table-driven over the configured intervals (again/hard/good/easy across boxes incl. top-box mastery). Pure logic — strongest place to pin the transitions.
- **Integration (Testcontainers)**: endpoint persists the transition + due-queue effects; ownership/not-due/invalid-grade rejections; mastery leaves the queue.
- **e2e (Playwright)**: review loop reveal → tap a grade → advances → completion breakdown.
- **Outside-in order**: e2e RED → integration RED → unit RED → implement.

## Decisions

- **One scheduler, two entry points**: self-grade reuses the existing Leitner promotion/reset logic; it must not duplicate or diverge from the quiz+confidence path's box math.
- **Additive**: the quiz+confidence review path is unchanged.

## Open questions (product calls — resolve in this change's review)

- Does a review session offer self-grade AND quiz+confidence, or does the user pick a mode per session? The spec allows either; the frontend needs one answer.
- Does `easy` skip one box or two? Pin it in config + the unit mapping table.
