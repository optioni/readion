## ADDED Requirements

### Requirement: QuarantinedItem entity owned by this change

The system SHALL own a `QuarantinedItem` entity (table + migration in `packages/db`) capturing a grounding-quarantined generated item: the source `ContentChunk`/provenance reference, the certification + domain, the verifier verdict and reason, the offending generated content (or a reference to it), a `status` (`pending` | `approved` | `rejected`), and timestamps. It SHALL be scoped so items can be listed per certification. If the grounding pipeline currently quarantines without persistence, this change adds the write at the quarantine point.

#### Scenario: Quarantine persists a reviewable record

- **WHEN** the grounding pipeline quarantines a generated item that failed verification
- **THEN** a `QuarantinedItem` row is created with `status: pending`, the verifier verdict/reason, certification, domain, and source-chunk provenance

### Requirement: Admin can list quarantined items

The system SHALL expose `GET /api/v1/admin/quarantine` to admins only, returning a paginated collection (default 25, max 100) of quarantined items with verdict, reason, certification, domain, and provenance, filterable by certification and status. Non-admins receive `403`.

#### Scenario: Admin lists the review queue

- **WHEN** an admin GETs `/api/v1/admin/quarantine?status=pending`
- **THEN** the response is a `200` collection envelope of pending quarantined items with `meta` pagination

#### Scenario: Non-admin is forbidden

- **WHEN** a non-admin user calls the endpoint
- **THEN** the response is `403` RFC 7807 and no data is returned

### Requirement: Admin can approve a quarantined item

The system SHALL expose `POST /api/v1/admin/quarantine/:id/approve` (admin only) that releases the item back into circulation — re-instating it into the verified cache / knowledge base per the grounding capability's reinstatement path — sets `status: approved`, and writes an `AuditLog` entry (actor, item, before/after). Approving an already-resolved item is idempotent or returns a `409`.

#### Scenario: Approve releases and audits

- **WHEN** an admin approves a `pending` quarantined item
- **THEN** the item is re-instated into circulation, its `status` becomes `approved`, and an `AuditLog` entry records the action and actor

### Requirement: Admin can reject a quarantined item

The system SHALL expose `POST /api/v1/admin/quarantine/:id/reject` (admin only) that discards the item permanently, sets `status: rejected`, and writes an `AuditLog` entry. Rejecting an already-resolved item is idempotent or returns a `409`.

#### Scenario: Reject discards and audits

- **WHEN** an admin rejects a `pending` quarantined item
- **THEN** its `status` becomes `rejected`, it is not re-instated, and an `AuditLog` entry records the action and actor
