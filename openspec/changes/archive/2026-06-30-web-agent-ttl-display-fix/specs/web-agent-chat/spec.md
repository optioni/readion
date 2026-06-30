## MODIFIED Requirements

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
