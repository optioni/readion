## MODIFIED Requirements

### Requirement: Weekly digest opt-out

`User.digestOptOut` SHALL be mutable through **two** paths that write the same field: the existing public tokenized one-click `GET /api/v1/email/unsubscribe?token=...` link in the digest email (opt-out only), and the authenticated `PATCH /api/v1/users/me { digestOptOut }` two-way toggle. Digest send-eligibility logic is unchanged — the weekly-digest cron continues to skip any user whose `digestOptOut` is `true`, regardless of which path set it.

#### Scenario: Both paths converge on the same field

- **WHEN** a user opts out via the email unsubscribe link and later opts back in via authenticated Settings (`PATCH /users/me { digestOptOut: false }`)
- **THEN** the weekly-digest cron treats them as eligible again
- **AND** the tokenized unsubscribe link continues to function unchanged for users who only have the email
