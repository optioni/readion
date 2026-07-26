## ADDED Requirements

### Requirement: Certification detail distinguishes loading, empty, and failure

The certification-detail header, overview data, session history, and exam history SHALL render bounded loading states while their initial requests are unresolved. Empty-state copy SHALL appear only after the corresponding request succeeds with no rows. A failed request SHALL render a section-local error with Retry, and retrying one section MUST NOT discard successful content in another section.

#### Scenario: Session history does not flash empty while loading

- **WHEN** the certification header has loaded and Playwright delays the session-history request
- **THEN** the Sessions tab renders a loading presentation with `aria-busy="true"`
- **AND** the no-sessions empty state is absent until a successful zero-row response is received

#### Scenario: Failed exam history retries locally

- **WHEN** session history succeeds but the first exam-history request fails
- **THEN** the Exam History view shows a section-local error and Retry while the successful certification content remains rendered
- **AND** activating Retry issues one additional exam-history request

### Requirement: Certification header launch actions expose progress

Start-session and mock-exam controls in the certification header SHALL follow the shared busy-state contract. The initiating control SHALL show a spinner and "Starting…", expose `aria-busy="true"`, and reject duplicate activation until the request settles. A failed launch SHALL keep the user on the detail page, show an action-local error, and return the control to an enabled retryable state.

#### Scenario: Header Start session fails without losing context

- **WHEN** the user activates Start session and the request returns an RFC 7807 error
- **THEN** Start session shows "Starting…" only while the request is pending
- **AND** after failure the user remains on the certification-detail route, an action-local error is visible, and Start session is enabled for another explicit activation
