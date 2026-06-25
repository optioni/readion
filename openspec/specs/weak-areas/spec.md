# Weak Areas Spec

## Purpose

Tracks per-domain performance aggregated from a user's quiz responses within an enrollment, exposing a ranked list of weakest domains to drive personalized study prioritisation.

## Requirements

### Requirement: WeakArea entity ownership and migration

The system SHALL own the `WeakArea` entity (table + migration). A `WeakArea` SHALL be scoped to a single `UserCertification`, keyed by `domain`, and SHALL persist the aggregated `score` (0–100) together with the inputs it was derived from: `accuracy` (0–1), `meanConfidence` (1–5), and `responseCount`. The pair (`userCertification`, `domain`) SHALL be unique. `WeakArea` SHALL NOT introduce or modify the `QuizResponse`, `UserCertification`, or `ContentChunk` tables.

#### Scenario: Migration creates the weak_area table

- **WHEN** the database migrations are run
- **THEN** a `weak_area` table exists with columns for the `UserCertification` foreign key, `domain`, `score`, `accuracy`, `mean_confidence`, and `response_count`
- **AND** a unique constraint exists across (`user_certification_id`, `domain`)

#### Scenario: A weak area belongs to exactly one enrollment and domain

- **WHEN** a `WeakArea` is persisted with a `userCertification` and `domain` of `"Security"`
- **THEN** attempting to persist a second `WeakArea` with the same `userCertification` and `domain` `"Security"` is rejected by the unique constraint

### Requirement: Per-domain aggregation from quiz responses

The system SHALL recompute a `UserCertification`'s `WeakArea` map from its current `QuizResponse`s, producing exactly one `WeakArea` row per domain that has at least one attributable response. Each `QuizResponse` SHALL be attributed to a domain via the `primaryDomain` of the `ContentChunk` identified in its provenance snapshot (`sourceChunkIds`). The aggregation SHALL be idempotent: recomputing without new responses SHALL leave the resulting map unchanged.

#### Scenario: Responses are grouped into one row per domain

- **WHEN** an enrollment has `QuizResponse`s whose source chunks resolve to `primaryDomain` `"Security"` (3 responses) and `"Billing"` (2 responses)
- **AND** recompute runs for that enrollment
- **THEN** exactly two `WeakArea` rows exist for the enrollment, one for `"Security"` and one for `"Billing"`
- **AND** the `"Security"` row has `responseCount = 3` and the `"Billing"` row has `responseCount = 2`

#### Scenario: Recompute is idempotent

- **WHEN** recompute runs twice for an enrollment with no new `QuizResponse`s in between
- **THEN** the set of `WeakArea` rows and their `score`, `accuracy`, `meanConfidence`, and `responseCount` values are identical after both runs

#### Scenario: A domain with no responses produces no row

- **WHEN** an enrollment has responses only in `"Security"` and recompute runs
- **THEN** no `WeakArea` row exists for any other domain
- **AND** if a `"Billing"` row existed from a prior recompute but `"Billing"` now has no attributable responses, that row is removed

#### Scenario: Responses with an unresolvable source chunk are skipped

- **WHEN** a `QuizResponse`'s source chunk no longer exists or has no `primaryDomain`
- **AND** recompute runs
- **THEN** that response is excluded from attribution
- **AND** recompute completes without error for the remaining responses

### Requirement: Score combines accuracy and confidence

The system SHALL compute each domain's `score` as a value in 0–100 derived from quiz accuracy combined with confidence ratings, where a higher score means a stronger domain. Confidence SHALL sharpen the signal so that, at equal accuracy, more confident-correct answers raise the score and more confident-wrong answers lower it. This computation SHALL be a pure function of the domain's responses (correctness and confidence 1–5), independent of any I/O.

#### Scenario: All-correct confident answers score higher than all-correct unsure answers

- **WHEN** domain A has responses all correct with confidence `5`
- **AND** domain B has responses all correct with confidence `1`
- **THEN** the computed `score` for domain A is greater than the `score` for domain B

#### Scenario: Confident-wrong answers depress the score more than unsure-wrong

- **WHEN** domain A has responses all incorrect with confidence `5`
- **AND** domain B has responses all incorrect with confidence `1`
- **THEN** the computed `score` for domain A is lower than the `score` for domain B

#### Scenario: Persisted inputs match the computed score

- **WHEN** recompute produces a `WeakArea` row for a domain
- **THEN** the row's `accuracy`, `meanConfidence`, and `responseCount` reflect that domain's responses
- **AND** the row's `score` is within the 0–100 range

### Requirement: Recompute trigger surface for downstream features

The system SHALL expose `WeakAreasService.recompute(userCertificationId)` as the entry point that updates the enrollment's `WeakArea` map, callable by downstream session/review/mock features when they record responses. Recording quiz answers SHALL be sufficient to drive a meaningful recompute today without those downstream features existing.

#### Scenario: Recompute reflects newly recorded answers

- **WHEN** a user answers additional quiz questions in the `"Security"` domain
- **AND** recompute runs for their enrollment
- **THEN** the `"Security"` `WeakArea` row's `responseCount` and `score` reflect the newly recorded answers

### Requirement: Ranked weak-area read endpoint scoped to the owner

The system SHALL expose `GET /api/v1/user-certifications/:id/weak-areas` returning the enrollment's `WeakArea` records as a collection in the standard response envelope, ranked weakest-first (lowest `score` first), with ties broken by larger `responseCount` then by `domain` ascending. The endpoint SHALL reflect the enrollment's latest recorded `QuizResponse`s by performing a recompute before returning (read-through), so the ranked list is current even before downstream session/review/mock features call `recompute` on their own lifecycle events. Access SHALL be restricted to the owning user's enrollment; a request for another user's enrollment SHALL NOT return that user's weak areas.

#### Scenario: Weakest domain is returned first

- **WHEN** an enrollment has a `"Security"` weak area with `score = 40` and a `"Billing"` weak area with `score = 70`
- **AND** the owning user requests `GET /api/v1/user-certifications/:id/weak-areas`
- **THEN** the response is `200` with a `data` array whose first element is the `"Security"` weak area and second is the `"Billing"` weak area
- **AND** each element exposes `domain` and `score`

#### Scenario: Cold start returns an empty list

- **WHEN** an enrollment has no quiz responses
- **AND** the owning user requests its weak areas
- **THEN** the response is `200` with an empty `data` array

#### Scenario: Endpoint reflects newly recorded answers without an explicit recompute call

- **WHEN** a user answers quiz questions in `"Security"` and then requests `GET /api/v1/user-certifications/:id/weak-areas` without any session/review/mock feature calling `recompute`
- **THEN** the response includes a `"Security"` weak area whose `responseCount` and `score` reflect those answers

#### Scenario: Another user cannot read the enrollment's weak areas

- **WHEN** a user requests `GET /api/v1/user-certifications/:id/weak-areas` for an enrollment they do not own
- **THEN** the response is an RFC 7807 error and does not include the other user's weak-area records

### Requirement: Weak areas includable on the UserCertification resource

The system SHALL allow the `weakAreas` relationship to be expanded inline on the `UserCertification` resource via `?include=weakAreas`, embedding the ranked `WeakArea` records under `relationships.weakAreas.data`. Without the `include` param the relationship SHALL be represented by its `href` only.

#### Scenario: Include expands the weak areas inline

- **WHEN** the owning user requests their `UserCertification` with `?include=weakAreas`
- **THEN** `relationships.weakAreas.data` is present and contains the ranked `WeakArea` records, each with `id`, `domain`, and `score`

#### Scenario: Without include only the href is present

- **WHEN** the owning user requests their `UserCertification` without the `include` param
- **THEN** `relationships.weakAreas.href` points to `/api/v1/user-certifications/:id/weak-areas`
- **AND** `relationships.weakAreas.data` is absent
