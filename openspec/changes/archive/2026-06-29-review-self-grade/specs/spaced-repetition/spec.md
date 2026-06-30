## ADDED Requirements

### Requirement: Explicit self-grade review submission

The system SHALL expose an explicit self-grade submission for a due `ReviewItem` accepting `grade` ∈ {`again`, `hard`, `good`, `easy`} (e.g. `POST /api/v1/review-items/:id/grade`), mapping each grade onto the existing config-driven Leitner box transitions and updating `box`, `dueAt`, `lastReviewedAt`, and `state`. This is an additional entry point alongside the existing quiz-correctness + confidence path; the box intervals, mastery rule, and due-queue semantics are unchanged. The mapping SHALL be: `again` → reset to box 1; `hard` → keep the current box; `good` → promote one box; `easy` → promote (skipping configuration-defined boxes if so configured); promotion past the top box → `state: mastered`, cleared from the due queue, not rescheduled. Intervals MUST NOT be hardcoded (reuse application config).

#### Scenario: Good promotes one box

- **WHEN** an authenticated user submits `grade: good` for a due `ReviewItem` in box 2
- **THEN** the item moves to box 3 and `dueAt` is set to box 3's configured interval from now, with `lastReviewedAt` updated

#### Scenario: Again resets to box 1

- **WHEN** a user submits `grade: again` for a due item in box 4
- **THEN** the item resets to box 1 and `dueAt` is set to box 1's interval

#### Scenario: Hard keeps the current box

- **WHEN** a user submits `grade: hard` for a due item in box 3
- **THEN** the item stays in box 3 and `dueAt` is set to box 3's interval

#### Scenario: Easy past the top box masters the item

- **WHEN** a user submits a promoting grade on an item already in the top box
- **THEN** `state` becomes `mastered`, the item leaves the due queue, and it is not rescheduled

#### Scenario: Grading a not-due or non-owned item is rejected

- **WHEN** a user submits a grade for a `ReviewItem` that is not theirs or not currently due
- **THEN** the response is `404`/`403` (ownership) or `409` (not due), and no schedule change occurs

#### Scenario: Invalid grade is rejected

- **WHEN** the `grade` value is not one of `again|hard|good|easy`
- **THEN** the response is `422` RFC 7807 with an `errors[]` entry for `grade` and no schedule change occurs
