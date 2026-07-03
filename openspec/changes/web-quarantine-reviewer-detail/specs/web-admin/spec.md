## MODIFIED Requirements

### Requirement: Admin review queue

The `web-admin` console's Review queue section SHALL render the real quarantined-item list from `GET /api/v1/admin/quarantine` (paginated, filterable by certification/status) as a **two-pane master-detail reviewer**: a selectable item list on the left and a detail panel on the right for the selected item. Each list row SHALL show the item's certification, domain, and a formatted verdict indicator (not raw JSON). When an item is selected, the detail panel SHALL load that item via `GET /api/v1/admin/quarantine/:id` and render the item's **question, options, and answer key** (the option matching the answer key marked as the stored correct answer) together with a **human-formatted verdict** — a pass/fail label, the verdict score as a percentage, and the reason — instead of the raw verdict string. When the detail's mapped `content` is absent (`null`, for older or non-quiz rows), the panel SHALL render a graceful "no structured content" state while still showing the verdict, reason, and provenance. The panel SHALL offer **Approve** and **Reject** actions (the preserved audit-log vocabulary, not the artboard's "Edit key/Discard") wired to `POST /admin/quarantine/:id/approve` and `.../reject`; on success the item SHALL be removed from the pending list and the panel SHALL return to its empty state. Until an item is selected, the panel SHALL show an empty prompt; while the detail loads it SHALL show a loading state.

#### Scenario: Selecting a queue item opens the detail reviewer

- **WHEN** an admin opens the Review queue and selects a pending quarantined item
- **THEN** the item list highlights the selection and the detail panel loads the item via `GET /api/v1/admin/quarantine/:id`
- **AND** the panel renders the question, its options with the answer-key option marked, and a formatted verdict (pass/fail label + score % + reason) with no raw JSON

#### Scenario: Approve/Reject resolves the selected item

- **WHEN** the admin activates Approve or Reject in the detail panel
- **THEN** the corresponding `POST /admin/quarantine/:id/approve` or `.../reject` endpoint is called
- **AND** on success the item is removed from the pending list and the detail panel returns to its empty state

#### Scenario: Item without structured content degrades gracefully

- **WHEN** the selected item's detail returns `content: null` (an older row or a non-quiz domain)
- **THEN** the detail panel shows a "no structured content" state and still renders the formatted verdict, reason, and provenance without error

#### Scenario: No item selected

- **WHEN** the admin has not selected any queue item
- **THEN** the detail panel shows an empty prompt to select an item and no detail request is made
