# Spec: web-agent-chat

## Purpose

Defines the behaviour of the standalone AI chat page (`/agent`) in the `apps/web` frontend. The page lets authenticated users have a free-form conversation with the AI tutor outside of any study session or mock exam. It creates and manages a single standalone `AgentConversation`, streams assistant responses over SSE, and surfaces the conversation's sliding 4-hour inactivity TTL client-side. No cert-scoped tools, tool cards, or citation chips are rendered on this page.
## Requirements
### Requirement: Standalone chat page entry and conversation creation

The web app SHALL expose a standalone `/agent` chat page. The page SHALL present as a **full-height chat shell** (matching `openspec/design/AgentChat.html`): it opts out of the default padded shell via `definePageMeta({ layout })` (the minimal/full-height layout, as the session runner and mock-exam scenes do), pinning the header to the top, letting only the message region scroll, and pinning the composer to the bottom. The message thread SHALL be centered at the manifest `~760px` content width; the page itself MUST NOT scroll as a whole inside default page padding.

User and assistant message bubbles SHALL use the design's color roles: **user bubbles** use the surface background with secondary text, and **assistant bubbles** use the primary background with white text — the app MUST NOT invert these. Each assistant bubble SHALL be preceded by a per-message circular sparkle avatar.

The composer SHALL disable/grey the Send button while the textarea is empty and enable it once it has content. The input placeholder SHALL use the ellipsis character ("Ask anything…"). The TTL pill SHALL include a clock icon and the New-chat button a refresh icon.

#### Scenario: Chat renders as a full-height shell

- **WHEN** the `/agent` page renders
- **THEN** the header is pinned to the top, only the message region scrolls, and the composer is pinned to the bottom
- **AND** the thread is centered at the ~760px width and the whole page does not scroll inside default padding

#### Scenario: Bubble color roles match the design

- **WHEN** the thread renders user and assistant messages
- **THEN** user bubbles use the surface + secondary-text treatment and assistant bubbles use the primary + white treatment (not swapped)
- **AND** each assistant bubble shows a per-message sparkle avatar

#### Scenario: Send button reflects input state

- **WHEN** the composer textarea is empty
- **THEN** the Send button is disabled/greyed
- **WHEN** the textarea has content
- **THEN** the Send button is active

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

The standalone chat SHALL stream an agent turn over SSE, appending tokens to the in-progress assistant message. During streaming a blinking cursor SHALL render **inline at the end of the last paragraph** of the streaming assistant bubble, colored white-on-primary (matching `openspec/design/AgentChat.html`) — not as a separate muted block rendered after the whole message list. On completion the assistant turn SHALL render as discrete paragraphs (the stored turn is split for presentation); persistence of the turn is unchanged.

#### Scenario: Streaming cursor renders inline in the assistant bubble

- **WHEN** an agent turn is streaming
- **THEN** the cursor blinks inline at the end of the last paragraph inside the primary-colored assistant bubble (white), not as a muted sibling block after the list

#### Scenario: Completed assistant turn renders as paragraphs

- **WHEN** a multi-paragraph assistant turn has finished streaming
- **THEN** it renders as discrete paragraphs with spacing, not one pre-wrapped block

### Requirement: No tool cards and no citations in standalone chat

Because the standalone agent has no certification or session context and no cert-scoped tools, the system SHALL NOT render tool-result cards (`getUserProgress`, `getSessionHistory`, `explainAnswer`, `examStrategy`, `fetchMoreMaterial`) nor source-citation chips on the standalone chat page. The page SHALL render only user and assistant text bubbles plus error states. It SHALL communicate that answers come from general knowledge only.

#### Scenario: Tool-result and job events do not render cards

- **WHEN** the standalone chat renders an assistant turn
- **THEN** no `ToolCard*` component and no citation chip is rendered, regardless of stream event content
- **THEN** the page displays a "general knowledge only · no exam-specific tools" affordance (header subtitle and/or input footer)

### Requirement: Empty-state suggestions seed the first message

The system SHALL show suggestion chips in the empty state; activating a suggestion SHALL populate and send it as the first user turn. The empty state SHALL render a circular **star avatar** above the "Study assistant" heading (matching `openspec/design/AgentChat.html`). The suggestion chips SHALL be laid out as a **vertical, full-width stack** — one chip per row — and each chip SHALL carry a **trailing `→` arrow**, rather than a horizontal row of chips without arrows.

#### Scenario: Empty state renders the star avatar above the heading

- **WHEN** a brand-new conversation renders the empty state
- **THEN** a circular star avatar is shown above the "Study assistant" heading

#### Scenario: Suggestion chips are a vertical full-width stack with arrows

- **WHEN** the empty state renders its suggestion chips
- **THEN** the chips are stacked vertically, one per row, each spanning the available width
- **THEN** each chip displays a trailing `→` arrow

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

The standalone conversation has a sliding 4-hour inactivity TTL refreshed on each message (owned by the backend `agent` change). The page SHALL surface this client-side, deriving the remaining idle time from the conversation's `lastActivityAt` plus a single 4-hour window constant (`lastActivityAt + 4h - now`), and SHALL treat a missing or not-yet-loaded `lastActivityAt` as a full window so a fresh conversation never reads as expired.

The page SHALL NOT render a persistent "Expires in 0m" pill. Instead, the TTL is surfaced as an **inactivity-warning banner** shown only when the remaining idle time falls at or below the near-expiry threshold (low double-digit minutes; the implementation threshold is 15 minutes, within which the artboard's 12-minute example sits), matching the `ExpiryBanner` treatment in `openspec/design/AgentChat.html`. When the conversation is not near expiry, no banner is shown. Sending a message SHALL refresh `lastActivityAt` (resetting the window), recompute the remaining time, and hide the banner. The page MUST NOT depend on any conversation-list endpoint (none exists); only single-conversation create/detail/stream are used.

#### Scenario: Fresh conversation shows full TTL and no expiry banner

- **WHEN** a standalone conversation has just been created and its `lastActivityAt` is at (or near) the current time
- **THEN** the remaining idle time computed from `lastActivityAt + 4h` is approximately the full 4-hour window
- **THEN** no inactivity-warning banner is rendered and no "Expires in 0m" indicator is shown

#### Scenario: Warning banner appears near expiry with correct remaining time

- **WHEN** the remaining idle time (`lastActivityAt + 4h - now`) falls at or below the near-expiry threshold
- **THEN** an inactivity-warning banner is shown prompting the user to send a message to reset the timer
- **THEN** the banner states the remaining time in whole minutes computed from `lastActivityAt + 4h - now`

#### Scenario: Sending a message resets the TTL and hides the banner

- **WHEN** the inactivity-warning banner is visible and the user sends a new message
- **THEN** `lastActivityAt` is refreshed to the send time, resetting the 4-hour window
- **THEN** the remaining idle time recomputes to approximately the full window and the banner is hidden

