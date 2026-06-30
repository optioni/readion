## MODIFIED Requirements

### Requirement: Admin review queue

The `web-admin` console's Review queue section SHALL render the real quarantined-item list from `GET /api/v1/admin/quarantine` (paginated, filterable by certification/status) with per-item verdict, reason, certification, domain, and provenance, and SHALL offer **Approve** and **Reject** actions wired to `POST /admin/quarantine/:id/approve` and `.../reject`. This replaces the honest placeholder shipped in the original `web-admin` change.

#### Scenario: Review queue lists and resolves items

- **WHEN** an admin opens the Review queue
- **THEN** pending quarantined items are listed with verdict/reason/provenance
- **AND** Approve/Reject on an item calls the corresponding endpoint and removes it from the pending list on success
