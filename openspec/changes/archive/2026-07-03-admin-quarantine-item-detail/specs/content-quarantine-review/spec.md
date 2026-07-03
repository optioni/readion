## ADDED Requirements

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
