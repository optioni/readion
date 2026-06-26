## ADDED Requirements

### Requirement: Create a diagnostic for a live certification

The system SHALL expose `POST /api/v1/user-certifications/:id/diagnostic` that creates a `diagnostic`-type `MockExam` for the enrollment and enqueues breadth generation rather than generating synchronously. Creation SHALL be allowed only when the enrollment's `Certification` is `live`; for a non-live certification the request SHALL be rejected. The diagnostic SHALL reuse the `MockExam` entity owned by `mock-exam` (no new entity).

#### Scenario: Creating a diagnostic enqueues generation and returns immediately

- **WHEN** an authenticated user posts to `/api/v1/user-certifications/:id/diagnostic` for their own enrollment in a `live` certification
- **THEN** the response is `201` with `{ data }` wrapping a `MockExam` whose `type` is `diagnostic`, `status` is `in_progress`, `deadline` is null, and `questions` is empty
- **THEN** a diagnostic generation job is enqueued for the new attempt's id

#### Scenario: Diagnostic is not offered for a non-live certification

- **WHEN** a user posts to `/api/v1/user-certifications/:id/diagnostic` for an enrollment whose certification is `draft`
- **THEN** the response is `409` and no `MockExam` row is created

#### Scenario: Cannot create a diagnostic for an enrollment the user does not own

- **WHEN** a user posts to `/api/v1/user-certifications/:id/diagnostic` for an enrollment belonging to another user
- **THEN** the response is `404` and no `MockExam` row is created

### Requirement: Breadth planner probes every domain at least once

Diagnostic generation SHALL allocate a small fixed budget of `DIAGNOSTIC_QUESTION_COUNT` questions (configurable, default 12, intended range 10–15) for breadth: every domain of the certification SHALL be allocated at least one question, and any remaining slots beyond one-per-domain SHALL be distributed by each domain's exam-share weight using the largest-remainder method. The planner SHALL be pure and deterministic. The diagnostic question count SHALL come from configuration, never hardcoded.

#### Scenario: Every domain receives at least one slot

- **WHEN** the breadth planner runs for a certification with more domains than would receive a slot under pure proportional allocation
- **THEN** the returned slot list contains at least one slot for every domain, and the total slot count equals `DIAGNOSTIC_QUESTION_COUNT`

#### Scenario: Remaining slots follow exam-share weight

- **WHEN** the breadth planner allocates the slots beyond the one-per-domain floor
- **THEN** the extra slots are assigned to the highest-weight domains first by largest fractional remainder, so a heavier-weighted domain receives at least as many total slots as a lighter-weighted one

#### Scenario: Planner is deterministic

- **WHEN** the breadth planner is given the same domain set, weights, and question count
- **THEN** it returns the same slot allocation every time, with no I/O

### Requirement: Diagnostic generation reuses the verified quiz pipeline

Diagnostic generation SHALL produce each question under the same grounding + verifier guarantee as quizzes and mocks (delegating to the existing quiz generation pipeline), persisting each verified question with its provenance (`sourceChunkIds`, `supportingSpans`, verifier verdict/score) onto the attempt as it is verified.

#### Scenario: Each diagnostic question is grounded and verified

- **WHEN** the diagnostic generation job runs for an attempt
- **THEN** each persisted question carries its `sourceChunkIds`, `supportingSpans`, and verifier verdict/score, and a question that fails the independent verifier pass is not persisted

#### Scenario: Questions appear incrementally before completion

- **WHEN** the diagnostic generation job has verified some but not all of the budgeted questions
- **THEN** `GET /api/v1/mock-exams/:id` returns those verified questions in `data.questions` with `data.generation` still reporting `preparing`

### Requirement: Lenient optional timer with no enforced deadline

The diagnostic SHALL have a lenient, optional timer: on generation completion the attempt's `startedAt` SHALL be stamped while its `deadline` SHALL remain null, and `GET /api/v1/mock-exams/:id` SHALL report `generation: ready` with `remainingSeconds` null. Taking, answering, and reviewing a diagnostic SHALL reuse the existing mock-exam `GET`, answer, submit, and review endpoints, which operate by attempt id regardless of `type`.

#### Scenario: A completed diagnostic is ready with no countdown

- **WHEN** the diagnostic generation job finishes verifying the budgeted set
- **THEN** the attempt's `startedAt` is set, its `deadline` stays null, and `GET /api/v1/mock-exams/:id` reports `data.generation` as `ready` with `data.remainingSeconds` null

#### Scenario: Answering a diagnostic uses the shared answer endpoint

- **WHEN** a user saves an answer for a `ready` diagnostic via `PUT /api/v1/mock-exams/:id/answers/:questionIndex`
- **THEN** the response is `200` and the persisted attempt reflects the selected answer for that question

### Requirement: Abandoning a diagnostic is treated as a skip

An `in_progress` diagnostic SHALL NOT be auto-submitted, finalized, or seeded by any cron. Because the diagnostic carries a null `deadline`, the existing mock-exam auto-submit cron SHALL leave it untouched, so an abandoned diagnostic never establishes a `WeakArea` map, review items, or a readiness number.

#### Scenario: The auto-submit cron ignores an abandoned diagnostic

- **WHEN** the mock-exam auto-submit cron sweeps and an `in_progress` `diagnostic` attempt with a null `deadline` exists
- **THEN** the diagnostic's `status` remains `in_progress`, no `QuizResponse` is emitted for it, and `WeakAreasService.recompute` is not invoked on its behalf

### Requirement: Completion seeds weak areas, review, and readiness at low weight

On submission, the system SHALL finalize the diagnostic (reusing the shared scorer and `finalizeAttempt`), emitting one enrollment-scoped `QuizResponse` per question — each embedding the question's provenance snapshot, with unanswered questions recorded as incorrect — and SHALL drive `WeakAreasService.recompute` to establish the initial per-domain `WeakArea` map. The diagnostic finalize SHALL additionally emit one `QUIZ_ANSWERED_EVENT` per question so the `spaced-repetition` accrual seeds the review queue from diagnostic misses. A submitted diagnostic SHALL satisfy the `exam-readiness` calibration gate, and the diagnostic SHALL contribute to readiness only through the recency-decayed `WeakArea` path (low weight), not the higher-weighted mock blend.

#### Scenario: Submitting a diagnostic seeds the weak-area map

- **WHEN** a user submits a `diagnostic` attempt with some questions answered correctly, some incorrectly, and some unanswered
- **THEN** the response is `200` with the attempt `submitted`, one `QuizResponse` per question is persisted under the user's `UserCertification` (unanswered as incorrect), and a `WeakArea` row exists for each probed domain after `WeakAreasService.recompute`

#### Scenario: Diagnostic misses seed the review queue

- **WHEN** a diagnostic is submitted with at least one incorrectly answered question
- **THEN** a `QUIZ_ANSWERED_EVENT` is emitted for that question and the `spaced-repetition` accrual creates a `ReviewItem` anchored to that question's source chunk for the enrollment

#### Scenario: A completed diagnostic calibrates readiness

- **WHEN** a user submits a diagnostic for an enrollment that previously had fewer than the calibration threshold of graded answers and no completed diagnostic
- **THEN** `GET /api/v1/user-certifications/:id/readiness` returns a numeric `score` with `calibrated` true rather than the not-yet-calibrated state

### Requirement: No pass/fail framing for a diagnostic

A submitted diagnostic SHALL NOT carry a pass/fail verdict; its overall score and per-domain breakdown SHALL still be computed, but the `passed` field SHALL be null in the response.

#### Scenario: Submitted diagnostic reports score and breakdown but no verdict

- **WHEN** a user fetches `GET /api/v1/mock-exams/:id` for a submitted `diagnostic`
- **THEN** `data.score` and `data.domainBreakdown` are present and `data.passed` is null

### Requirement: Re-taking re-seeds without wiping real data

Re-running the diagnostic SHALL create a fresh `diagnostic`-type `MockExam`; its finalize SHALL emit new `QuizResponse`s that the idempotent `WeakAreasService.recompute` aggregates alongside accumulated session/mock responses, so the diagnostic contribution is re-seeded without removing accumulated real session/mock data.

#### Scenario: A second diagnostic preserves accumulated responses

- **WHEN** an enrollment with prior session `QuizResponse`s completes a second diagnostic
- **THEN** the prior session responses remain persisted and the recomputed `WeakArea` map reflects both the prior responses and the new diagnostic responses

### Requirement: Onboarding offer and one-time re-prompt

The system SHALL expose `GET /api/v1/user-certifications/:id/diagnostic-offer` returning, in the `{ data }` envelope, the offer state for the enrollment: `onboarding` when the enrollment is uncalibrated, has no completed diagnostic, and its certification is `live`; `re-prompt` when it is still uncalibrated with no completed diagnostic after at least `DIAGNOSTIC_REPROMPT_AFTER_SESSIONS` completed sessions and the one-time re-prompt has not yet been dismissed; otherwise `none`. The system SHALL expose `POST /api/v1/user-certifications/:id/diagnostic-offer/dismiss` that records the one-time re-prompt as shown (stamping a nullable `diagnosticRePromptedAt` on the `UserCertification`) so it is offered as a re-prompt only once. Both endpoints SHALL enforce ownership scoping on `userId`.

#### Scenario: Fresh uncalibrated enrollment is offered the diagnostic at onboarding

- **WHEN** the owning user requests the diagnostic offer for an uncalibrated enrollment in a `live` certification with no completed diagnostic and no completed sessions
- **THEN** the response is `200` with `data.offer` equal to `onboarding`

#### Scenario: Still-uncalibrated enrollment is re-prompted after the first session

- **WHEN** the owning user requests the diagnostic offer for an enrollment that is still uncalibrated, has no completed diagnostic, has at least `DIAGNOSTIC_REPROMPT_AFTER_SESSIONS` completed sessions, and has not dismissed the re-prompt
- **THEN** the response is `200` with `data.offer` equal to `re-prompt`

#### Scenario: The re-prompt is shown only once

- **WHEN** the user dismisses the re-prompt via `POST /api/v1/user-certifications/:id/diagnostic-offer/dismiss` and then requests the diagnostic offer again while still uncalibrated
- **THEN** the dismiss response is `200`, `diagnosticRePromptedAt` is stamped, and the subsequent offer is `none` rather than `re-prompt`

#### Scenario: A calibrated enrollment is offered nothing

- **WHEN** the owning user requests the diagnostic offer for an enrollment that has a completed diagnostic or is otherwise calibrated
- **THEN** the response is `200` with `data.offer` equal to `none`

#### Scenario: Diagnostic offer for another user's enrollment returns 404

- **WHEN** a user requests the diagnostic offer for an enrollment belonging to another user
- **THEN** the response is `404`

### Requirement: Ownership scoping for diagnostic resources

Every diagnostic resource SHALL enforce repository-layer ownership scoping on `userId`, so cross-user access returns `404` (not `403`) without leaking the resource's existence.

#### Scenario: Fetching another user's diagnostic attempt returns 404

- **WHEN** a user fetches `GET /api/v1/mock-exams/:id` for a `diagnostic` attempt belonging to another user
- **THEN** the response is `404`
