## MODIFIED Requirements

### Requirement: Stream-in generation of a verified question set with a deferred deadline

The system SHALL generate the question set under the same grounding + verifier guarantee as quizzes (delegating to the existing quiz generation pipeline), persisting each question with its provenance as it is verified, and SHALL stamp `startedAt` only once the complete verified set is ready. Generation SHALL branch on the attempt's `type`: for `mock` the target count is the certification's question count and on completion `deadline = startedAt + timeLimit` is stamped; for `diagnostic` the target count is the breadth-planner budget and `deadline` SHALL remain null (lenient/optional timer). The `generation` status SHALL be derived from set completion (`startedAt` stamped), reporting `ready` once the set is complete even when `deadline` is null, and `preparing` until then.

#### Scenario: Questions appear before generation completes

- **WHEN** the generation job has verified some but not all questions
- **THEN** `GET /api/v1/mock-exams/:id` returns those verified questions in `data.questions` with `data.generation` reporting `preparing`

#### Scenario: Mock deadline starts only when the full set is ready

- **WHEN** the generation job finishes verifying the full `mock` question set (count equal to the certification's question count)
- **THEN** the attempt's `startedAt` is set, `deadline` equals `startedAt + timeLimit`, and `GET /api/v1/mock-exams/:id` reports `data.generation` as `ready`

#### Scenario: Diagnostic is ready with a null deadline

- **WHEN** the generation job finishes verifying the budgeted `diagnostic` set
- **THEN** the attempt's `startedAt` is set, its `deadline` stays null, and `GET /api/v1/mock-exams/:id` reports `data.generation` as `ready` with `data.remainingSeconds` null

#### Scenario: Each generated question is verified individually

- **WHEN** a generated question fails the independent verifier pass
- **THEN** it is not persisted onto the attempt; generation substitutes a replacement so the final persisted set contains only verified questions, each carrying its `sourceChunkIds`, `supportingSpans`, and verifier verdict/score

### Requirement: Submit and scoring with domain breakdown

The system SHALL expose `POST /api/v1/mock-exams/:id/submit` that scores the attempt, computing the overall score and a per-domain breakdown, scoring unanswered questions as incorrect, and transitioning the attempt to `submitted`. For `type: mock` the system SHALL also compute a pass/fail verdict against the certification's passing score; for `type: diagnostic` no pass/fail verdict SHALL be produced and the `passed` field SHALL be null.

#### Scenario: Submitting a mock scores the attempt and persists the result

- **WHEN** a user submits an `in_progress` `mock` attempt with some questions answered correctly, some incorrectly, and some unanswered
- **THEN** the response is `200` with the attempt's `status` now `submitted`, an overall `score` equal to (correct answers / total questions), a `passed` flag set by comparing `score` to the certification passing score, and a `domainBreakdown` reporting accuracy per domain
- **THEN** unanswered questions are counted as incorrect in both the overall score and the domain breakdown

#### Scenario: Submitting a diagnostic scores without a pass/fail verdict

- **WHEN** a user submits an `in_progress` `diagnostic` attempt
- **THEN** the response is `200` with the attempt `submitted`, a numeric overall `score`, a `domainBreakdown`, and `passed` equal to null

#### Scenario: Scoring is pure and deterministic

- **WHEN** the scoring logic is given the same set of questions, answers, domain weights, and passing score
- **THEN** it returns the same overall score, pass/fail verdict, and domain breakdown every time, with no I/O

#### Scenario: Submitting an already-terminal attempt is rejected

- **WHEN** a user submits an attempt whose `status` is already `submitted` or `expired`
- **THEN** the response is `409` and the stored result is unchanged
