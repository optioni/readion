## Purpose

Generic response envelope types and pagination constants for the REST API, exported from the shared package so all resource modules share the same structural contracts without redefining them.

## Requirements

### Requirement: Single-resource response envelope

The shared package SHALL export a generic single-resource envelope type of the form `{ data }`, where `data` carries the resource's flat attributes plus an optional `relationships` block. The type MUST be generic over the attribute shape so any resource module can reuse it without redefining the envelope, with no use of `any`.

#### Scenario: Wrapping a resource value

- **WHEN** a value `{ data: { id: '1', name: 'AWS Cloud Practitioner', readinessScore: 75 } }` is typed as the single-resource envelope parameterized with `{ id: string; name: string; readinessScore: number }`
- **THEN** the type-check passes and `data.name` is typed as `string`, `data.readinessScore` as `number`

#### Scenario: Relationships block is optional on data

- **WHEN** a single-resource value omits the `relationships` block entirely
- **THEN** the value still satisfies the envelope type (the `relationships` block is optional)

### Requirement: Relationships block with optional include expansion

The shared package SHALL export a relationships type where each relationship is an object with a required `href: string` and an independently optional/nullable `data` field, where `data` is either a single reference or an array of references. The presence of `data` at runtime represents an `?include=` expansion.

#### Scenario: Reference only, not included

- **WHEN** a relationship value is `{ href: '/api/v1/user-certifications/1/weak-areas' }` with no `data` key
- **THEN** the value satisfies the relationship type and `data` reads as `undefined`

#### Scenario: Expanded as an array via include

- **WHEN** a relationship value is `{ href: '/api/v1/user-certifications/1/weak-areas', data: [{ id: 'a', domain: 'Billing', score: 48 }, { id: 'b', domain: 'Security', score: 61 }] }`
- **THEN** the value satisfies the relationship type with `data` typed as the array of references

#### Scenario: Single envelope type covers all include combinations

- **WHEN** a resource declares two includable relationships and only one is expanded in a given response
- **THEN** both responses (one relationship expanded, the other reference-only) satisfy the same single envelope type without a per-combination schema, because each relationship's `data` is optional independently

### Requirement: Paginated collection response envelope

The shared package SHALL export a generic paginated collection envelope of the form `{ data: T[], meta }`, where `meta` is an object with numeric `total`, `page`, and `limit` fields.

#### Scenario: Wrapping a collection value

- **WHEN** a value `{ data: [{ id: '1' }], meta: { total: 100, page: 1, limit: 25 } }` is typed as the collection envelope parameterized with `{ id: string }`
- **THEN** the type-check passes, `data` is typed as `{ id: string }[]`, and `meta.total`, `meta.page`, `meta.limit` are each `number`

### Requirement: Pagination defaults and limits

The shared package SHALL export pagination constants `PAGE_SIZE_DEFAULT` equal to `25` and `PAGE_SIZE_MAX` equal to `100`, plus a query-params type covering optional `page` and `limit` numbers.

#### Scenario: Default constant value

- **WHEN** `PAGE_SIZE_DEFAULT` is read
- **THEN** its value is exactly `25`

#### Scenario: Max constant value

- **WHEN** `PAGE_SIZE_MAX` is read
- **THEN** its value is exactly `100`
