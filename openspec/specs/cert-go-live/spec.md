## Purpose

Defines the rules for evaluating whether a certification's knowledge-base coverage meets the go-live bar, automatic promotion of draft certifications to live on ingestion completion, configurable coverage thresholds, and the admin endpoint for reading coverage reports.

## Requirements

### Requirement: Coverage evaluation against the go-live bar

The system SHALL compute a coverage evaluation for a certification from the shared knowledge base. The evaluation SHALL cover **every** domain in the certification's configured domain list — a domain with no chunks SHALL appear in the result with a zero count, not be omitted. For each such domain the evaluation SHALL determine the number of `active` `ContentChunk`s tagged to that domain (a chunk counts toward a domain when its `state` is `active` and the domain appears in the chunk's `domainTags`), and the number of distinct **enabled** `ContentSource`s that contributed at least one such chunk. The evaluation SHALL also compute the total count of `active` chunks for the certification. `superseded` chunks SHALL NOT be counted toward any figure.

The certification SHALL be considered to **meet the go-live bar** only when ALL of the following hold:
- every domain has at least `minChunksPerDomain` active chunks tagged to it,
- the total active chunk count is at least `totalChunkMultiple × questionCount`,
- every domain has at least one enabled `ContentSource` that contributed an active chunk tagged to it.

If the domain list is empty, or any single criterion fails, the bar SHALL be considered **not met**.

#### Scenario: All three criteria satisfied marks the bar met
- **WHEN** a certification has `questionCount` 50, two domains, each domain has 25 active chunks tagged to it sourced from a distinct enabled source, and the total active chunk count is 200 (≥ 3 × 50 = 150)
- **THEN** the coverage evaluation reports the bar as met
- **AND** each domain reports an active chunk count of 25 against a minimum of 20
- **AND** the total reports 200 against a threshold of 150

#### Scenario: A domain below the per-domain minimum fails the bar
- **WHEN** a certification has two domains, one with 25 active chunks and one with 12 active chunks, and all other criteria pass
- **THEN** the coverage evaluation reports the bar as not met
- **AND** the domain with 12 chunks is reported as not meeting its per-domain minimum

#### Scenario: Insufficient total chunks fails the bar
- **WHEN** a certification has `questionCount` 65 (requiring ≥ 195 total chunks), every domain individually meets its 20-chunk minimum and has a qualifying source, but the total active chunk count is 150
- **THEN** the coverage evaluation reports the bar as not met
- **AND** the total is reported as 150 against a threshold of 195

#### Scenario: A domain with chunks but no enabled source fails the bar
- **WHEN** a domain has 30 active chunks tagged to it but every `ContentSource` that contributed them is `enabled: false`, and all other criteria pass
- **THEN** the coverage evaluation reports the bar as not met
- **AND** that domain is reported as having zero qualifying enabled sources against a minimum of 1

#### Scenario: A domain with zero chunks fails the bar
- **WHEN** a certification's domain list has three domains but no chunk is tagged to the third domain, and the other two domains fully qualify
- **THEN** the coverage evaluation reports the bar as not met
- **AND** the third domain appears in the report with a chunk count of 0 against its minimum

#### Scenario: Superseded chunks are excluded from counts
- **WHEN** a domain has 18 active chunks and 10 `superseded` chunks tagged to it
- **THEN** the coverage evaluation reports that domain's active chunk count as 18, not 28

### Requirement: Automatic draft-to-live promotion on ingestion completion

When a content ingestion job completes for a `ContentSource`, the system SHALL recompute the coverage evaluation for that source's certification. If the certification's `state` is `draft` and the go-live bar is met, the system SHALL set the certification's `state` to `live`. The promotion SHALL require no manual publish action. The promotion SHALL be one-way: a certification already in `state: live` SHALL NOT be demoted by this evaluation, and a `draft` certification that does not meet the bar SHALL remain `draft`.

#### Scenario: Ingestion that completes the bar promotes the cert
- **WHEN** a `draft` certification is one source short of meeting the bar, and an ingestion job for a new enabled source completes such that all three criteria now hold
- **THEN** the certification's `state` is updated to `live`
- **AND** the certification subsequently appears in `GET /api/v1/certifications`

#### Scenario: Ingestion that does not complete the bar leaves the cert draft
- **WHEN** a `draft` certification still has a domain below its per-domain minimum after an ingestion job completes
- **THEN** the certification's `state` remains `draft`

#### Scenario: A live certification is never demoted by re-evaluation
- **WHEN** a `live` certification is re-evaluated after an ingestion job and the bar no longer holds (for example a domain's only source was disabled)
- **THEN** the certification's `state` remains `live`

#### Scenario: Re-evaluation of an already-live cert is idempotent
- **WHEN** an ingestion job completes for a certification already in `state: live` that still meets the bar
- **THEN** the certification's `state` remains `live` and no error is raised

### Requirement: Configurable coverage thresholds

The per-domain chunk minimum (`minChunksPerDomain`) and the total-chunk multiple (`totalChunkMultiple`) SHALL be read from validated environment configuration rather than hard-coded, and SHALL default to 20 and 3 respectively. The same configured values SHALL be used by both the promotion evaluation and the admin coverage read model.

#### Scenario: Overridden per-domain minimum changes the bar
- **WHEN** `minChunksPerDomain` is configured to 10 and every domain has at least 10 active chunks (with all other criteria met)
- **THEN** the coverage evaluation reports the bar as met using the threshold 10

#### Scenario: Defaults apply when not overridden
- **WHEN** no override is configured
- **THEN** the evaluation uses a per-domain minimum of 20 and a total-chunk multiple of 3

### Requirement: Admin per-domain coverage read model

The system SHALL expose `GET /api/v1/certifications/:id/coverage` returning the certification's coverage report using the single-resource response envelope (`{ data }`). The report SHALL include, per domain, the domain name, its active chunk count, its qualifying enabled-source count, the per-domain chunk threshold, and a boolean `met`; plus the total active chunk count, the total-chunk threshold, the certification's current `state`, and an overall `met` boolean. The endpoint SHALL be restricted to `admin` users via the roles guard.

#### Scenario: Admin retrieves the coverage report for a draft cert
- **WHEN** an `admin` user sends `GET /api/v1/certifications/:id/coverage` for a draft certification whose first domain has 12 of 20 required chunks
- **THEN** the response status is 200 and follows the `{ data }` envelope
- **AND** the first domain entry reports `chunkCount` 12, `chunkThreshold` 20, and `met` false
- **AND** the report's overall `met` is false and `state` is `draft`

#### Scenario: Non-admin user is forbidden
- **WHEN** an authenticated non-admin `user` sends `GET /api/v1/certifications/:id/coverage`
- **THEN** the response status is 403 with an RFC 7807 problem-details body

#### Scenario: Coverage for a missing certification returns 404
- **WHEN** an `admin` user sends `GET /api/v1/certifications/:id/coverage` for an id that does not exist
- **THEN** the response status is 404 with an RFC 7807 problem-details body
