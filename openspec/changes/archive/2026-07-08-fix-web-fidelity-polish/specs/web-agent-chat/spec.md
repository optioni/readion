## MODIFIED Requirements

### Requirement: Standalone chat page entry and conversation creation

The system SHALL expose a standalone agent chat page at the `apps/web` route `/agent`, rendered inside the `web-foundation` authenticated app shell with the "Ask AI" sidebar item active. On entering the page with no active conversation, the system SHALL create a standalone conversation via `POST /api/v1/agent-conversations` (`agentControllerCreateStandalone`) and retain the returned conversation `id` for the streaming and hydration calls.

The in-page chat header SHALL present the agent's identity to match `openspec/design/AgentChat.html`: a circular **star avatar** followed by the title **"Study assistant"** (not "Ask AI"), with the "General knowledge · no session context" subtitle beneath the title. The header title MUST NOT read "Ask AI".

#### Scenario: Page creates a standalone conversation on first load

- **WHEN** an authenticated user navigates to `/agent` and no conversation id is held
- **THEN** the page issues `POST /api/v1/agent-conversations` exactly once
- **THEN** the response `data.mode` is `standalone`, `data.studySessionId` is `null`, and `data.certificationId` is `null`
- **THEN** the returned `data.id` is stored and used as the conversation id for subsequent message and hydration requests

#### Scenario: Header shows the star-avatar "Study assistant" identity

- **WHEN** the `/agent` chat header renders
- **THEN** a circular star avatar is shown beside the title "Study assistant"
- **THEN** the header title does not read "Ask AI" and the "General knowledge · no session context" subtitle is present

#### Scenario: Page requires authentication

- **WHEN** an unauthenticated visitor requests `/agent`
- **THEN** the `web-foundation` auth route middleware redirects to the login page and no conversation is created

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
