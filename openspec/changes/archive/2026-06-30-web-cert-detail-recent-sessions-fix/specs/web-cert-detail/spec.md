## MODIFIED Requirements

### Requirement: Overview tab shows recent sessions with accuracy

The Overview tab SHALL show up to the last three sessions for the certification from `GET /api/v1/sessions?certificationId=<certificationId>&limit=3`, each completed session joined with its `GET /api/v1/sessions/:id/summary` to show a domain label and accuracy; a session without an available summary MUST fall back to a date and focus-area label without an accuracy figure. When the enrollment has no sessions yet, the panel MUST show a "no sessions yet" placeholder.

Each recent-session row MUST render a human-readable label derived from the session's typed fields — its session type (`kind`: study/review) and its date (`startedAt`) — and MUST NOT stringify a structured field. In particular, the row label MUST NOT render the literal string `[object Object]`: the session `focusArea` is a structured discriminated-union object (`{ mode: 'auto' }` or `{ mode: 'domains', domains: [...] }`) and MUST be formatted into text rather than coerced with `String(...)`. The accuracy figure MUST reflect the joined summary's real per-session `accuracy` value, never a hardcoded `0%` fallback; a row whose summary is unavailable shows no accuracy figure rather than `0%`.

#### Scenario: Recent completed sessions show accuracy

- **WHEN** the three most recent completed sessions report accuracies of 80%, 64%, and 73%
- **THEN** the recent-sessions panel lists three rows, each with a typed/dated label and its real accuracy
- **AND** no row shows a hardcoded `0%` in place of its actual accuracy

#### Scenario: Row label never renders [object Object]

- **WHEN** a recent session has a structured `focusArea` such as `{ mode: 'domains', domains: ['IAM'] }`
- **THEN** the row renders a readable label from the session type and date
- **AND** the row text never contains the literal string `[object Object]`

#### Scenario: No sessions shows a placeholder

- **WHEN** the enrollment has no sessions
- **THEN** the recent-sessions panel shows a "no sessions yet" placeholder
