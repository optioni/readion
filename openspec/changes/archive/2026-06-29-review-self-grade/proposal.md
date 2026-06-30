## Why

The session/review design shows Anki-style self-assessment buttons (**Again / Hard / Good / Easy**), but the implemented `spaced-repetition` capability schedules purely from **quiz correctness + confidence rating** — the Leitner model promotes on correct+confident, keeps on correct-but-unsure, and resets on wrong. So the design's explicit self-grade control has no backend, and the review loop runs the quiz+confidence path instead. An explicit self-grade review mode gives users a faster, lower-friction way to drive Leitner scheduling on concepts they want to self-assess without answering a full quiz item.

(Surfaced as a flagged follow-up during `web-progress`/review reconciliation: "No SRS Again/Hard/Good/Easy endpoint — the review loop runs the quiz + confidence path.")

## What Changes

- Add an explicit **self-grade** submission for a due `ReviewItem` that maps the four grades onto the existing config-driven Leitner box transitions:
  - `again` → reset to box 1 (box-1 interval).
  - `hard` → keep the current box (current interval).
  - `good` → promote one box.
  - `easy` → promote (optionally skipping a box); promotion past the top box → `state: mastered`, cleared from the due queue.
  - `lastReviewedAt` updated on every grade; intervals stay application-config-driven (no hardcoding), per the existing spec.
- Endpoint: `POST /api/v1/review-items/:id/grade` accepting `grade: again|hard|good|easy` (or extend the existing review-answer action), updating `box`, `dueAt`, `lastReviewedAt`, `state`.
- Keep the existing quiz+confidence review path **unchanged**; this is an additional, explicit grading entry point.
- Frontend: the `web-progress` review loop renders the self-grade buttons against the new endpoint.

## Capabilities

### Modified Capabilities
- `spaced-repetition`: add an explicit self-grade review submission mapping Again/Hard/Good/Easy to the existing Leitner box transitions, alongside the quiz+confidence path; no change to the box intervals or mastery rules.
- `web-progress`: the review loop renders and submits self-grades.

## Impact

- **Code**: `apps/api/src/` review/spaced-repetition module (grade→box mapping + endpoint), `packages/shared` (grade enum + request/response DTO), `apps/web` review components. Unit tests for the grade→Leitner mapping (table-driven over the box intervals), integration tests for the endpoint (due-queue effects, mastery), Playwright e2e for the review loop.
- **API**: new grade endpoint → run `yarn codegen` and commit the client.
- **No new entity**: reuses `ReviewItem`; intervals remain config-driven.
- **Dependencies**: archived `spaced-repetition`, `web-progress`.
- **Open question (product call, resolve in design)**: whether a review session offers self-grade *and* quiz+confidence, or the user picks a mode — and whether `easy` skips one box or two. Decide before sizing.
