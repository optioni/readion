## MODIFIED Requirements

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

### Requirement: Streaming an agent turn over SSE

The standalone chat SHALL stream an agent turn over SSE, appending tokens to the in-progress assistant message. During streaming a blinking cursor SHALL render **inline at the end of the last paragraph** of the streaming assistant bubble, colored white-on-primary (matching `openspec/design/AgentChat.html`) — not as a separate muted block rendered after the whole message list. On completion the assistant turn SHALL render as discrete paragraphs (the stored turn is split for presentation); persistence of the turn is unchanged.

#### Scenario: Streaming cursor renders inline in the assistant bubble

- **WHEN** an agent turn is streaming
- **THEN** the cursor blinks inline at the end of the last paragraph inside the primary-colored assistant bubble (white), not as a muted sibling block after the list

#### Scenario: Completed assistant turn renders as paragraphs

- **WHEN** a multi-paragraph assistant turn has finished streaming
- **THEN** it renders as discrete paragraphs with spacing, not one pre-wrapped block
