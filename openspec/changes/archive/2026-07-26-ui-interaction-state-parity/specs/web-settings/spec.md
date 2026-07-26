## ADDED Requirements

### Requirement: Settings reflows without phone-width overflow

At a 375px viewport, the Settings content column, tab strip, FieldRows, sliders, pill groups, action rows, and delete-account modal SHALL remain within the viewport. FieldRows SHALL stack their label and control regions when the horizontal form would otherwise overflow. Long timezone values and error text SHALL wrap or truncate within their control rather than widening the document. Every primary and destructive action MUST remain fully visible and keyboard reachable.

#### Scenario: All Settings tabs fit a 375px viewport

- **WHEN** Playwright opens Account, Study defaults, and Notifications at a 375px-wide viewport using a long IANA timezone and validation message
- **THEN** on every tab `document.documentElement.scrollWidth` does not exceed `window.innerWidth`
- **AND** labels, controls, and primary actions remain visible without horizontal page scrolling

### Requirement: Settings profile initialization is explicit and recoverable

Settings SHALL show a bounded loading presentation while `GET /api/v1/users/me` is unresolved and SHALL NOT render editable controls seeded with blank fallback values. If profile loading fails, the page SHALL show an error with Retry. Successful profile content SHALL remain visible during background refetch.

#### Scenario: Delayed profile does not render blank controls

- **WHEN** Playwright delays `GET /api/v1/users/me`
- **THEN** the Settings content region exposes `aria-busy="true"` and shows a loading presentation
- **AND** the email, timezone, session-default, and digest controls are not rendered with blank fallback values

#### Scenario: Failed profile load can be retried

- **WHEN** the first profile request fails and the second succeeds
- **THEN** Settings shows an error and Retry without rendering the form
- **AND** activating Retry issues one new request and replaces the error with the populated form

### Requirement: Settings mutations identify progress and outcome

Timezone save, password update, study-default save, digest-preference update, and account deletion SHALL follow the shared busy-state contract with action-specific copy. The initiating region SHALL preserve entered non-secret values, expose `aria-busy="true"`, reject duplicate submission, and render a polite success status or inline failure. Password values MUST follow the existing security behavior and MUST NOT be restored after failure. The digest switch SHALL expose busy state without presenting the optimistic position as persisted until the request succeeds; on failure it SHALL return to the last persisted position and announce the error. Account deletion SHALL show "Deleting…" only on the destructive confirmation action.

#### Scenario: Saving study defaults exposes progress

- **WHEN** the user activates Save defaults and the PATCH request remains pending
- **THEN** the action shows a spinner with "Saving…", exposes `aria-busy="true"`, and sends no duplicate request
- **AND** on success a polite confirmation is rendered and the action returns to its rest state

#### Scenario: Digest failure restores persisted state

- **WHEN** the loaded digest preference is enabled and the user turns it off but the PATCH request fails
- **THEN** the switch exposes busy state while pending
- **AND** after failure the switch returns to enabled, the error is announced, and the control is available for another activation

#### Scenario: Delete confirmation identifies destructive progress

- **WHEN** the user confirms account deletion with a password and the DELETE request is delayed
- **THEN** the destructive confirmation action shows a spinner with "Deleting…" and exposes `aria-busy="true"`
- **AND** the request cannot be submitted a second time
