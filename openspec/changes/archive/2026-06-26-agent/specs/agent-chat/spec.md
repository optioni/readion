## ADDED Requirements

### Requirement: Create an in-session agent conversation

The system SHALL create an `AgentConversation` linked to one of the requesting user's own `active` or `completed` `StudySession`s. The conversation SHALL be scoped to that session's certification, carry the in-session (cert-scoped, tooled) mode, and have no independent timeout. Creating against a session owned by another user SHALL return `404`.

#### Scenario: Create a conversation for an owned session

- **WHEN** an authenticated user POSTs to `/api/v1/sessions/:id/agent-conversations` for their own `active` session
- **THEN** the response is `201` with envelope `{ data, relationships }` where `data` includes `mode: "in_session"`, `studySessionId` set to the session id, and `certificationId` resolved from the session
- **THEN** an `AgentConversation` row exists scoped to the user with `lastActivityAt` set

#### Scenario: Session owned by another user is not found

- **WHEN** a user POSTs to create a conversation for a `StudySession` id belonging to a different user
- **THEN** the response is `404` (ownership is enforced at the repository layer by scoping on `userId`)

### Requirement: Create a standalone agent conversation

The system SHALL create a standalone `AgentConversation` for the requesting user with no certification context, no session link, and no cert-scoped tools. The conversation SHALL carry a sliding 4-hour inactivity TTL anchored on `lastActivityAt`.

#### Scenario: Create a standalone conversation

- **WHEN** an authenticated user POSTs to `/api/v1/agent-conversations` with no session reference
- **THEN** the response is `201` with `data.mode: "standalone"`, `studySessionId: null`, and `certificationId: null`
- **THEN** an `AgentConversation` row exists scoped to the user with `lastActivityAt` set to now

### Requirement: Stream an agent turn over SSE

The system SHALL expose a message endpoint that accepts a user message, persists it, runs the Vercel AI SDK streaming loop with the conversation's mode-appropriate model and tools, and streams the response to the client over Server-Sent Events. All LLM calls SHALL go through the `llm-foundation` gateway (no provider SDK imported directly). The stream SHALL emit ordered events for assistant text deltas, tool invocations, tool results, and a terminal completion event.

#### Scenario: Streaming a text response

- **WHEN** an authenticated user POSTs a message to `/api/v1/agent-conversations/:id/messages` for their own conversation
- **THEN** the response has `Content-Type: text/event-stream`
- **THEN** the client receives ordered text-delta events forming the assistant reply followed by a terminal completion event

#### Scenario: User message and assistant reply are persisted

- **WHEN** a streamed turn completes
- **THEN** an `AgentMessage` row with `role: "user"` exists for the submitted message
- **THEN** one or more `AgentMessage` rows with `role: "assistant"` (and any `role: "tool"` rows produced) exist in turn order
- **THEN** the conversation's `lastActivityAt` is refreshed to the turn time

#### Scenario: Posting to another user's conversation is not found

- **WHEN** a user POSTs a message to an `AgentConversation` id belonging to a different user
- **THEN** the response is `404`

### Requirement: Messages persist as ordered CoreMessage JSONB rows

The system SHALL persist every message — user, assistant text, tool-call invocation, and tool result — as a separate `AgentMessage` row whose JSONB `content` mirrors the Vercel AI SDK `CoreMessage` type (string or content-part array), preserving turn order. The role SHALL be one of `user` | `assistant` | `tool` | `system`.

#### Scenario: Tool call and tool result are separate rows

- **WHEN** an in-session turn invokes a tool and receives its result
- **THEN** the tool-call invocation and the tool result are persisted as distinct `AgentMessage` rows with the correct roles, ordered between the triggering user message and the final assistant message

### Requirement: Resume a conversation by replaying its messages

The system SHALL reconstruct conversation state by fetching the full ordered `AgentMessage` array and passing it directly to the Vercel AI SDK, so a resumed turn continues from the exact prior state.

#### Scenario: A follow-up turn includes prior context

- **WHEN** a user sends a second message to an existing conversation that already has prior user/assistant rows
- **THEN** the ordered prior messages are loaded and supplied to the SDK ahead of the new user message, and the assistant reply reflects that context

#### Scenario: Get a conversation with its messages

- **WHEN** a user GETs `/api/v1/agent-conversations/:id?include=messages` for their own conversation
- **THEN** the response is `200` with the conversation `data` and its ordered `messages` in `relationships`, scoped to the user

### Requirement: In-session system prompt is layered for prompt caching

For in-session conversations the system SHALL build the system prompt in stable-prefix layers suitable for prompt caching: a **static** layer (certification name, provider, exam format, domain list with weights, exam-strategy guidelines), a **semi-static** layer (the user's top-5 weak-area domains with scores, current readiness score, active-session domain focus), and no per-request dynamic data in the prompt (per-request data is fetched via tools). Standalone conversations SHALL use a minimal general-tutor prompt with no certification layers and no tools.

#### Scenario: In-session prompt contains static and semi-static layers

- **WHEN** an in-session turn is built for a certification with defined domains and a user with weak areas and a readiness score
- **THEN** the assembled system prompt includes the certification exam format and weighted domains (static) and the user's top-5 weak areas plus readiness (semi-static), with cache-control applied to the stable prefix

#### Scenario: Standalone prompt has no cert context or tools

- **WHEN** a standalone turn is built
- **THEN** the system prompt contains no certification or weak-area context and the SDK call is configured with an empty tool set

### Requirement: Standalone conversations expire on a sliding 4-hour inactivity TTL

The system SHALL refresh a standalone conversation's `lastActivityAt` on each message and SHALL soft-delete standalone conversations whose `lastActivityAt` is older than 4 hours via a `@nestjs/schedule` cron in `apps/worker`. Session-linked conversations SHALL NOT be affected by this cron — they are retired with their `StudySession`.

#### Scenario: Inactive standalone conversation is soft-deleted

- **WHEN** the TTL-cleanup cron runs and a standalone conversation's `lastActivityAt` is 5 hours old
- **THEN** that conversation is soft-deleted

#### Scenario: Recently active standalone conversation is retained

- **WHEN** the cron runs and a standalone conversation's `lastActivityAt` is 1 hour old
- **THEN** that conversation is left untouched

#### Scenario: Session-linked conversation is ignored by the TTL cron

- **WHEN** the cron runs and an in-session conversation's `lastActivityAt` is 10 hours old
- **THEN** that conversation is left untouched (its lifecycle follows its `StudySession`)

### Requirement: Agent SSE error rate is observable

The system SHALL emit a Prometheus metric capturing agent turn outcomes (success vs. error) so the agent/SSE error rate guardrail can be tracked.

#### Scenario: A failed turn increments the error metric

- **WHEN** an agent turn fails (e.g. the LLM gateway errors mid-stream)
- **THEN** the agent error counter is incremented and the failure is surfaced to the client as an SSE error event rather than a silent hang
