# Study Sessions Spec

## Purpose

Manages the full lifecycle of a `StudySession`: creation, item planning and pre-generation, content grounding, resume, completion, history, and cleanup. Sessions are personalised per enrollment and drive the core study loop — interleaving LLM-formatted reading blocks with verified quiz questions derived from the `ContentChunk` knowledge base.

## Requirements

### Requirement: Create and start a study session

The system SHALL create a `study`-kind `StudySession` from one of the requesting user's active `UserCertification`s, accepting a session config of duration, content mix, difficulty, focus area, and learning style. Fields omitted from the request SHALL fall back to the user's saved session defaults. The created session SHALL be persisted in `active` status with `kind: study`, `lastItemIndex: 0`, a recorded `startedAt`, and the resolved config.

#### Scenario: Create a session with explicit config

- **WHEN** an authenticated user POSTs to `/api/v1/user-certifications/:id/sessions` for their own active enrollment with `{ durationMinutes: 30, contentMix: "balanced", difficulty: "intermediate", focusArea: { mode: "auto" }, learningStyle: "weak-area-focus" }`
- **THEN** the response is `201` with envelope `{ data, relationships }` where `data` includes `status: "active"`, `kind: "study"`, `lastItemIndex: 0`, and the echoed config
- **THEN** a `StudySession` row exists scoped to the user with `startedAt` set

#### Scenario: Omitted config fields fall back to saved defaults

- **WHEN** a user with saved session defaults `{ durationMinutes: 60, difficulty: "exam-ready" }` creates a session sending only `{ contentMix: "quiz-heavy" }`
- **THEN** the created session resolves `durationMinutes: 60` and `difficulty: "exam-ready"` from the saved defaults and `contentMix: "quiz-heavy"` from the request

#### Scenario: Invalid config is rejected

- **WHEN** a user creates a session with `durationMinutes: 45` (not one of 15/30/60/90)
- **THEN** the response is `400` RFC 7807 Problem Details with an `errors[]` entry naming `durationMinutes`
- **THEN** no `StudySession` row is created

#### Scenario: Enrollment owned by another user is not found

- **WHEN** a user creates a session against a `UserCertification` id belonging to a different user
- **THEN** the response is `404` (ownership is enforced at the repository layer by scoping on `userId`)

### Requirement: At most one active session per enrollment

The system SHALL allow at most one `active` `StudySession` per `UserCertification`, spanning both `study` and `review` kinds. Attempting to start a new session while one is already `active` for that enrollment SHALL surface and resume the existing session rather than create a second.

#### Scenario: Starting a second session resumes the active one

- **WHEN** a user has an `active` session (`id: A`, `lastItemIndex: 2`) for an enrollment and POSTs to create another session for the same enrollment
- **THEN** the response is `200` returning session `A` with `lastItemIndex: 2`
- **THEN** no new `StudySession` row is created

#### Scenario: Active session limit is per enrollment, not per user

- **WHEN** a user has an `active` session for enrollment X and creates a session for a different active enrollment Y
- **THEN** a new `StudySession` is created for enrollment Y and returned `201`

### Requirement: Session planner derives item plan from config

The session planner SHALL derive the number of items from session duration (~2 min per reading block, ~1 min per quiz question), determine target domains from the focus area (explicit domains, or auto-weighted by `WeakArea` scores for the enrollment), and deterministically choose each quiz item's `format` (multiple-choice / true-false / scenario-based) from the chunk characteristics and session difficulty before any generation call. Item types SHALL alternate reading block → quiz questions → reading block. When the session's `learningStyle` is `spaced-repetition`, the planner SHALL consult `ReviewModule`'s due-items provider for the enrollment and front-load due `ReviewItem`s as quiz items at the start of the plan before any new-material items; when no items are due, the plan SHALL proceed with new material as normal.

#### Scenario: Item count scales with duration

- **WHEN** a 30-minute balanced session is planned
- **THEN** the plan contains roughly 4 reading blocks and 12 quiz questions, sequenced as reading block → quiz questions → reading block …

#### Scenario: Auto focus weights toward weak areas

- **WHEN** a session with `focusArea: { mode: "auto" }` is planned for an enrollment whose ranked `WeakArea` list puts "Security" first
- **THEN** the planner biases target-domain selection toward "Security" using the weak-area ranking from `WeakAreasModule`

#### Scenario: Specific focus area restricts domains

- **WHEN** a session with `focusArea: { mode: "domains", domains: ["Networking"] }` is planned
- **THEN** all planned items target only the "Networking" domain

#### Scenario: Format is fixed before generation

- **WHEN** the planner assigns a quiz item at exam-ready difficulty whose chunk supports a scenario stem
- **THEN** the item's `format` is set to `scenario-based` before the generation call, so `{ chunkIds, difficulty, format, certification }` is a complete cache key

#### Scenario: Spaced-repetition style front-loads due review items

- **WHEN** a session with `learningStyle: "spaced-repetition"` is planned for an enrollment that has 4 due `ReviewItem`s
- **THEN** the planner places quiz items generated from those due review items at the start of the plan, before any new-material items, and marks the remaining items as new material

#### Scenario: Spaced-repetition style with nothing due proceeds with new material

- **WHEN** a session with `learningStyle: "spaced-repetition"` is planned for an enrollment with zero due `ReviewItem`s
- **THEN** the plan contains only new-material items, as if no front-loading applied

### Requirement: First three items are pre-generated before the session is active

When a session is created, the system SHALL generate the first 3 items synchronously (blocking) before returning the session, and generate the remaining items in the background so the user encounters no mid-session waits. Pre-generated quiz items SHALL be produced via `QuizModule` and SHALL only include verified questions.

#### Scenario: First three items ready on creation

- **WHEN** a session is created
- **THEN** the response is returned only after the first 3 `SessionItem` rows exist for the session, each ready to render

#### Scenario: Remaining items generated in background

- **WHEN** a 30-minute session with 16 planned items is created
- **THEN** items beyond index 2 are generated asynchronously after the response, and become available as the user advances

#### Scenario: Only verified quiz items are persisted

- **WHEN** a quiz item is generated and its question fails the verifier pass
- **THEN** that question is regenerated or substituted by `QuizModule` so the persisted `SessionItem` only ever holds a verified question

### Requirement: Reading blocks are grounded Markdown with provenance

Reading blocks SHALL be composed from 1–3 related `ContentChunk`s retrieved by semantic search above the configurable minimum cosine similarity threshold (default 0.75), LLM-formatted into Markdown prose with a concise TL;DR (3–5 points) and an on-demand "Go deeper" expansion. Each reading-block `SessionItem` SHALL persist a snapshot of its `sourceChunkIds` and `supportingSpans`. A video-based content mix SHALL degrade silently to a normal reading block when no video-sourced chunks clear the threshold for the target domain.

#### Scenario: Reading block stores its source provenance

- **WHEN** a reading-block item is generated from chunks `[c1, c2]`
- **THEN** the persisted `SessionItem` has `type: reading`, Markdown content with a TL;DR, and `sourceChunkIds: ["c1","c2"]` with `supportingSpans` captured as a snapshot

#### Scenario: Go deeper expands on demand

- **WHEN** a user POSTs the "go deeper" action for a reading-block item that has a TL;DR
- **THEN** the response returns the expanded full explanation, generated on demand, without altering the stored TL;DR provenance

#### Scenario: Chunks below the threshold are discarded

- **WHEN** the nearest chunks for a target domain all score below cosine 0.75
- **THEN** they are not used to compose the reading block

#### Scenario: Video mix degrades to reading block

- **WHEN** a `video-based` session targets a domain with no video-sourced chunks above the threshold
- **THEN** that item is generated as a normal reading block rather than a YouTube-embed item, and the session is never empty

### Requirement: Session resume

`StudySession` SHALL track `lastItemIndex` and per-item completion flags. While a user is away the session SHALL remain `active`. On returning, the system SHALL resume from the last incomplete item.

#### Scenario: Completing an item advances progress

- **WHEN** a user POSTs completion for the item at index 2 of an active session
- **THEN** that `SessionItem`'s completed flag is set and the session's `lastItemIndex` advances to the next incomplete item

#### Scenario: Resuming returns the last incomplete item position

- **WHEN** a user GETs an active session whose items 0–2 are complete and item 3 is incomplete
- **THEN** the response reports `lastItemIndex: 3` so the client resumes at item 3

### Requirement: End a session

The system SHALL end an `active` session via `POST /api/v1/sessions/:id/end`, recording `endedAt`, elapsed duration, and a completion status reflecting whether all items were completed. Ending SHALL be idempotent for an already-ended session and SHALL be scoped to the owning user.

#### Scenario: Ending records completion metadata

- **WHEN** a user POSTs `/api/v1/sessions/:id/end` for their active session with all items completed
- **THEN** the response is `200`, `status` is `completed`, `endedAt` is set, and the recorded duration is present

#### Scenario: Ending a partially completed session

- **WHEN** a user ends a session with some items still incomplete
- **THEN** `endedAt` is set and the completion status reflects partial completion (not `completed`)

#### Scenario: Ending another user's session is not found

- **WHEN** a user POSTs `/end` for a session id belonging to another user
- **THEN** the response is `404`

### Requirement: Session history list

The system SHALL expose a paginated, user-scoped session history list with filters (e.g. by certification and status), returning the collection envelope `{ data[], meta }` with default page size 25 and max 100.

#### Scenario: List returns only the requesting user's sessions

- **WHEN** an authenticated user GETs `/api/v1/sessions`
- **THEN** the response is `200` with `{ data[], meta }` containing only sessions owned by that user, newest first

#### Scenario: Filtering by certification

- **WHEN** a user GETs `/api/v1/sessions?certificationId=<id>`
- **THEN** only sessions for that certification are returned

### Requirement: Abandonment cleanup cron

A `apps/worker` scheduled job SHALL mark `StudySession` records in `active` status older than 24 hours as `abandoned`. Session-linked agent conversations are retired together with their session by this cleanup.

#### Scenario: Stale active sessions are abandoned

- **WHEN** the cleanup cron runs and a `StudySession` has been `active` with `startedAt` more than 24 hours ago
- **THEN** its status is set to `abandoned`

#### Scenario: Recent active sessions are untouched

- **WHEN** the cleanup cron runs and a session has been `active` for 2 hours
- **THEN** its status remains `active`

### Requirement: Active session count metric

The system SHALL emit a Prometheus gauge reflecting the current count of `active` `StudySession`s.

#### Scenario: Gauge reflects active sessions

- **WHEN** the `/metrics` endpoint is scraped
- **THEN** it exposes a gauge for active session count consistent with the number of `active` `StudySession` rows
