## Purpose

The `content-quarantine-review` capability owns the persistence and admin-facing review workflow for generated items that the grounding pipeline quarantines. It defines the `QuarantinedItem` entity, the admin endpoints that list, approve, and reject quarantined items, and the auditing that accompanies each resolution. Approving an item re-instates it through the grounding capability's existing cache/knowledge-base path; rejecting discards it permanently.

## Requirements

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

### Requirement: Admin can read a quarantined item's detail

The system SHALL expose `GET /api/v1/admin/quarantine/:id` to admins only, returning a single quarantined item with its verdict, reason, certification, domain, provenance, and status (the same fields the list returns) **plus a typed mapping of the item's `generatedContent`** exposing the generated question stem, options, answer key (correct answer), question format, and the supporting spans / source-chunk ids. The mapping SHALL NOT leak raw JSONB. The list endpoint stays lean and SHALL NOT carry `generatedContent`. The read is read-only and writes no `AuditLog` entry (auditing stays on approve/reject). Non-admins receive `403`; unauthenticated requests receive `401`; an unknown id receives `404`.

#### Scenario: Admin reads a quarantined item's detail

- **WHEN** an admin GETs `/api/v1/admin/quarantine/:id` for an existing item whose `generatedContent` holds a generated quiz item
- **THEN** the response is a `200` resource envelope with the item's verdict, reason, certification, domain, provenance, and status, plus a `content` mapping carrying the question stem, options, answer key, format, supporting spans, and source-chunk ids
- **AND** no `AuditLog` entry is written

#### Scenario: Non-admin is forbidden

- **WHEN** a non-admin user calls the endpoint
- **THEN** the response is `403` RFC 7807 and no data is returned

#### Scenario: Unauthenticated request is rejected

- **WHEN** an unauthenticated caller requests the endpoint
- **THEN** the response is `401` RFC 7807 and no data is returned

#### Scenario: Unknown id returns not found

- **WHEN** an admin GETs `/api/v1/admin/quarantine/:id` for an id that does not exist
- **THEN** the response is `404` RFC 7807 and no data is returned

#### Scenario: Null or malformed generated content is tolerated

- **WHEN** an admin reads an item whose `generatedContent` is `null` or does not match the expected quiz shape (e.g. an older row, or a non-quiz domain such as `explanation` where options are absent)
- **THEN** the response is `200` with the verdict/reason/provenance/status present and the mapped `content` field absent (`null`), and no `500` is raised

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
