## ADDED Requirements

### Requirement: In-session agent exposes the cert-scoped tool set

For in-session conversations the system SHALL make available exactly these tools, all scoped to the session's certification and the requesting user: `semanticSearch`, `fetchMoreMaterial`, `explainAnswer`, `examStrategy`, `getUserProgress`, `getSessionHistory`. Standalone conversations SHALL expose none of these tools.

#### Scenario: In-session turn has all six tools available

- **WHEN** an in-session turn is configured for the SDK
- **THEN** the tool set passed to the SDK contains `semanticSearch`, `fetchMoreMaterial`, `explainAnswer`, `examStrategy`, `getUserProgress`, and `getSessionHistory`

#### Scenario: Standalone turn has no cert-scoped tools

- **WHEN** a standalone turn is configured for the SDK
- **THEN** the tool set is empty

### Requirement: Grounding and abstention contract

The in-session agent SHALL answer only from retrieved context and cite its sources, and SHALL abstain ("I don't have enough material on that") rather than guess when retrieval coverage is thin. An abstention MAY trigger `fetchMoreMaterial`.

#### Scenario: Thin coverage produces an abstention, not a guess

- **WHEN** an in-session question's `semanticSearch` returns no chunks above the similarity threshold
- **THEN** the agent abstains rather than answering from unsupported general knowledge, and may invoke `fetchMoreMaterial`

### Requirement: semanticSearch retrieves chunks by embedding similarity

`semanticSearch` SHALL query `content_chunks` scoped to the session's certification by embedding similarity and return a capped, ranked set of chunks. Its result informs the agent's text response and is not rendered as its own UI component.

#### Scenario: semanticSearch returns ranked cert-scoped chunks

- **WHEN** the agent invokes `semanticSearch` with a query during an in-session turn
- **THEN** the tool returns chunks from that certification's corpus ranked by similarity, capped to the configured limit

### Requirement: fetchMoreMaterial fast path generates inline

`fetchMoreMaterial` SHALL default to a fast path that generates expanded material from chunks already retrievable above the similarity threshold, inline within the agent turn and without enqueuing a worker job.

#### Scenario: Adequate coverage resolves inline

- **WHEN** the agent invokes `fetchMoreMaterial` on a topic whose chunks clear the similarity threshold
- **THEN** the tool returns `{ status: "inline", content }` generated from existing chunks within the same turn, and no ingestion job is enqueued

### Requirement: fetchMoreMaterial slow path enqueues a high-priority ingestion job

When chunk coverage is genuinely thin, `fetchMoreMaterial` SHALL enqueue a high-priority ingestion job on the `content-pipeline` queue and return its `jobId` without waiting for completion. The system SHALL bridge that job's BullMQ events onto the conversation's SSE channel; on job completion the agent SHALL re-run `semanticSearch` and continue. Ingested chunks SHALL be persisted to the shared knowledge base even if the client disconnects before completion.

#### Scenario: Thin coverage enqueues a job and returns a jobId

- **WHEN** the agent invokes `fetchMoreMaterial` on a topic with no chunks above the similarity threshold
- **THEN** a high-priority job is enqueued on the ingestion queue and the tool returns `{ status: "enqueued", jobId }`
- **THEN** the new content does not arrive synchronously in the same turn

#### Scenario: Job completion is bridged over SSE

- **WHEN** the enqueued ingestion job completes while the SSE connection is open
- **THEN** a job-completion event is emitted on the conversation's SSE channel and the agent re-runs `semanticSearch` to continue with the new material

#### Scenario: Disconnect does not waste ingested work

- **WHEN** the client disconnects before the enqueued job finishes
- **THEN** the job still completes and its chunks are persisted to the shared `content_chunks`, available to future turns and sessions

### Requirement: explainAnswer derives from stored provenance

`explainAnswer` SHALL produce a structured explanation of a quiz answer using the persisted `SessionItem` provenance (`sourceChunkIds`, `supportingSpans`, verifier verdict) for one of the requesting user's own sessions, returning the explanation with a real source citation. It SHALL NOT re-invent a source.

#### Scenario: Explanation cites stored provenance

- **WHEN** the agent invokes `explainAnswer` for a quiz `SessionItem` in the user's own session
- **THEN** the tool returns a structured explanation including the correct answer and a citation derived from the item's stored `sourceChunkIds`/`supportingSpans`

#### Scenario: Provenance from another user's item is not accessible

- **WHEN** `explainAnswer` is invoked referencing a `SessionItem` belonging to a different user
- **THEN** no provenance is returned (repository-layer `userId` scoping yields not-found)

### Requirement: getUserProgress returns readiness and weak areas

`getUserProgress` SHALL return the requesting user's current exam-readiness score, per-domain weak-area scores, and confidence ratings for the session's certification, read from the `readiness` and `weak-areas` modules.

#### Scenario: Progress reflects current readiness and weak areas

- **WHEN** the agent invokes `getUserProgress` during an in-session turn
- **THEN** the tool returns the current readiness score plus ranked per-domain weak-area scores and confidence ratings for that enrollment, shaped for inline rendering (domain score bars + readiness chip)

### Requirement: getSessionHistory returns recent performance trends

`getSessionHistory` SHALL return the user's recent study-session history (and mock-exam history where available) with per-domain accuracy trends for the session's certification, used to contextualize answers about performance and improvement.

#### Scenario: History returns recent sessions with accuracy trends

- **WHEN** the agent invokes `getSessionHistory` during an in-session turn
- **THEN** the tool returns a compact list of recent sessions with domain and accuracy, degrading to session-only history when no mock-exam data exists

### Requirement: examStrategy returns strategy advice

`examStrategy` SHALL return advice on question-type approach or domain strategy for the session's certification, shaped as a distinct tip payload.

#### Scenario: Strategy advice for a domain

- **WHEN** the agent invokes `examStrategy` for a given domain or question type
- **THEN** the tool returns a structured strategy tip distinct from regular chat text

### Requirement: Tool results carry structured payloads for inline rendering

Tools whose output is meaningful to the user (`getUserProgress`, `getSessionHistory`, `explainAnswer`, `examStrategy`, `fetchMoreMaterial`) SHALL return structured payloads identifiable by tool name so the frontend can render them as inline components. `semanticSearch` SHALL be internal-only (no user-facing component).

#### Scenario: Tool name identifies the render treatment

- **WHEN** any user-facing tool finalizes in a turn
- **THEN** the persisted tool-result `AgentMessage` carries the tool name and a structured payload the frontend can map to its inline component, while `semanticSearch` results are marked internal
