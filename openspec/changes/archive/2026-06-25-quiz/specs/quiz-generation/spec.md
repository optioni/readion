## ADDED Requirements

### Requirement: Deterministic question-format planner

The system SHALL select a quiz question format from `{ multiple_choice, true_false, scenario }` deterministically from the chosen content chunk's characteristics and the session difficulty, *before* any generation call. The selection MUST be a pure function so the cache key `{ sourceChunkIds, difficulty, format, certification }` is computable up front. The `scenario` format SHALL only be selected at `exam-ready` difficulty.

#### Scenario: Same inputs always yield the same format

- **WHEN** the planner is called twice with identical chunk characteristics and difficulty
- **THEN** it returns the same format both times
- **AND** it issues no LLM call

#### Scenario: Scenario format is reserved for exam-ready difficulty

- **WHEN** the planner is called with difficulty `beginner` or `intermediate`
- **THEN** the returned format is `multiple_choice` or `true_false`, never `scenario`

#### Scenario: Exam-ready difficulty may select scenario format

- **WHEN** the planner is called at `exam-ready` difficulty with a chunk whose characteristics warrant a scenario stem
- **THEN** the returned format is `scenario`

### Requirement: Grounded and verified question generation

The system SHALL generate a quiz question for an enrolled user by retrieving content chunks for a target domain via semantic search and driving a quiz-specific generation function through the `grounding-verification` orchestration with the retrieved chunks and the computed cache key. A question SHALL be returned to the caller only if it is contract-valid and verifier-passed, carrying its options, correct answer, and provenance (`sourceChunkIds`, `supportingSpans`, verifier verdict). An unverified question SHALL never be served.

#### Scenario: First-pass verified question is returned

- **WHEN** a question is requested for a target domain whose retrieved chunks are above the grounding threshold and the generated item passes the verifier on the first attempt
- **THEN** the API returns the question with its options, correct answer, and provenance
- **AND** the response includes a `relationships` block per the standard envelope

#### Scenario: Regenerated question is returned after a first-pass failure

- **WHEN** the first generated item fails verification and a regenerated item passes
- **THEN** the API returns the passing item
- **AND** no unverified item is ever exposed in the response

#### Scenario: Unverifiable concept is substituted

- **WHEN** every attempt for the chosen chunk fails verification
- **THEN** the orchestration substitutes a question generated from a different chunk and the API returns that verified substitute

#### Scenario: Generation only against a live certification

- **WHEN** a question is requested for a certification whose `state` is `draft`
- **THEN** the API responds with an RFC 7807 error indicating the certification is not yet available
- **AND** no generation call is made

#### Scenario: Caller must be enrolled in the certification

- **WHEN** a user who is not enrolled in the certification requests a question for it
- **THEN** the API responds with a 403/404 ownership error per the resource-ownership rules
- **AND** no generation call is made

### Requirement: Thin-coverage signal surfaced to the caller

When the orchestration raises a `fetchMoreMaterial` signal because retrieved chunks fall below the grounding threshold, the system SHALL surface a typed "insufficient material" result identifying the certification and target domain rather than returning a fabricated question.

#### Scenario: Below-threshold retrieval returns insufficient-material

- **WHEN** all retrieved chunks for the target domain are below the configured grounding threshold
- **THEN** the API returns a typed insufficient-material result naming the certification and domain
- **AND** no question is fabricated and no unverified item is returned

### Requirement: Verified-only response caching keyed on stable inputs

The system SHALL drive caching through the `grounding-verification` orchestration using a cache key composed only of `{ sourceChunkIds, difficulty, format, certification }`. No user-specific value SHALL be part of the key or the prompt. An identical request within the TTL SHALL be served from cache without an LLM call; only verifier-passed items are ever cached.

#### Scenario: Identical request is served from cache

- **WHEN** a second request arrives with the same `{ sourceChunkIds, difficulty, format, certification }` within the TTL of a previously verified question
- **THEN** the cached verified question is returned
- **AND** no generation or verifier LLM call is made

#### Scenario: Different users sharing inputs share the cached question

- **WHEN** two different enrolled users request a question with the same `{ sourceChunkIds, difficulty, format, certification }`
- **THEN** both receive the same cached verified question
- **AND** the cache key contains no user identifier

### Requirement: Grounded and verified answer explanations

The system SHALL generate an explanation for a quiz answer by driving an explanation generation function through the same grounding orchestration, deriving citations from the question's stored provenance. An explanation SHALL be returned only if contract-valid and verifier-passed, and its citations MUST reference real `sourceChunkIds` rather than a model re-statement.

#### Scenario: Explanation for a wrong answer is grounded and verified

- **WHEN** an explanation is requested for a question the user answered incorrectly
- **THEN** the API returns a verified explanation whose citations resolve to the question's `sourceChunkIds`
- **AND** an unverified explanation is never returned

### Requirement: Report a question or explanation to quarantine

The system SHALL expose a report action (`POST /api/v1/quiz/:id/report`) that, for a served quiz question or explanation, invokes the shared `grounding-verification` quarantine operation with the item's cache key and provenance. The reported item SHALL be evicted from cache and recorded for admin surfacing, and SHALL not be reused.

#### Scenario: Reporting evicts and records the item

- **WHEN** an authenticated user reports a served quiz question with a reason
- **THEN** the quarantine operation evicts the cached entry for that item's key
- **AND** an immutable quarantine record carrying the provenance and reason is produced

#### Scenario: A reported question is regenerated, not re-served, on next request

- **WHEN** the same `{ sourceChunkIds, difficulty, format, certification }` is requested again after the item was reported
- **THEN** the cache read is a miss
- **AND** a fresh verified item is generated rather than the quarantined one being served
