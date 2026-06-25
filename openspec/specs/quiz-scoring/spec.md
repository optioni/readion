## Purpose

Defines the rules for persisting quiz answers, scoring them server-side, and capturing supplementary submission metadata. Correctness is always computed from the server's verified question record — never trusted from the client. Responses are scoped to the user's enrollment and carry a self-contained provenance snapshot for later rendering.

## Requirements

### Requirement: QuizResponse persistence scoped to enrollment

The system SHALL own the `QuizResponse` entity (table + migration). A `QuizResponse` SHALL record the user's answer, computed correctness, confidence rating, and time taken, and SHALL be scoped to the user's `UserCertification`. It SHALL embed a self-contained question/provenance snapshot (question, options, correct answer, `sourceChunkIds`, `supportingSpans`, verifier verdict) so it is renderable later without re-calling the model. It SHALL NOT reference `SessionItem` (owned by the later `sessions` change).

#### Scenario: A submitted answer persists a scoped response

- **WHEN** an enrolled user submits an answer to a verified question
- **THEN** a `QuizResponse` row is created referencing the user's `UserCertification`
- **AND** it embeds the question/provenance snapshot and has no `SessionItem` reference

#### Scenario: Migration creates the QuizResponse table

- **WHEN** the change's migrations are applied to a clean database
- **THEN** a `quiz_response` table exists with columns for answer, correctness, confidence, time taken, the provenance snapshot, and the `UserCertification` foreign key

### Requirement: Server-side answer scoring

The system SHALL compute correctness server-side by resolving the verified question from its cache handle (`:id`) and comparing the submitted answer against that question's `correctAnswer`. Client-submitted correctness SHALL be ignored. The submission endpoint SHALL be `POST /api/v1/quiz/:id/answer`. When the handle resolves to no live verified item (cache entry expired or quarantined), the system SHALL respond with an RFC 7807 error indicating the question is no longer available rather than scoring against a fabricated answer.

#### Scenario: Correct answer is scored correct

- **WHEN** a user submits the answer equal to the question's stored `correctAnswer`
- **THEN** the persisted `QuizResponse` has `correct = true`
- **AND** the response body reports the answer as correct

#### Scenario: Wrong answer is scored incorrect

- **WHEN** a user submits an answer different from the stored `correctAnswer`
- **THEN** the persisted `QuizResponse` has `correct = false`
- **AND** the response body reports the answer as incorrect

#### Scenario: Client cannot self-report correctness

- **WHEN** a submission includes a client-supplied correctness flag that contradicts the stored answer
- **THEN** the server-computed correctness based on the stored `correctAnswer` is persisted
- **AND** the client-supplied flag is ignored

#### Scenario: Answering an expired or quarantined question handle

- **WHEN** a user submits an answer to a `:id` handle whose verified cache entry has expired or been quarantined
- **THEN** the API responds with an RFC 7807 error indicating the question is no longer available
- **AND** no `QuizResponse` is persisted

### Requirement: Confidence rating and time-taken capture

The system SHALL accept a confidence rating in the integer range 1–5 and a non-negative time-taken value with each answer submission, validate them, and persist them on the `QuizResponse`. An out-of-range confidence rating SHALL be rejected with an RFC 7807 validation error.

#### Scenario: Valid confidence and time are persisted

- **WHEN** a user submits an answer with confidence `4` and time taken `12000` ms
- **THEN** the `QuizResponse` persists confidence `4` and time taken `12000`

#### Scenario: Out-of-range confidence is rejected

- **WHEN** a user submits an answer with confidence `6`
- **THEN** the API responds with a 422 RFC 7807 validation error identifying the `confidence` field
- **AND** no `QuizResponse` is persisted

### Requirement: Answer submission ownership scoping

The system SHALL restrict answering and reading `QuizResponse`s to the owning user's enrollment. A user SHALL NOT be able to submit or read a `QuizResponse` under another user's `UserCertification`.

#### Scenario: A user cannot answer under another user's enrollment

- **WHEN** a user submits an answer targeting a `UserCertification` they do not own
- **THEN** the API responds with a 403/404 ownership error per the resource-ownership rules
- **AND** no `QuizResponse` is persisted
