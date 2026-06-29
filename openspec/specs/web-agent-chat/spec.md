# Spec: web-agent-chat

## Purpose

Defines the behaviour of the standalone AI chat page (`/agent`) in the `apps/web` frontend. The page lets authenticated users have a free-form conversation with the AI tutor outside of any study session or mock exam. It creates and manages a single standalone `AgentConversation`, streams assistant responses over SSE, and surfaces the conversation's sliding 4-hour inactivity TTL client-side. No cert-scoped tools, tool cards, or citation chips are rendered on this page.

## Requirements

### Requirement: Standalone chat page entry and conversation creation

The system SHALL expose a standalone agent chat page at the `apps/web` route `/agent`, rendered inside the `web-foundation` authenticated app shell with the "Ask AI" sidebar item active. On entering the page with no active conversation, the system SHALL create a standalone conversation via `POST /api/v1/agent-conversations` (`agentControllerCreateStandalone`) and retain the returned conversation `id` for the streaming and hydration calls.

#### Scenario: Page creates a standalone conversation on first load

- **WHEN** an authenticated user navigates to `/agent` and no conversation id is held
- **THEN** the page issues `POST /api/v1/agent-conversations` exactly once
- **THEN** the response `data.mode` is `standalone`, `data.studySessionId` is `null`, and `data.certificationId` is `null`
- **THEN** the returned `data.id` is stored and used as the conversation id for subsequent message and hydration requests

#### Scenario: Page requires authentication

- **WHEN** an unauthenticated visitor requests `/agent`
- **THEN** the `web-foundation` auth route middleware redirects to the login page and no conversation is created

### Requirement: Hydrating an existing conversation's messages

The system SHALL hydrate prior messages of the active conversation via `GET /api/v1/agent-conversations/:id?include=messages` (`agentControllerDetail`), reusing the `hydrateAgentMessages` helper to keep only `user` and `assistant` text messages, and SHALL render them in order before the user sends a new turn.

#### Scenario: Existing user/assistant messages are rendered on hydrate

- **WHEN** the active conversation is fetched with `include=messages` and `relationships.messages.data` contains an ordered list of `user` and `assistant` messages
- **THEN** each `user` and `assistant` message with non-empty text content is rendered as a bubble in array order
- **THEN** `tool` and `system` messages are not rendered as bubbles

#### Scenario: A brand-new conversation renders the empty state

- **WHEN** the active conversation has no messages
- **THEN** the empty state is shown with the assistant intro and the suggestion chips, and the message list is not rendered

### Requirement: Streaming an agent turn over SSE

The system SHALL send a user turn by `POST /api/v1/agent-conversations/:id/messages` with body `{ content }` and consume the `text/event-stream` response with the `useAgentTurnStream` fetch-reader composable. It SHALL append the user message immediately, append an assistant message that accumulates `text-delta` events, show a streaming cursor on the in-flight assistant message until the stream ends (`[DONE]`), and disable the send control while a turn is streaming.

#### Scenario: Assistant response streams token by token

- **WHEN** the user submits a non-empty message and the SSE response emits a sequence of `text-delta` events followed by `[DONE]`
- **THEN** the user message bubble appears immediately with the submitted text
- **THEN** an assistant bubble is appended whose text grows as each `text-delta` is applied
- **THEN** a streaming cursor is shown on the assistant bubble while the stream is open and removed once `[DONE]` is received
- **THEN** the send control is disabled while streaming and re-enabled after the stream completes

#### Scenario: Empty input is not sent

- **WHEN** the input is empty or whitespace-only and the user activates send
- **THEN** no `POST /api/v1/agent-conversations/:id/messages` request is made

#### Scenario: Stream error is rendered on the assistant message

- **WHEN** the SSE stream emits an `error` event or the request fails with a non-OK status
- **THEN** the error text is rendered on the in-flight assistant message and the send control is re-enabled

### Requirement: No tool cards and no citations in standalone chat

Because the standalone agent has no certification or session context and no cert-scoped tools, the system SHALL NOT render tool-result cards (`getUserProgress`, `getSessionHistory`, `explainAnswer`, `examStrategy`, `fetchMoreMaterial`) nor source-citation chips on the standalone chat page. The page SHALL render only user and assistant text bubbles plus error states. It SHALL communicate that answers come from general knowledge only.

#### Scenario: Tool-result and job events do not render cards

- **WHEN** the standalone chat renders an assistant turn
- **THEN** no `ToolCard*` component and no citation chip is rendered, regardless of stream event content
- **THEN** the page displays a "general knowledge only · no exam-specific tools" affordance (header subtitle and/or input footer)

### Requirement: Empty-state suggestions seed the first message

The system SHALL show suggestion chips in the empty state; activating a suggestion SHALL populate and send it as the first user turn.

#### Scenario: Suggestion chip starts the conversation

- **WHEN** the user activates a suggestion chip in the empty state
- **THEN** the suggestion text is submitted as a user turn via `POST /api/v1/agent-conversations/:id/messages`
- **THEN** the empty state is replaced by the message list

### Requirement: New chat resets the conversation

The system SHALL provide a "New chat" affordance that discards the current conversation from view and creates a fresh standalone conversation via `POST /api/v1/agent-conversations`, returning the page to the empty state.

#### Scenario: New chat starts a fresh standalone conversation

- **WHEN** the user activates "New chat" while a conversation with messages is shown
- **THEN** the rendered messages are cleared and the empty state is shown
- **THEN** a new `POST /api/v1/agent-conversations` request is made and its `data.id` becomes the active conversation id

### Requirement: Surface the sliding 4-hour inactivity TTL

The standalone conversation has a sliding 4-hour inactivity TTL refreshed on each message (owned by the backend `agent` change). The page SHALL surface this client-side, derived from the conversation's `lastActivityAt`: a header indicator of remaining idle time, and an inactivity-warning banner when the remaining time is low. Sending a message SHALL refresh the indicator. The page MUST NOT depend on any conversation-list endpoint (none exists); only single-conversation create/detail/stream are used.

#### Scenario: Header shows remaining idle time

- **WHEN** a conversation is active with a known `lastActivityAt`
- **THEN** the header shows a "resets after 4h idle" indicator with the remaining time computed from `lastActivityAt + 4h`

#### Scenario: Warning banner appears near expiry

- **WHEN** the remaining idle time falls below the warning threshold
- **THEN** an inactivity-warning banner is shown prompting the user to send a message to reset the timer
- **THEN** sending a message updates `lastActivityAt` and recomputes the remaining time, hiding the banner
