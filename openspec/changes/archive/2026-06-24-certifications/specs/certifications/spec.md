## ADDED Requirements

### Requirement: Certification entity with structured exam-format facts

The system SHALL persist a `Certification` entity holding structured exam-format facts that are configured per certification and never generated at question time. Each certification SHALL have: a unique `id`, `name`, `provider`, exam `code`, a `domains` list where each domain has a `name` and a numeric `weight`, an integer `questionCount`, a numeric `passingScore`, an integer `timeLimitMinutes`, a `state`, a `provenance` value, and a `verifiedAt` timestamp.

The domain `weight` values SHALL sum to 100 across a certification's domain list. The `state` SHALL be one of `draft` or `live` and SHALL default to `draft` on creation. User-specific data (such as readiness score or weak areas) SHALL NOT be stored on `Certification`.

#### Scenario: Persisting a certification with structured fields

- **WHEN** a `Certification` is created with provider `AWS`, code `CLF-C02`, domains `[{name: "Cloud Concepts", weight: 24}, {name: "Security and Compliance", weight: 30}, {name: "Cloud Technology and Services", weight: 34}, {name: "Billing, Pricing, and Support", weight: 12}]`, `questionCount` 65, `passingScore` 700, and `timeLimitMinutes` 90
- **THEN** the row is stored with `state` defaulting to `draft`
- **AND** reading it back returns the domain list with each domain's name and weight, and the weights sum to 100

#### Scenario: Domain weights are queryable for readiness weighting

- **WHEN** a certification's domain list is read
- **THEN** each domain entry exposes a `name` and a numeric `weight` that downstream features can use for domain-weighted scoring

### Requirement: Exam-format provenance

The system SHALL record provenance for a certification's exam-format facts. Provenance SHALL be either `verified` (curated human-verified seed data) or a per-field citation containing the source `url` and the exact source `passage` the field was extracted from. Seed-data certifications SHALL carry `verified` provenance. The provenance representation SHALL accommodate per-field citations so that grounded pre-fill can later populate citations without a schema migration.

#### Scenario: Seed certification carries verified provenance

- **WHEN** a certification created from verified seed data is read
- **THEN** its exam-format provenance is `verified`
- **AND** its `verifiedAt` timestamp is set to the seed curation date

### Requirement: Verified seed data for primary-target certifications

The system SHALL provide an idempotent seeding mechanism that populates the primary-target certifications listed in the specification (AWS, Azure, Kubernetes, and vendor-neutral AI/ML) with curated domains, domain weights, and exam-format facts marked `verified`. Seeded certifications SHALL be created in `state: draft`. Running the seeder more than once SHALL NOT create duplicate certifications.

#### Scenario: Seeding populates primary-target certs

- **WHEN** the seed mechanism runs against an empty database
- **THEN** the AWS Cloud Practitioner (`CLF-C02`) certification exists with `provider` `AWS`, a non-empty weighted domain list, and `verified` provenance
- **AND** every seeded certification has `state` `draft`

#### Scenario: Seeding is idempotent

- **WHEN** the seed mechanism runs a second time against a database that already contains the seeded certifications
- **THEN** no duplicate certification rows are created
- **AND** the total certification count is unchanged

### Requirement: List certifications

The system SHALL expose `GET /api/v1/certifications` returning a paginated collection of certifications using the collection response envelope (`{ data[], meta }`). The list SHALL include only certifications in `state: live`; `draft` certifications SHALL NOT appear in this list. Pagination SHALL default to 25 items per page and SHALL allow a maximum of 100.

#### Scenario: Listing returns only live certifications

- **WHEN** a client sends `GET /api/v1/certifications` and the database contains both `live` and `draft` certifications
- **THEN** the response status is 200
- **AND** the body is `{ data: [...], meta: { total, page, limit } }`
- **AND** every item in `data` has `state` `live`
- **AND** no `draft` certification appears in `data`

#### Scenario: Empty list when no certification is live

- **WHEN** a client sends `GET /api/v1/certifications` and all certifications are in `state: draft`
- **THEN** the response status is 200
- **AND** `data` is an empty array and `meta.total` is 0

#### Scenario: Pagination is bounded

- **WHEN** a client requests `GET /api/v1/certifications?limit=500`
- **THEN** at most 100 items are returned

### Requirement: Certification detail

The system SHALL expose `GET /api/v1/certifications/:id` returning a single certification using the single-resource envelope (`{ data: { ...attributes, relationships } }`). The detail SHALL include the certification's domains (topic breakdown with weights) and its exam format (question count, passing score, time limit). The response SHALL NOT include user-specific fields. Requesting a non-existent certification SHALL return an RFC 7807 problem-details response with status 404.

#### Scenario: Fetching an existing certification

- **WHEN** a client sends `GET /api/v1/certifications/:id` for a live certification
- **THEN** the response status is 200
- **AND** `data` contains the certification's `name`, `provider`, `code`, weighted `domains` list, `questionCount`, `passingScore`, and `timeLimitMinutes`
- **AND** `body.relationships` is present (top-level alongside `data`, per `SingleResourceEnvelope`)
- **AND** `data` contains no `readinessScore` or other user-specific field

#### Scenario: Fetching a missing certification

- **WHEN** a client sends `GET /api/v1/certifications/:id` for an id that does not exist
- **THEN** the response status is 404
- **AND** the body is an RFC 7807 problem-details object with a `type`, `title`, and `status` of 404
