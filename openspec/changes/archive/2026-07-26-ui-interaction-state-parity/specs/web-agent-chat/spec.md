## ADDED Requirements

### Requirement: Standalone conversation initialization is explicit and recoverable

The standalone chat page SHALL render a conversation-loading state while creating or hydrating the initial conversation and SHALL expose the conversation region as busy. It MUST NOT render the empty-state suggestions until initialization succeeds with no messages. If initialization fails, the page SHALL render a concise error and Retry; Retry SHALL issue one new initialization request without reloading the document.

#### Scenario: Delayed initialization does not flash suggestions

- **WHEN** Playwright delays standalone conversation initialization
- **THEN** the conversation region exposes `aria-busy="true"` and renders a loading presentation
- **AND** the empty-state heading and suggestion chips are absent until initialization succeeds

#### Scenario: Initialization failure can be retried

- **WHEN** the first initialization request fails and the second succeeds with an empty conversation
- **THEN** the page shows an error and Retry after the first response
- **AND** activating Retry sends exactly one new request and replaces the error with the empty-state suggestions

## MODIFIED Requirements

### Requirement: Surface the sliding 4-hour inactivity TTL

The chat page SHALL surface the conversation's sliding four-hour inactivity TTL only when expiry is actionable. On conversation creation/hydration it SHALL store the `expiresAt` timestamp from the API and derive a live remaining duration. While more than 30 minutes remain, no TTL chip, badge, banner, or persistent session-duration chrome SHALL be shown. When the remaining duration is at or below 30 minutes and above zero, a warning banner SHALL state that the chat expires after inactivity and show the rounded-up remaining minutes. The warning SHALL be a polite live status. Sending a message resets the server-side TTL; after the send response returns the refreshed `expiresAt`, the warning MUST disappear when the remaining duration is again above the threshold.

#### Scenario: Fresh conversation shows no TTL chrome

- **WHEN** the conversation API returns `expiresAt` approximately four hours in the future
- **THEN** no expiry warning, TTL chip, "4h session" badge, or remaining-duration label is rendered

#### Scenario: Warning banner appears near expiry with correct remaining time

- **WHEN** the hydrated conversation has an `expiresAt` 25 minutes in the future
- **THEN** the page shows a warning that the chat expires after inactivity with "25 minutes" remaining
- **AND** the warning is exposed through a polite status region

#### Scenario: Sending a message resets the TTL and hides the banner

- **WHEN** a near-expiry conversation shows the warning and the user sends a message
- **THEN** after the send completes with an `expiresAt` approximately four hours in the future, the warning is removed
