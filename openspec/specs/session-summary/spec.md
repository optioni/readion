## Purpose

Provides post-session and post-exam summary endpoints that surface accuracy, domain breakdowns, weak-area deltas, readiness changes, and strongest/weakest questions — all computed read-only from existing response data. Also exposes drill actions to immediately start a targeted follow-up session from a session's or mock exam's missed questions.

## Requirements

### Requirement: Study-session summary

The system SHALL expose `GET /api/v1/sessions/:id/summary` returning, in the `{ data }` envelope, the post-session summary for a study or review session owned by the requesting user. The summary SHALL be derived from the quiz responses recorded during the session's `[startedAt, endedAt]` window for the session's enrollment, and SHALL include: the number of questions answered and the session accuracy (correct ÷ answered), the set of domains covered with per-domain accuracy, the per-domain `WeakArea` score delta (after minus before), the exam-readiness change (before and after percentages), the strongest and weakest question of the session, and a suggested focus domain for the next session. The endpoint SHALL be requestable only once the session has ended (status `completed`, `partial`, or `abandoned`); an `active` session SHALL be rejected.

#### Scenario: Summary reports questions answered and accuracy

- **WHEN** the owning user requests `GET /api/v1/sessions/:id/summary` for an ended study session in which they answered 6 quiz questions, 4 correctly
- **THEN** the response is `200` with `data.questionsAnswered` equal to `6` and `data.accuracy` equal to `0.6667` (rounded to four decimals)

#### Scenario: Summary breaks accuracy down per domain

- **WHEN** the owning user requests the summary for an ended session that answered questions across two domains
- **THEN** `data.domains` contains one entry per covered domain, each with its `domain` name and per-domain `accuracy` computed from only that domain's session responses

#### Scenario: Summary reports per-domain weak-area deltas

- **WHEN** the owning user requests the summary for a session whose answers raised the `Security` domain's `WeakArea` score and lowered the `Billing` domain's score
- **THEN** `data.weakAreaDeltas` contains `{ domain: "Security", delta: <positive number> }` and `{ domain: "Billing", delta: <negative number> }`, where each delta is the domain's score computed over all responses minus its score computed over only the responses preceding this session

#### Scenario: Summary reports the readiness change

- **WHEN** the owning user requests the summary for a session after which readiness rose from 72% to 75%
- **THEN** `data.readiness.before` is `72`, `data.readiness.after` is `75`, and `data.readiness.delta` is `3`

#### Scenario: Readiness change is null when not yet calibrated

- **WHEN** the owning user requests the summary for a session on an enrollment that is still below the readiness calibration threshold after the session
- **THEN** `data.readiness.after` is null (not-yet-calibrated) and `data.readiness.delta` is null rather than a misleading number

#### Scenario: Summary identifies the strongest and weakest question

- **WHEN** the owning user requests the summary for a session containing at least one correct high-confidence answer and at least one incorrect answer
- **THEN** `data.strongestQuestion` references the correct answer with the highest confidence and `data.weakestQuestion` references the incorrect (or lowest-confidence) answer, each carrying enough identity (the question text and its `QuizResponse` id) for the client to ask the agent about it

#### Scenario: Summary suggests a next-session focus

- **WHEN** the owning user requests the summary and, after the session, the lowest-scoring `WeakArea` domain for the enrollment is `Networking`
- **THEN** `data.nextFocus.domain` is `Networking`

#### Scenario: Summary for an active session is rejected

- **WHEN** the owning user requests `GET /api/v1/sessions/:id/summary` for a session whose status is still `active`
- **THEN** the response is `409` and no summary is returned

#### Scenario: Summary for another user's session returns 404

- **WHEN** a user requests `GET /api/v1/sessions/:id/summary` for a session belonging to another user
- **THEN** the response is `404`

### Requirement: Mock-exam summary

The system SHALL expose `GET /api/v1/mock-exams/:id/summary` returning, in the `{ data }` envelope, the post-exam summary for a `submitted` or `expired` mock or diagnostic attempt owned by the requesting user. Questions answered, overall accuracy, per-domain accuracy, the strongest/weakest question, and the suggested next focus SHALL be derived from the attempt's self-contained `MockExam` data (`questions`, `score`, `domainBreakdown`); the weak-area and readiness deltas SHALL be computed for the attempt's enrollment, with the attempt's contribution excluded from the "before" baseline. The endpoint SHALL be requestable only for a finalized attempt; an `in_progress` attempt SHALL be rejected.

#### Scenario: Mock summary derives accuracy and per-domain breakdown from the attempt

- **WHEN** the owning user requests `GET /api/v1/mock-exams/:id/summary` for a submitted mock with a stored `score` and `domainBreakdown`
- **THEN** the response is `200` with `data.questionsAnswered`, `data.accuracy`, and `data.domains` (per-domain accuracy) consistent with the attempt's stored `questions` and `domainBreakdown`

#### Scenario: Mock summary reports weak-area and readiness deltas

- **WHEN** the owning user requests the summary for a finalized attempt
- **THEN** `data.weakAreaDeltas` and `data.readiness` reflect the change attributable to this attempt, where each "before" value is computed with this attempt's contribution excluded and each "after" value reflects the current enrollment state

#### Scenario: Mock summary identifies strongest and weakest question

- **WHEN** the owning user requests the summary for a finalized attempt with at least one correct and one incorrect answer
- **THEN** `data.strongestQuestion` references a correctly answered question and `data.weakestQuestion` references an incorrect (or unanswered) question, each carrying the question text and identity for an agent follow-up

#### Scenario: Summary for an in-progress attempt is rejected

- **WHEN** the owning user requests `GET /api/v1/mock-exams/:id/summary` for an attempt whose status is `in_progress`
- **THEN** the response is `409` and no summary is returned

#### Scenario: Mock summary for another user's attempt returns 404

- **WHEN** a user requests `GET /api/v1/mock-exams/:id/summary` for an attempt belonging to another user
- **THEN** the response is `404`

### Requirement: Drill my misses from a study session

The system SHALL expose `POST /api/v1/sessions/:id/drill` that immediately starts a short, targeted study session generated from the concepts the user **missed or flagged-unsure** (answered incorrectly, or answered with confidence at or below the unsure threshold) during the source session's window. Targets SHALL be built from each qualifying response's anchor source chunk and its domain, capped at `SUMMARY_DRILL_MAX_QUESTIONS`, and the drill SHALL be created via the same targeted-session path used by spaced-repetition (`SessionsService.createReviewSession`). The action SHALL enforce ownership scoping on `userId`. When the source session has no missed or flagged-unsure concepts, no session SHALL be created.

#### Scenario: Drilling misses starts a targeted session

- **WHEN** the owning user posts to `/api/v1/sessions/:id/drill` for an ended session in which they missed two questions and flagged a third as unsure
- **THEN** the response is `200` (or `201`) with `data` wrapping a new active study session whose items target the missed/unsure concepts' anchor chunks, capped at `SUMMARY_DRILL_MAX_QUESTIONS`

#### Scenario: Drilling with no misses creates nothing

- **WHEN** the owning user posts to `/api/v1/sessions/:id/drill` for a session in which every question was answered correctly with high confidence
- **THEN** no new session is created and the response indicates there is nothing to drill (an `all_caught_up`/`no_misses` status)

#### Scenario: Drill respects the one-active-session invariant

- **WHEN** the owning user posts to `/api/v1/sessions/:id/drill` while another study session for the same enrollment is already `active`
- **THEN** the existing active session is returned rather than a second active session being created

#### Scenario: Drilling another user's session returns 404

- **WHEN** a user posts to `/api/v1/sessions/:id/drill` for a session belonging to another user
- **THEN** the response is `404` and no session is created

### Requirement: Drill my misses from a mock exam

The system SHALL expose `POST /api/v1/mock-exams/:id/drill` that immediately starts a short, targeted study session generated from the questions answered incorrectly (or left unanswered) in a finalized mock or diagnostic attempt. Targets SHALL be built from each missed question's provenance anchor chunk and domain, capped at `SUMMARY_DRILL_MAX_QUESTIONS`, created via `SessionsService.createReviewSession`, with ownership scoping on `userId`. When the attempt has no incorrect/unanswered questions, no session SHALL be created.

#### Scenario: Drilling mock misses starts a targeted session

- **WHEN** the owning user posts to `/api/v1/mock-exams/:id/drill` for a finalized attempt with three incorrectly answered questions
- **THEN** the response is `200` (or `201`) with `data` wrapping a new study session targeting those questions' anchor chunks, capped at `SUMMARY_DRILL_MAX_QUESTIONS`

#### Scenario: Drilling a fully-correct attempt creates nothing

- **WHEN** the owning user posts to `/api/v1/mock-exams/:id/drill` for a finalized attempt with every question answered correctly
- **THEN** no new session is created and the response indicates there is nothing to drill

#### Scenario: Drilling another user's attempt returns 404

- **WHEN** a user posts to `/api/v1/mock-exams/:id/drill` for an attempt belonging to another user
- **THEN** the response is `404` and no session is created

### Requirement: Deltas are computed without mutating stored state

Summary delta computation SHALL be read-only: it SHALL NOT recompute, persist, or mutate the stored `WeakArea` rows, readiness, or any other state as a side effect of producing a summary. The "before" baseline SHALL be derived by re-running the existing pure scoring functions (`computeDomainScore`, `computeReadiness`, and the calibration check) over the response set that excludes the source session/attempt, and the "after" values SHALL reflect the current enrollment state.

#### Scenario: Requesting a summary does not change stored weak areas or readiness

- **WHEN** the owning user requests the summary for an ended session twice in a row
- **THEN** both responses are identical and the enrollment's persisted `WeakArea` rows and readiness are unchanged by the summary request

#### Scenario: Before baseline excludes the source activity

- **WHEN** the summary computes the "before" weak-area and readiness values for a session
- **THEN** those values equal the scores produced by the pure scoring functions over only the responses that precede the source session, with this session's responses excluded
