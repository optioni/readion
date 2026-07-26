## ADDED Requirements

### Requirement: Session creation and resume expose action-local progress

Quick start and custom start SHALL expose the same shared busy behavior while creating or resolving a session. The initiating control SHALL show a spinner and "Starting…", expose `aria-busy="true"`, retain its dimensions, and reject duplicate activation. When an existing active session is resumed, busy feedback SHALL remain until navigation begins. A failure SHALL keep the selected configuration intact and return the control to an enabled retryable state.

#### Scenario: Custom start preserves configuration after failure

- **WHEN** the user selects two domains and a 30-minute duration, activates Start session, and the request fails
- **THEN** the button shows "Starting…" only while pending and sends no duplicate request
- **AND** after failure the two domains and 30-minute duration remain selected, an error is shown, and Start session is enabled

#### Scenario: Quick start remains busy until resumed-session navigation

- **WHEN** Quick start resolves to an existing active session after a delayed response
- **THEN** Quick start exposes `aria-busy="true"` and "Starting…" until navigation begins
- **AND** exactly one create/resume request is sent

### Requirement: Remote reading expansion exposes loading and recovery

When "Read full explanation" requires remote material, the initiating control SHALL show a spinner and "Loading…", expose `aria-busy="true"`, and reject duplicate activation. Existing TL;DR content and citations MUST remain visible. On failure the content SHALL show an inline error with a Retry action; on success the expanded Markdown SHALL replace the progress feedback without moving keyboard focus unexpectedly.

#### Scenario: Full explanation loads without hiding the reading block

- **WHEN** the user activates "Read full explanation" and the response is delayed
- **THEN** the existing TL;DR and citations remain visible
- **AND** the control shows a spinner with "Loading…" and repeated activation sends no duplicate request

#### Scenario: Full explanation can be retried

- **WHEN** the first explanation request fails and the retry succeeds
- **THEN** an inline error and Retry are rendered without removing the TL;DR
- **AND** activating Retry once sends one new request and replaces the error with the expanded Markdown
