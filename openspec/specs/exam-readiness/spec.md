## Purpose

Exam readiness is a derived, read-through score (0–100) that summarises how prepared a user is for their certification exam. It is computed from per-domain `WeakArea` scores, `Certification` domain weights, `MockExam` results, and graded `QuizResponse` count. A calibration gate withholds the numeric score until there is sufficient signal. A passive trajectory estimate shows projected time to exam-readiness at the user's current pace.

## Requirements

### Requirement: Readiness is a derived value with no entity or migration

The system SHALL compute exam readiness as a derived, read-through value over data owned by other changes — per-domain `WeakArea` scores, the `Certification`'s domain weights, the enrollment's `MockExam` results, and the enrollment's graded `QuizResponse` count. Readiness SHALL NOT introduce a new entity and SHALL NOT add a migration; in particular it SHALL NOT create or alter the `WeakArea`, `Certification`, `MockExam`, `QuizResponse`, or `UserCertification` tables.

#### Scenario: No readiness table is created

- **WHEN** the database migrations are run for this change
- **THEN** no new table is created and no existing table is altered for readiness

#### Scenario: Readiness reflects current data without its own store

- **WHEN** an enrollment's underlying `WeakArea` scores change and readiness is requested again
- **THEN** the returned readiness reflects the changed scores without any readiness-specific persisted row being updated

### Requirement: Domain-weighted readiness computation

The system SHALL compute a readiness score in the range 0–100 from the enrollment's per-domain `WeakArea` scores combined by the `Certification`'s domain weights, such that a domain with a larger real-exam share moves the overall score more than a domain with a smaller share. This combination SHALL be a pure function of its inputs (per-domain scores, domain weights, mock results, timing), independent of any I/O, so a higher overall score means a more exam-ready user.

#### Scenario: A stronger heavily-weighted domain raises readiness more

- **WHEN** two enrollments have identical per-domain `WeakArea` scores except enrollment A is stronger in a domain weighted 30% and enrollment B is stronger by the same margin in a domain weighted 10%
- **THEN** the computed readiness for enrollment A is greater than for enrollment B

#### Scenario: Score is bounded and pure

- **WHEN** the calculator is invoked with the same inputs twice
- **THEN** it returns the same value both times
- **AND** the value is within 0–100

### Requirement: Calibration gate and not-yet-calibrated state

The system SHALL withhold a numeric readiness score and report a **not yet calibrated** state until there is honest signal for the enrollment: a completed (submitted) diagnostic `MockExam`, **or** at least `READINESS_CALIBRATION_MIN_ANSWERS` graded answers (configurable, default 10) accumulated across sessions, reviews, and mocks. Below that bar the readiness value exposed to clients SHALL be the not-yet-calibrated sentinel rather than a number. The calibration threshold SHALL be read from configuration, never hardcoded.

#### Scenario: Below the answer threshold readiness is not yet calibrated

- **WHEN** an enrollment has fewer than `READINESS_CALIBRATION_MIN_ANSWERS` graded answers and no completed diagnostic
- **THEN** readiness is reported as not yet calibrated with no numeric score

#### Scenario: Reaching the answer threshold flips to a number

- **WHEN** an enrollment accumulates at least `READINESS_CALIBRATION_MIN_ANSWERS` graded answers
- **THEN** readiness is reported as a numeric score in 0–100

#### Scenario: A completed diagnostic calibrates immediately

- **WHEN** an enrollment has a submitted diagnostic `MockExam` but fewer than `READINESS_CALIBRATION_MIN_ANSWERS` graded answers
- **THEN** readiness is reported as a numeric score rather than not yet calibrated

### Requirement: Recent improvement is reflected quickly

The system SHALL weight recent performance more heavily than older performance, so that recent improvement raises the readiness score promptly rather than being averaged away by a long history.

#### Scenario: Recent gains move the score faster than equivalent old gains

- **WHEN** two enrollments accumulate the same set of improving answers but enrollment A's improvements are recent and enrollment B's identical improvements are older
- **THEN** the computed readiness for enrollment A is greater than or equal to that for enrollment B, and strictly greater when the recency weighting is non-trivial

### Requirement: Mock exam results weighted higher than session quizzes

The system SHALL fold submitted/expired `MockExam` results into readiness with greater weight than ordinary session-quiz performance. Mock results SHALL be an optional input: when an enrollment has no `MockExam` results, readiness SHALL still compute from quiz/diagnostic signal alone.

#### Scenario: A mock result shifts readiness more than an equivalent quiz result

- **WHEN** an enrollment is calibrated and then records a strong mock-exam result, versus an otherwise-identical enrollment that records an equivalent amount of strong session-quiz performance
- **THEN** the enrollment with the mock result has a readiness score at least as high, reflecting the mock's higher weight

#### Scenario: Readiness computes without any mocks

- **WHEN** a calibrated enrollment has no `MockExam` results
- **THEN** readiness still returns a numeric score from its quiz/diagnostic signal

### Requirement: Readiness recompute entry point for downstream features

The system SHALL expose `ReadinessService.compute(userCertificationId)` returning the enrollment's readiness (numeric score with calibration `true`, or the not-yet-calibrated state) as the single entry point downstream session/review/mock/summary/agent/digest features call. Recording quiz answers SHALL be sufficient to drive a meaningful recomputation today without those downstream features existing.

#### Scenario: Recompute reflects newly recorded answers

- **WHEN** a user records additional graded answers and `compute` is invoked for their enrollment
- **THEN** the returned readiness reflects those answers

### Requirement: Owner-scoped readiness read endpoint

The system SHALL expose `GET /api/v1/user-certifications/:id/readiness` returning, in the standard `{ data }` response envelope, the enrollment's readiness — the numeric `score` and `calibrated: true` when calibrated, otherwise the not-yet-calibrated state — together with the passive trajectory. The endpoint SHALL reflect the enrollment's latest recorded answers by computing read-through. Access SHALL be restricted to the owning user's enrollment via repository-layer scoping on `userId`; a request for an enrollment the user does not own SHALL return `404` (per the resource-ownership rules) and SHALL NOT reveal that user's readiness.

#### Scenario: Owner reads their readiness

- **WHEN** the owning user requests `GET /api/v1/user-certifications/:id/readiness` for a calibrated enrollment
- **THEN** the response is `200` with `data.score` in 0–100 and `data.calibrated` true

#### Scenario: Uncalibrated enrollment returns the calibration state

- **WHEN** the owning user requests readiness for an enrollment below the calibration bar
- **THEN** the response is `200` with the not-yet-calibrated state and no numeric `score`

#### Scenario: Another user cannot read the enrollment's readiness

- **WHEN** a user requests `GET /api/v1/user-certifications/:id/readiness` for an enrollment they do not own
- **THEN** the response is `404` and does not include the other user's readiness

### Requirement: Readiness exposed on the UserCertification resource

The system SHALL include a flat `readinessScore` attribute on the `UserCertification` single-resource representation, computed read-through: a number in 0–100 when the enrollment is calibrated, otherwise the not-yet-calibrated sentinel (`null`). This lets the dashboard sort enrollments by readiness without a second request.

#### Scenario: Calibrated enrollment exposes a numeric readinessScore

- **WHEN** the owning user requests their calibrated `UserCertification`
- **THEN** `data.readinessScore` is a number in 0–100

#### Scenario: Uncalibrated enrollment exposes the sentinel

- **WHEN** the owning user requests a `UserCertification` below the calibration bar
- **THEN** `data.readinessScore` is `null`

### Requirement: Passive readiness trajectory

The system SHALL provide a passive, informational readiness trajectory derived from the enrollment's recent rate of readiness gain (an estimate such as "exam-ready in ~N weeks at your recent pace"). The trajectory SHALL be hidden (null) until there is enough history to estimate a trend, SHALL NOT depend on any user-entered exam date, and SHALL NOT trigger any reminder, notification, or email.

#### Scenario: Trajectory is hidden without enough history

- **WHEN** an enrollment lacks enough readiness history to estimate a trend
- **THEN** the readiness response's trajectory is null

#### Scenario: Trajectory appears once a trend can be estimated

- **WHEN** an enrollment has accumulated improving readiness over enough history
- **THEN** the readiness response includes a trajectory estimate of weeks to exam-ready
- **AND** no exam date is required and no reminder is produced
