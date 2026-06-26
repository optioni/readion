# Spec: Mock Exam

## Purpose

Defines timed, full-length mock exam attempts that mirror a certification's real exam format. A mock attempt is persisted per user and enrollment, its verified question set is generated asynchronously under the same grounding + verifier guarantee as quizzes, and a wall-clock deadline begins only once the full set is ready. Attempts are resumable, answers are upserted while in progress, and on submission (or auto-submission of expired attempts) the attempt is scored with a per-domain breakdown, recorded as enrollment `QuizResponse`s, and fed into weak-area recomputation. Completed attempts are exposed in a review mode with grounded explanations and provenance-backed citations. The `MockExam` entity and its scoring/review infrastructure are shared with a downstream `diagnostic` capability, which this capability deliberately does not implement.

## Requirements

### Requirement: MockExam entity and migration

The system SHALL persist mock exam attempts in a `MockExam` table owned by this change, scoped to a `User` and a `UserCertification`, with a `type` enum (`mock` | `diagnostic`), a `status` enum (`in_progress` | `submitted` | `expired`), `startedAt` and `deadline` (nullable until generation completes), an overall score, a pass/fail flag, a per-domain breakdown, and a persisted question array carrying each question's options, correct answer, explanation, the user's selected answer, and provenance (`sourceChunkIds`, `supportingSpans`, verifier verdict/score).

#### Scenario: Migration creates the MockExam table

- **WHEN** the database migrations are applied against a fresh Testcontainers Postgres instance
- **THEN** a `mock_exam` table exists with a `User` FK, a `UserCertification` FK, a `type` enum column, a `status` enum column, nullable `started_at` and `deadline` columns, a `score` column, a `passed` boolean, a JSONB domain-breakdown column, and a JSONB questions column

#### Scenario: New attempt defaults to in_progress with no deadline

- **WHEN** a mock exam row is created before its question set is ready
- **THEN** its `status` is `in_progress`, its `type` is `mock`, and both `started_at` and `deadline` are null

### Requirement: Create a mock exam matching the real exam format

The system SHALL expose `POST /api/v1/user-certifications/:id/mock-exams` that creates a `mock`-type attempt for the enrollment's certification, reading question count, time limit, passing score, and domain weights from the `Certification`, and enqueueing question generation rather than generating synchronously.

#### Scenario: Creating a mock enqueues generation and returns immediately

- **WHEN** an authenticated, enrolled user posts to `/api/v1/user-certifications/:id/mock-exams`
- **THEN** the response is `201` with `{ data }` wrapping a `MockExam` whose `status` is `in_progress`, `type` is `mock`, `deadline` is null, and `questions` is empty
- **THEN** a generation job is enqueued for the new attempt's id

#### Scenario: Cannot create a mock for an enrollment the user does not own

- **WHEN** a user posts to `/api/v1/user-certifications/:id/mock-exams` for an enrollment belonging to another user
- **THEN** the response is `404`

### Requirement: Stream-in generation of a verified question set with a deferred deadline

The system SHALL generate the full question set for a mock under the same grounding + verifier guarantee as quizzes (delegating to the existing quiz generation pipeline), persisting each question with its provenance as it is verified, and SHALL set `startedAt` and `deadline = startedAt + timeLimit` only once the complete verified set is ready.

#### Scenario: Questions appear before the clock starts

- **WHEN** the generation job has verified some but not all questions
- **THEN** `GET /api/v1/mock-exams/:id` returns those verified questions in `data.questions` with `data.deadline` still null and a `data.generation` status indicating it is still preparing

#### Scenario: Deadline starts only when the full set is ready

- **WHEN** the generation job finishes verifying the full question set (count equal to the certification's question count)
- **THEN** the attempt's `startedAt` is set, `deadline` equals `startedAt + timeLimit`, and `GET /api/v1/mock-exams/:id` reports the generation as complete

#### Scenario: Each generated question is verified individually

- **WHEN** a generated question fails the independent verifier pass
- **THEN** it is not persisted onto the attempt; generation substitutes a replacement so the final persisted set contains only verified questions, each carrying its `sourceChunkIds`, `supportingSpans`, and verifier verdict/score

### Requirement: Wall-clock timer and resume

The timer SHALL be wall-clock: `deadline` is computed server-side and elapsed time keeps counting regardless of client connectivity. An `in_progress` attempt SHALL be resumable within its deadline with previously saved answers preserved.

#### Scenario: Resuming preserves answers and the running clock

- **WHEN** a user re-fetches `GET /api/v1/mock-exams/:id` after disconnecting, while `now` is before `deadline`
- **THEN** the response includes the previously saved answers and a `remainingSeconds` derived from `deadline - now` (not reset by the disconnect)

#### Scenario: No agent access during the exam

- **WHEN** the mock exam attempt is `in_progress`
- **THEN** no agent conversation is created or attached to it, and the attempt exposes no agent endpoints

### Requirement: Answer persistence while in progress

The system SHALL accept an upserted answer for a question of an `in_progress` attempt before its deadline, and SHALL reject answer changes once the attempt is `submitted` or `expired` or past its deadline.

#### Scenario: Saving and overwriting an answer

- **WHEN** a user submits an answer for a question, then submits a different answer for the same question, before the deadline
- **THEN** both calls return `200` and the persisted attempt reflects the most recent selected answer for that question (no duplicate answer rows)

#### Scenario: Answering a terminal attempt is rejected

- **WHEN** a user submits an answer for a question of an attempt whose `status` is `submitted` or `expired`
- **THEN** the response is `409` and no answer is recorded

### Requirement: Submit and scoring with domain breakdown

The system SHALL expose `POST /api/v1/mock-exams/:id/submit` that scores the attempt, computing the overall score, a pass/fail verdict against the certification's passing score, and a per-domain breakdown, scoring unanswered questions as incorrect, and transitioning the attempt to `submitted`.

#### Scenario: Submitting scores the attempt and persists the result

- **WHEN** a user submits an `in_progress` attempt with some questions answered correctly, some incorrectly, and some unanswered
- **THEN** the response is `200` with the attempt's `status` now `submitted`, an overall `score` equal to (correct answers / total questions), a `passed` flag set by comparing `score` to the certification passing score, and a `domainBreakdown` reporting accuracy per domain
- **THEN** unanswered questions are counted as incorrect in both the overall score and the domain breakdown

#### Scenario: Scoring is pure and deterministic

- **WHEN** the scoring logic is given the same set of questions, answers, domain weights, and passing score
- **THEN** it returns the same overall score, pass/fail verdict, and domain breakdown every time, with no I/O

#### Scenario: Submitting an already-terminal attempt is rejected

- **WHEN** a user submits an attempt whose `status` is already `submitted` or `expired`
- **THEN** the response is `409` and the stored result is unchanged

### Requirement: Mock completion records responses and updates weak areas

On submission or auto-submission, the system SHALL emit one `QuizResponse` per mock question into the user's enrollment — each embedding that question's provenance snapshot, with unanswered questions recorded as incorrect — and SHALL then drive the per-domain `WeakArea` update through the existing `WeakAreasService.recompute` entry point. Mock-emitted responses SHALL carry a neutral confidence value (default `3`).

#### Scenario: Mock answers are recorded as enrollment QuizResponses

- **WHEN** an attempt with answered and unanswered questions is finalized
- **THEN** one `QuizResponse` per question is persisted under the user's `UserCertification`, each embedding the question's provenance snapshot, with answered questions recorded at their computed correctness and unanswered questions recorded as incorrect

#### Scenario: Domain breakdown feeds weak areas via recompute

- **WHEN** an attempt is finalized with a weak per-domain result in one domain
- **THEN** `WeakAreasService.recompute` runs for the enrollment and the `WeakArea` record for that user, certification, and domain is updated to reflect the mock's per-domain accuracy

### Requirement: Auto-submit expired attempts via a worker cron

A scheduled processor in `apps/worker` SHALL auto-submit and score any attempt left `in_progress` past its `deadline` plus a configurable grace window, marking it `expired`, with unanswered questions scored as incorrect.

#### Scenario: Past-deadline attempt is expired and scored

- **WHEN** the auto-submit cron runs and finds an `in_progress` attempt whose `deadline` plus the grace window is before `now`
- **THEN** the attempt is scored (unanswered as incorrect), its `status` becomes `expired`, its result and domain breakdown are persisted, and its weak areas are updated

#### Scenario: Within-grace attempt is left untouched

- **WHEN** the cron runs and finds an `in_progress` attempt whose `deadline` has passed but is still within the grace window
- **THEN** the attempt remains `in_progress` and is not scored

### Requirement: Review mode after completion

Once an attempt is `submitted` or `expired`, the system SHALL expose it in a review form showing every question, the user's selected answer, the correct answer, the grounded explanation, and citations derived from the stored per-question provenance.

#### Scenario: Reviewing a submitted attempt

- **WHEN** a user fetches `GET /api/v1/mock-exams/:id` for a `submitted` attempt
- **THEN** each question in `data.questions` includes the correct answer, the user's answer, an explanation, and citations resolved from the persisted `sourceChunkIds`/`supportingSpans`

#### Scenario: Review citations remain faithful after chunk supersession

- **WHEN** a question's source `ContentChunk` has since been superseded
- **THEN** the review still resolves the citation from the snapshot persisted on the attempt rather than from the live chunk state

### Requirement: Listing and ownership scoping

The system SHALL expose `GET /api/v1/user-certifications/:id/mock-exams` listing the enrollment's attempts in the `{ data[], meta }` envelope, and SHALL enforce repository-layer ownership scoping on `userId` for every mock resource so cross-user access returns `404`.

#### Scenario: Listing returns only the owner's attempts

- **WHEN** an authenticated user lists mock exams for one of their enrollments
- **THEN** the response is `200` with `{ data[], meta }` containing only that user's attempts for that enrollment

#### Scenario: Fetching another user's attempt returns 404

- **WHEN** a user fetches `GET /api/v1/mock-exams/:id` for an attempt belonging to another user
- **THEN** the response is `404` (not `403`), without leaking the attempt's existence

### Requirement: Diagnostic type enum and shared infrastructure

The `MockExam.type` column SHALL include the `diagnostic` value, and the scoring, domain-breakdown, and review infrastructure SHALL be reusable by the downstream `diagnostic` change. This change SHALL NOT implement the diagnostic create flow (breadth planner, lenient/optional timer, onboarding offer, low-weight seeding).

#### Scenario: Type enum accepts diagnostic

- **WHEN** the `MockExam` schema is inspected after migration
- **THEN** the `type` enum permits both `mock` and `diagnostic` values

#### Scenario: No diagnostic create endpoint in this change

- **WHEN** the mock-exam API surface is inspected
- **THEN** the only create path is the `mock`-type create under an enrollment; no diagnostic-specific create, breadth planner, or seeding endpoint is exposed here
