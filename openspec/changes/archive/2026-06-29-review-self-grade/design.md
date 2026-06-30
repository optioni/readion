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

## Resolved decisions (were open questions)

- **Endpoint shape (task 0.0)**: There is no existing "review-answer" action to extend — the quiz+confidence path runs through `POST /api/v1/quiz/:id/submit` + the `QUIZ_ANSWERED_EVENT` listener (`ReviewAccrualService`), not a review action. So self-grade is a **new** action on the existing `ReviewItemsController`: `POST /api/v1/review-items/:id/grade` with `{ grade: again|hard|good|easy }`, sitting alongside the existing `POST /api/v1/review-items/:id/master`. It parses the body with a Zod schema (same `parseBody` helper the controller already uses → `422` with `errors[]` for an invalid grade), verifies ownership via `findOne(ReviewItem, { id, userCertification: { user } })` (`404` when not found/owned), and verifies the item is currently due (`state === 'active'` and `dueAt <= now`) else `409`.

- **Frontend mode (was: self-grade AND quiz, or pick a mode?)**: Self-grade is a **distinct review mode that operates directly on the due review-items queue** (the `ReviewItemResponse[]` already fetched on mount), with **no `StudySession` created**. The review page gains a self-grade entry that iterates the due queue, rendering one reveal card per item; revealing then tapping a grade calls `reviewItemsControllerGrade(id, { grade })`, advances to the next due item, and tallies a local completion breakdown (counts per grade). The existing quiz+confidence session-based "Start review" path is **unchanged** (additive, per the proposal). This keeps the self-grade loop self-contained and avoids disturbing the StudySession path.

- **`easy` promotion (was: skip one box or two?)**: `good` promotes **+1** box; `easy` promotes **+2** boxes (skips one). The skip is config-driven, not hardcoded: a shared `LEITNER_EASY_PROMOTION_DEFAULT = 2` constant in `@readion/shared`, overridable via a new `REVIEW_LEITNER_EASY_PROMOTION` env var (mirroring how `REVIEW_LEITNER_INTERVALS_DAYS` overrides `LEITNER_INTERVALS_DAYS_DEFAULT`). The pure mapping function receives the promotion amount as a parameter so the unit test pins it without hardcoding. Promotion math reuses the existing top-box rule: a next box `> intervals.length` → `state: mastered`, `dueAt` cleared, left out of the due queue (matches `applyLeitner`). So both `good` from the top box and `easy` from the top (or second-from-top) box master the item.

## Grade → Leitner mapping (the transition table to pin in the unit test)

For configured intervals `[1,3,7,16,35]` (5 boxes) and `easyPromotion = 2`:

| grade | from box | → box | state | dueInDays |
|---|---|---|---|---|
| `again` | any | 1 | active | intervals[0] |
| `hard` | n | n | active | intervals[n-1] |
| `good` | n < top | n+1 | active | intervals[n] |
| `good` | top | top | mastered | null |
| `easy` | n where n+2 ≤ top | n+2 | active | intervals[n+1] |
| `easy` | n where n+2 > top | n | mastered | null |

`lastReviewedAt` is set to now on **every** grade. Intervals and the easy-promotion amount come from config, never hardcoded in the mapping.
