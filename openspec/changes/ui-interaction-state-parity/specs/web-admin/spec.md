## ADDED Requirements

### Requirement: Admin mutations identify the exact operation in progress

Admin review Approve/Reject, certification re-verification, and certification draft creation SHALL follow the shared busy-state contract. When multiple actions are adjacent, only the initiating action SHALL show its spinner and progressive copy ("Approving…", "Rejecting…", "Re-verifying…", or "Creating…"); conflicting actions SHALL be unavailable but MUST NOT impersonate the busy action. A failed mutation SHALL preserve the reviewed record or wizard input, show an operation-local error, and return the initiating action to an enabled state.

#### Scenario: Approve identifies itself while Reject remains distinct

- **WHEN** an admin activates Approve for a quarantined item and the request remains pending
- **THEN** Approve shows a spinner with "Approving…" and exposes `aria-busy="true"`
- **AND** Reject is unavailable without showing "Approving…" or a spinner
- **AND** repeated activation sends no duplicate approval request

#### Scenario: Failed rejection preserves review evidence

- **WHEN** an admin activates Reject and the request returns an RFC 7807 error
- **THEN** the source evidence and reviewed item remain visible
- **AND** an operation-local error is shown and Reject returns to an enabled state

#### Scenario: Draft creation exposes progress

- **WHEN** an admin submits a valid certification setup review and the create request remains pending
- **THEN** the submit action shows a spinner with "Creating…", exposes `aria-busy="true"`, and rejects duplicate submission

### Requirement: Admin collection reads retain retryable state

Admin list and detail screens SHALL use a consistent loading/error/Retry presentation. A Retry activation SHALL repeat only the failed read, and a background refresh SHALL preserve the last successful rows. Existing shared admin async messaging SHALL satisfy the same semantics and accessibility contract as learner-facing async regions.

#### Scenario: Review queue retry preserves successful shell

- **WHEN** the Admin shell loads but the first review-queue request fails
- **THEN** the shell and navigation remain visible while the queue region shows an error and Retry
- **AND** activating Retry sends one new queue request and replaces the error with returned rows
