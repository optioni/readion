## ADDED Requirements

### Requirement: UserCertification enrollment entity

The system SHALL persist a `UserCertification` entity that joins a `User` to a `Certification`. Each `UserCertification` SHALL have a unique `id`, a reference to the owning `user`, a reference to the enrolled `certification`, a `status` of either `active` or `archived` (defaulting to `active` on creation), an `enrolledAt` timestamp, and per-cert session preference overrides (`duration`, `contentMix`, `difficulty`, `focusArea`, `learningStyle`), each of which is independently nullable so that an unset override falls back to the user's profile session default.

A `User` and a `Certification` SHALL have at most one `UserCertification` between them — the pair `(user, certification)` is unique regardless of `status`. User-specific scoring data (readiness, weak areas) SHALL NOT be added to this entity by this change; downstream changes own those fields.

#### Scenario: Persisting an enrollment defaults to active with no overrides

- **WHEN** a `UserCertification` is created linking a user to a certification with no preference overrides supplied
- **THEN** the row is stored with `status` defaulting to `active`, `enrolledAt` set, and every session preference override null
- **AND** reading it back returns its `user`, `certification`, `status`, and `enrolledAt`

#### Scenario: A user cannot have two enrollments for the same certification

- **WHEN** a second `UserCertification` is persisted for a `(user, certification)` pair that already has one
- **THEN** the database rejects it via the unique constraint on `(user, certification)`

### Requirement: Enroll in a live certification

The system SHALL expose `POST /api/v1/user-certifications`, requiring authentication, that creates a `UserCertification` for the **current user** against the `certificationId` in the request body, returning the single-resource envelope with status `201`. The request body MAY include partial session preference overrides. Enrollment SHALL be permitted only for certifications in `state: live`; enrolling in a `draft` or non-existent certification SHALL return an RFC 7807 problem-details response.

#### Scenario: Enrolling in a live certification

- **WHEN** an authenticated user sends `POST /api/v1/user-certifications` with a `certificationId` referencing a `live` certification
- **THEN** the response status is `201`
- **AND** `data` contains the new enrollment's `id`, the `certificationId`, `status` `active`, and `enrolledAt`
- **AND** `body.relationships` is present alongside `data` per the single-resource envelope
- **AND** a `UserCertification` row exists scoped to the requesting user's id

#### Scenario: Enrolling with session preference overrides

- **WHEN** an authenticated user enrolls and includes `sessionDefaults` with `{ duration: 60, difficulty: "advanced" }`
- **THEN** the response status is `201`
- **AND** the stored enrollment's `duration` override is `60` and `difficulty` override is `advanced`
- **AND** the un-supplied overrides (`contentMix`, `focusArea`, `learningStyle`) remain null

#### Scenario: Cannot enroll in a draft certification

- **WHEN** an authenticated user sends `POST /api/v1/user-certifications` with a `certificationId` referencing a `draft` certification
- **THEN** the response status is `404`
- **AND** the body is an RFC 7807 problem-details object with `status` `404`
- **AND** no `UserCertification` row is created

#### Scenario: Cannot enroll in a non-existent certification

- **WHEN** an authenticated user enrolls with a `certificationId` that does not exist
- **THEN** the response status is `404` with an RFC 7807 problem-details body

#### Scenario: Enrollment requires authentication

- **WHEN** an unauthenticated request is sent to `POST /api/v1/user-certifications`
- **THEN** the response status is `401`

### Requirement: Re-enrolling restores an archived enrollment

Because the `(user, certification)` pair is unique, enrolling in a certification the current user has previously archived SHALL restore the existing record (set `status` back to `active`) rather than create a duplicate, preserving the original `enrolledAt` and accumulated history. Enrolling in a certification the user is **already actively** enrolled in SHALL be rejected.

#### Scenario: Re-enrolling in an archived certification restores it

- **WHEN** an authenticated user who has an `archived` enrollment for a certification sends `POST /api/v1/user-certifications` for that same `certificationId`
- **THEN** the response status is `201`
- **AND** the existing enrollment's `status` becomes `active`
- **AND** no second `UserCertification` row is created for the pair
- **AND** the original `enrolledAt` is unchanged

#### Scenario: Enrolling while already active is rejected

- **WHEN** an authenticated user who already has an `active` enrollment for a certification sends `POST /api/v1/user-certifications` for that same `certificationId`
- **THEN** the response status is `409`
- **AND** the body is an RFC 7807 problem-details object

### Requirement: List the current user's enrollments

The system SHALL expose `GET /api/v1/user-certifications`, requiring authentication, returning the current user's enrollments using the collection envelope (`{ data[], meta }`). The list SHALL be scoped to the requesting user's id and SHALL NOT include any other user's enrollments. The list SHALL support a `status` query parameter (`active` | `archived`); when omitted it SHALL default to returning only `active` enrollments.

#### Scenario: Listing returns only the current user's active enrollments by default

- **WHEN** an authenticated user sends `GET /api/v1/user-certifications` and the database contains both their enrollments and another user's enrollments
- **THEN** the response status is `200`
- **AND** the body is `{ data: [...], meta: { total, page, limit } }`
- **AND** every item belongs to the requesting user and has `status` `active`
- **AND** no other user's enrollment appears

#### Scenario: Filtering by archived status

- **WHEN** an authenticated user sends `GET /api/v1/user-certifications?status=archived`
- **THEN** the response contains only that user's enrollments with `status` `archived`

#### Scenario: Empty list when the user has no matching enrollments

- **WHEN** an authenticated user with no enrollments sends `GET /api/v1/user-certifications`
- **THEN** the response status is `200`
- **AND** `data` is an empty array and `meta.total` is `0`

### Requirement: Enrollment detail with ownership scoping

The system SHALL expose `GET /api/v1/user-certifications/:id`, requiring authentication, returning a single enrollment using the single-resource envelope. The query SHALL be scoped on the requesting user's id at the repository layer. Requesting an enrollment that belongs to another user SHALL return `404` (not `403`), so the existence of others' records is not leaked. Requesting a non-existent id SHALL also return `404`.

#### Scenario: Fetching the user's own enrollment

- **WHEN** an authenticated user sends `GET /api/v1/user-certifications/:id` for one of their own enrollments
- **THEN** the response status is `200`
- **AND** `data` contains the enrollment's `id`, `certificationId`, `status`, `enrolledAt`, and its session preference overrides
- **AND** `body.relationships` is present alongside `data`

#### Scenario: Fetching another user's enrollment returns 404

- **WHEN** an authenticated user sends `GET /api/v1/user-certifications/:id` for an enrollment owned by a different user
- **THEN** the response status is `404` with an RFC 7807 problem-details body

#### Scenario: Fetching a missing enrollment returns 404

- **WHEN** an authenticated user requests an enrollment id that does not exist
- **THEN** the response status is `404` with an RFC 7807 problem-details body

### Requirement: Update per-cert session preference overrides

The system SHALL expose `PATCH /api/v1/user-certifications/:id`, requiring authentication and scoped to the current user, that updates the enrollment's per-cert session preference overrides. The body SHALL accept a partial set of overrides; supplied fields are validated against the same allowed values as the user profile session defaults. Setting a field to `null` SHALL clear that override so the enrollment falls back to the user's profile default for it. Updating an enrollment owned by another user SHALL return `404`.

#### Scenario: Overriding a single preference field

- **WHEN** an authenticated user sends `PATCH /api/v1/user-certifications/:id` with `{ sessionDefaults: { learningStyle: "spaced-repetition" } }` for their own enrollment
- **THEN** the response status is `200`
- **AND** the enrollment's `learningStyle` override is `spaced-repetition`
- **AND** the other override fields are unchanged

#### Scenario: Clearing an override falls back to the profile default

- **WHEN** an authenticated user sends `PATCH /api/v1/user-certifications/:id` with `{ sessionDefaults: { duration: null } }` for an enrollment that previously overrode `duration`
- **THEN** the response status is `200`
- **AND** the enrollment's `duration` override is null

#### Scenario: Invalid override value is rejected

- **WHEN** an authenticated user sends `PATCH /api/v1/user-certifications/:id` with `{ sessionDefaults: { difficulty: "impossible" } }`
- **THEN** the response status is `400` with an RFC 7807 problem-details body
- **AND** the enrollment is unchanged

#### Scenario: Updating another user's enrollment returns 404

- **WHEN** an authenticated user sends `PATCH /api/v1/user-certifications/:id` for an enrollment owned by a different user
- **THEN** the response status is `404`

### Requirement: Archive and restore an enrollment

The system SHALL expose `POST /api/v1/user-certifications/:id/archive` and `POST /api/v1/user-certifications/:id/restore`, both requiring authentication and scoped to the current user. Archiving SHALL set `status` to `archived` without deleting the record, preserving its history. Restoring SHALL set `status` back to `active`. Both actions SHALL return the updated enrollment in the single-resource envelope. Acting on an enrollment owned by another user SHALL return `404`.

#### Scenario: Archiving an active enrollment

- **WHEN** an authenticated user sends `POST /api/v1/user-certifications/:id/archive` for one of their own `active` enrollments
- **THEN** the response status is `200`
- **AND** the enrollment's `status` is `archived`
- **AND** the row still exists (it is not deleted)

#### Scenario: Restoring an archived enrollment

- **WHEN** an authenticated user sends `POST /api/v1/user-certifications/:id/restore` for one of their own `archived` enrollments
- **THEN** the response status is `200`
- **AND** the enrollment's `status` is `active`

#### Scenario: Archiving another user's enrollment returns 404

- **WHEN** an authenticated user sends `POST /api/v1/user-certifications/:id/archive` for an enrollment owned by a different user
- **THEN** the response status is `404`
