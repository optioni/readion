## ADDED Requirements

### Requirement: ReviewItem entity owned by ReviewModule

The system SHALL own the `ReviewItem` entity (table + migration). A `ReviewItem` SHALL represent spaced-repetition state for one concept per `UserCertification`, anchored to the source `ContentChunk` a question was generated from. It SHALL persist the Leitner `box` (integer), `dueAt`, `lastReviewedAt`, and `state` (`active` | `mastered` | `suppressed`), and SHALL be scoped to the user's `UserCertification`. It SHALL NOT create or migrate `StudySession` or `SessionItem` (owned by the `sessions` change).

#### Scenario: Migration creates the ReviewItem table

- **WHEN** the migration for this change runs against an empty database
- **THEN** a `review_item` table exists with columns for the `UserCertification` foreign key, the anchor `ContentChunk` foreign key, `box`, `dueAt`, `lastReviewedAt`, and a `state` enum constrained to `active`/`mastered`/`suppressed`

#### Scenario: ReviewItem is scoped to an enrollment

- **WHEN** a `ReviewItem` is created
- **THEN** it references exactly one `UserCertification` and one anchor `ContentChunk`, and is readable only through that enrollment's owning user

### Requirement: Concept accrual on quiz answer

The system SHALL enqueue a concept (create or reactivate a `ReviewItem` anchored to the answered question's source `ContentChunk` for the answer's `UserCertification`) when a `QuizResponse` is submitted that is **incorrect**, or **correct with a confidence rating of 1 or 2**. A confident-correct answer (confidence ≥ 3) whose concept is not already queued SHALL NOT create a `ReviewItem`. A newly accrued item SHALL start in box 1 with `dueAt` set to the box-1 interval from now and `state: active`. If an `active` item already exists for that concept, accrual SHALL apply the Leitner rules (see Leitner schedule) rather than create a duplicate.

#### Scenario: Incorrect answer enqueues the concept

- **WHEN** a user submits an incorrect `QuizResponse` for a question generated from chunk `C` under enrollment `E` and no `ReviewItem` exists for that concept
- **THEN** a `ReviewItem` is created for enrollment `E` anchored to chunk `C`, in box 1, `state: active`, with `dueAt` one box-1 interval from now

#### Scenario: Correct-but-unsure answer enqueues the concept

- **WHEN** a user submits a correct `QuizResponse` with confidence `2` for a concept not already queued
- **THEN** a `ReviewItem` is created for that concept in box 1, `state: active`

#### Scenario: Confident-correct answer does not enqueue

- **WHEN** a user submits a correct `QuizResponse` with confidence `4` for a concept with no existing `ReviewItem`
- **THEN** no `ReviewItem` is created for that concept

#### Scenario: Accrual on an existing active item does not duplicate

- **WHEN** an `active` `ReviewItem` already exists for a concept and a new qualifying answer is submitted for it
- **THEN** no second `ReviewItem` row is created and the existing item is rescheduled per the Leitner rules

### Requirement: Leitner schedule applied on each review answer

The system SHALL maintain Leitner boxes with intervals `1d → 3d → 7d → 16d → 35d`, configurable via application config rather than hardcoded. On each answer to a due review item the system SHALL apply: correct + confident (confidence ≥ 3) → promote one box and set `dueAt` to the new box's interval from now; wrong → reset to box 1 and set `dueAt` to the box-1 interval; correct-but-unsure (confidence 1–2) → keep the current box and set `dueAt` to that box's interval. Promotion past the top box SHALL set `state: mastered`, clear it from the due queue, and SHALL NOT reschedule it. `lastReviewedAt` SHALL be updated on every review answer.

#### Scenario: Correct and confident promotes one box

- **WHEN** a review item in box 2 is answered correctly with confidence `4`
- **THEN** the item moves to box 3 and `dueAt` is set 7 days from now, with `lastReviewedAt` updated

#### Scenario: Wrong answer resets to box 1

- **WHEN** a review item in box 4 is answered incorrectly
- **THEN** the item resets to box 1 and `dueAt` is set 1 day from now

#### Scenario: Correct-but-unsure holds the box

- **WHEN** a review item in box 3 is answered correctly with confidence `2`
- **THEN** the item stays in box 3 and `dueAt` is rescheduled at the box-3 interval (7 days)

#### Scenario: Promotion past the top box masters the concept

- **WHEN** a review item in the top box (box 5) is answered correctly with confidence `5`
- **THEN** the item's `state` becomes `mastered`, it is removed from the due queue, and it is not rescheduled

#### Scenario: Box intervals come from config

- **WHEN** the configured box intervals are overridden to `2d → 5d → 10d → 20d → 40d`
- **THEN** scheduling uses the overridden intervals and no interval value is hardcoded in the scheduling logic

### Requirement: Due-queue read model per enrollment

The system SHALL expose, scoped to one of the requesting user's enrollments, the count of due review items and the due list. A review item SHALL be considered due when `state: active` and `dueAt <= now`. `suppressed` and `mastered` items SHALL be excluded. Access to another user's enrollment SHALL return `404` (ownership enforced at the repository layer on `userId`).

#### Scenario: Due count and list reflect active overdue items

- **WHEN** an authenticated user GETs `/api/v1/user-certifications/:id/review` for their own enrollment with 3 `active` items whose `dueAt` is in the past and 1 whose `dueAt` is in the future
- **THEN** the response envelope reports a due count of 3 and lists only those 3 items

#### Scenario: Suppressed and mastered items are excluded

- **WHEN** the due queue is read for an enrollment that has `suppressed` and `mastered` items also past `dueAt`
- **THEN** neither the `suppressed` nor the `mastered` items appear in the due list or count

#### Scenario: Another user's enrollment is not found

- **WHEN** a user requests the review queue for a `UserCertification` belonging to a different user
- **THEN** the response is `404`

### Requirement: Standalone five-minute review session

The system SHALL start a quiz-only `review`-kind `StudySession` for an enrollment that pulls only due review items, capped at 5–7 questions, with no reading blocks. Each due item SHALL generate a fresh question from its anchor chunk via the existing quiz pipeline, varying format/difficulty so it is never a verbatim repeat of a prior question. Session creation SHALL reuse `SessionsModule` and SHALL honor the one-active-session-per-enrollment invariant spanning `study` and `review` kinds. When no items are due, the system SHALL NOT create a session and SHALL return an "all caught up" empty state that offers a normal session instead.

#### Scenario: Review session pulls only due items as fresh questions

- **WHEN** a user starts a 5-minute review for an enrollment with 9 due items
- **THEN** a `review`-kind `StudySession` is created with at most 7 quiz items and no reading blocks, each generated fresh from a due item's anchor chunk

#### Scenario: Nothing due returns the all-caught-up state

- **WHEN** a user starts a 5-minute review for an enrollment with zero due items
- **THEN** no session is created and the response is an "all caught up" empty state indicating a normal session can be started instead

#### Scenario: Existing active session is resumed instead of starting a second

- **WHEN** a user already has an `active` session (`study` or `review`) for the enrollment and starts a 5-minute review
- **THEN** the existing active session is surfaced and resumed rather than a second session being created

#### Scenario: Review answers feed weak areas and readiness

- **WHEN** the user answers questions in a `review`-kind session
- **THEN** ordinary `QuizResponse`s are recorded that feed `WeakAreasModule` aggregation and the readiness score with no review-specific scoring path

### Requirement: Mark-as-mastered and suppress

The system SHALL allow a user to manually retire a single concept or an entire domain for one of their enrollments by setting the affected `ReviewItem`s to `state: suppressed`. Suppressed concepts SHALL be excluded from the review due queue and SHALL be excluded from new-material selection. Suppress actions SHALL be scoped to the owning user; targeting another user's `ReviewItem` SHALL return `404`.

#### Scenario: Suppress a single concept

- **WHEN** a user marks a single `active` `ReviewItem` as mastered/suppressed
- **THEN** that item's `state` becomes `suppressed` and it no longer appears in the due queue

#### Scenario: Suppress an entire domain

- **WHEN** a user suppresses the "Billing" domain for an enrollment
- **THEN** all of that enrollment's `ReviewItem`s whose anchor chunk's primary domain is "Billing" become `suppressed` and are excluded from both the review queue and new-material selection

#### Scenario: Suppressing another user's item is not found

- **WHEN** a user attempts to suppress a `ReviewItem` belonging to a different user's enrollment
- **THEN** the response is `404` and no state changes

### Requirement: Re-anchoring on chunk supersession

When a `ReviewItem`'s anchor `ContentChunk` is superseded, the system SHALL re-anchor the item to the chunk's `supersededById` where lineage exists. Where no lineage exists, on the next due-generation the system SHALL retrieve a fresh chunk for the same concept/domain via semantic search. If nothing clears the configured similarity threshold, the item SHALL be held (not rescheduled as answerable and eligible to trigger `fetchMoreMaterial`) rather than silently dropped or deleted.

#### Scenario: Re-anchor follows lineage

- **WHEN** a due-generation runs for a `ReviewItem` whose anchor chunk has `state: superseded` and a `supersededById`
- **THEN** the item is re-anchored to the chunk identified by `supersededById` and a fresh question is generated from it

#### Scenario: Retrieve a replacement chunk when no lineage exists

- **WHEN** a `ReviewItem`'s anchor chunk is superseded with no `supersededById` lineage
- **THEN** due-generation retrieves a fresh chunk for the same concept/domain via semantic search and re-anchors the item to it

#### Scenario: Hold when no chunk clears the threshold

- **WHEN** no candidate chunk clears the configured similarity threshold for a superseded concept with no lineage
- **THEN** the item is held rather than deleted, and is eligible to trigger `fetchMoreMaterial`
