# Capability: Certification Setup

## Purpose

Gives administrators a grounded, backend workflow to set up a new or unlisted certification: discover candidate official exam-guide sources via web search, confirm a source, extract each exam-format field (weighted domains, question count, passing score, time limit) with a verbatim citation through the grounding/verifier contract, flag fields that could not be grounded as unverified, persist a grounded `draft` certification with per-field provenance and `verifiedAt`, and re-verify when metadata goes stale. It orchestrates existing layers (the scrapper, the LLM gateway, the shared grounding validator, source-admin registration, and the shared audit log) and owns no new entity or migration. The coverage-bar auto `draft`→`live` flip remains owned by `cert-go-live`.

## Requirements

### Requirement: Admin discovers candidate official sources for a new or unlisted certification

The system SHALL expose `POST /api/v1/admin/certifications/discover-sources`, protected by the global `JwtAuthGuard` and restricted to the `admin` role, that accepts a JSON body of `name` and optional `code` and returns candidate official exam-guide source URLs. Source discovery MUST use a web-search tool resolved through the `llm-foundation` gateway (the `certification-prefill` task type via the gateway's tool-capable streaming method) and MUST rank candidates that sit on the vendor's own domain ahead of third-party pages. The model MUST ground its candidates in the search-tool results and MUST NOT fabricate URLs that did not appear in a search result. The response MUST be `200` with the single-resource envelope `{ data }` exposing a `candidates[]` array where each entry has `url`, `title`, and an optional `snippet`, plus an optional `suggestedContentSources[]` array of `{ url, type }` proposals for the knowledge base. Discovery MUST NOT persist any certification, content source, or audit entry — it is a read-only proposal step. Non-admin callers MUST receive `403` and unauthenticated callers `401`, both as RFC 7807 Problem Details.

#### Scenario: Discovery proposes vendor-domain candidates first

- **WHEN** an admin `POST`s `{ name: 'AWS Certified Data Engineer Associate', code: 'DEA-C01' }`
- **THEN** the response is `200` with `{ data: { candidates: [...] } }`
- **AND** each candidate exposes a `url` and `title`
- **AND** a candidate on the vendor's own domain is ranked ahead of a third-party candidate
- **AND** no certification row, content-source row, or audit-log row is created

#### Scenario: Discovery never invents a URL

- **WHEN** the web search returns no usable result for the entered cert
- **THEN** the response `candidates` array is empty rather than containing a fabricated URL

#### Scenario: Non-admin cannot run discovery

- **WHEN** a user with role `user` `POST`s to `/api/v1/admin/certifications/discover-sources`
- **THEN** the response is `403` as RFC 7807 Problem Details

#### Scenario: Unauthenticated cannot run discovery

- **WHEN** an unauthenticated request hits `POST /api/v1/admin/certifications/discover-sources`
- **THEN** the response is `401` as RFC 7807 Problem Details

### Requirement: Admin confirms a source and the system extracts each exam-format field with a citation

Extraction is asynchronous because it depends on the scrapper. The system SHALL expose `POST /api/v1/admin/certifications/extract`, admin-only, that accepts a JSON body of `name`, optional `code`, and a `confirmedSourceUrl` the admin has confirmed (selected from discovery or pasted directly), enqueues exactly one extraction job onto the shared `cert-extraction` BullMQ queue with job data `{ name, code, confirmedSourceUrl }`, and responds `202` with `{ data }` exposing the enqueued `jobId` and the job's initial `state`. The system SHALL also expose `GET /api/v1/admin/certifications/extractions/:jobId`, admin-only, returning `200` with `{ data }` exposing the job `state` and, once the job has completed, a `fields` object holding the per-field extraction result; while the job is still pending, `fields` MUST be `null`. A `jobId` not present on the `cert-extraction` queue MUST return `404` as RFC 7807 Problem Details.

The worker job MUST fetch the confirmed source through the existing scrapper sidecar (reusing the worker's scrapper integration, not a new fetch strategy) and MUST extract each field — the weighted `domains` list, `questionCount`, `passingScore`, and `timeLimitMinutes` — through the grounding contract: each extracted field value MUST be backed by a `passage` that appears **verbatim** in the fetched source text (validated by the shared extractive-contract validator from `grounding-verification`), and MUST pass an **independent verifier** model call (resolved through the gateway, distinct from the extraction call) that checks the value is entailed by the cited passage. In the completed `fields` result each field MUST carry either a grounded citation `{ url, passage }` or an `{ unverified: true }` marker (see the unverified-flagging requirement). Re-ingesting/registering the confirmed source into the knowledge base is NOT performed here; suggested content sources are surfaced for separate admin review and registration through the existing `content-source-admin` endpoints. Non-admin callers MUST receive `403`; unauthenticated callers `401`.

#### Scenario: Extract enqueues a job and the result is read by job id

- **WHEN** an admin `POST`s `{ name, code, confirmedSourceUrl }` to `/extract`
- **THEN** the response is `202` with `{ data }` exposing a `jobId` and an initial `state`
- **AND** exactly one job exists on the `cert-extraction` queue with data `{ name, code, confirmedSourceUrl }`
- **AND** a subsequent `GET /api/v1/admin/certifications/extractions/:jobId` returns `200` with the job `state` (and `fields` null while still pending)

#### Scenario: Each grounded field carries a verbatim citation to the confirmed source

- **WHEN** the extraction job runs against a fetched source whose text states the exam has 65 questions and a 90-minute limit, and an admin reads `GET /api/v1/admin/certifications/extractions/:jobId` after completion
- **THEN** the completed `fields` result reports `questionCount` 65 with a citation whose `passage` appears verbatim in the fetched source text and `url` equal to `confirmedSourceUrl`
- **AND** `timeLimitMinutes` 90 with a verbatim citation
- **AND** the extracted weighted `domains` list is returned with its per-field citation

#### Scenario: Reading an unknown extraction job returns 404

- **WHEN** an admin `GET`s `/api/v1/admin/certifications/extractions/:jobId` for a `jobId` not present on the `cert-extraction` queue
- **THEN** the response is `404` as RFC 7807 Problem Details

#### Scenario: A field that cannot be grounded is not invented

- **WHEN** the confirmed source contains no passing-score statement
- **THEN** the extraction result reports `passingScore` flagged `{ unverified: true }`
- **AND** no fabricated numeric value is asserted for it

#### Scenario: A field whose value is not entailed by its cited passage fails verification

- **WHEN** the extraction proposes a field value whose cited passage does not entail it (independent verifier returns fail)
- **THEN** that field is flagged `{ unverified: true }` rather than returned as grounded

#### Scenario: Non-admin cannot run extraction

- **WHEN** a user with role `user` `POST`s to `/api/v1/admin/certifications/extract`
- **THEN** the response is `403` as RFC 7807 Problem Details and no extraction job is enqueued

### Requirement: Ungrounded fields are flagged "unverified — confirm manually"

For every exam-format field that could not be grounded to the confirmed source — because no verbatim supporting passage was found, the extractive-contract validator rejected the span, or the independent verifier failed — the system SHALL surface that field flagged as **unverified** rather than silently populating a value. The per-field provenance representation SHALL accommodate three field states stored in the certification's existing `provenance` JSON column: a grounded citation `{ url, passage }`, an `{ unverified: true }` marker, and an admin `{ manuallyConfirmed: true }` marker for a field the admin filled in despite no citation. This extension to the shared certification-provenance type MUST be additive and MUST NOT require a database migration (the column is JSON).

#### Scenario: Unverified fields are visibly flagged, not hidden

- **WHEN** extraction grounds `questionCount` and `timeLimitMinutes` but cannot ground `passingScore`
- **THEN** the result marks `questionCount` and `timeLimitMinutes` with citations and `passingScore` with `{ unverified: true }`

#### Scenario: Admin manual confirmation is distinguishable from a grounded citation

- **WHEN** an admin manually confirms a value for a field that extraction flagged unverified
- **THEN** that field's persisted provenance is `{ manuallyConfirmed: true }`, distinct from a grounded `{ url, passage }` citation

### Requirement: Admin creates a grounded certification draft

The system SHALL expose `POST /api/v1/admin/certifications`, admin-only, that creates a new `Certification` for a previously unlisted cert from a JSON body of `name`, `provider`, `code`, the weighted `domains` list, `questionCount`, `passingScore`, `timeLimitMinutes`, a per-field `provenance` map, and the extracted `sourceUrl`. The new certification MUST be created with `state = draft` (it only becomes `live` automatically once the coverage bar is met — owned by `cert-go-live`, not this change), MUST persist the per-field provenance map (citations, `unverified`, and `manuallyConfirmed` markers) into the existing `provenance` column, and MUST set `verifiedAt` to the creation time. The domain `weight` values MUST sum to 100; a body violating this MUST be rejected with `422` as RFC 7807 Problem Details. The action MUST write exactly one `AuditLog` entry via the shared `AuditLogService.record(...)` with action `cert.created`, the calling admin as actor, `targetType = 'Certification'`, `targetId` = the new certification id, and an `after` snapshot of the created exam-format fields and provenance. A duplicate `code` MUST be rejected with `409`. This adds a cert with no code changes. Non-admin callers MUST receive `403`; unauthenticated callers `401`.

#### Scenario: Creating a grounded draft persists provenance and audits

- **WHEN** an admin `POST`s a valid grounded certification body whose `domains` weights sum to 100
- **THEN** the response is `201` with `{ data, relationships }` and `data.state = 'draft'`
- **AND** a new `certifications` row exists with the per-field `provenance` map persisted and a non-null `verifiedAt`
- **AND** exactly one `audit_logs` row with `action = 'cert.created'`, the admin actor, `target_type = 'Certification'`, `target_id` = the new cert id, and a non-null `after` exists

#### Scenario: Domain weights that do not sum to 100 are rejected

- **WHEN** an admin `POST`s a body whose `domains` weights sum to 90
- **THEN** the response is `422` as RFC 7807 Problem Details and no certification row is created

#### Scenario: A new cert is created draft, not live

- **WHEN** an admin creates a grounded certification
- **THEN** its `state` is `draft` and it does not appear in the public `GET /api/v1/certifications` list until the coverage bar promotes it

#### Scenario: Duplicate exam code is rejected

- **WHEN** an admin `POST`s a certification whose `code` already exists
- **THEN** the response is `409` as RFC 7807 Problem Details and no second row is created

#### Scenario: Non-admin cannot create a certification

- **WHEN** a user with role `user` `POST`s to `/api/v1/admin/certifications`
- **THEN** the response is `403` as RFC 7807 Problem Details and no certification row is created

### Requirement: Metadata staleness surfaces certifications due for re-verification

The system SHALL derive a `dueForReverification` flag for a certification from its `verifiedAt` timestamp and a configurable staleness interval (`CERT_REVERIFICATION_INTERVAL_DAYS`, read from validated environment configuration). A certification is **due for re-verification** when its `verifiedAt` is null or older than `now − CERT_REVERIFICATION_INTERVAL_DAYS`. The flag SHALL be derived (no stored boolean column, no migration). The system SHALL expose `GET /api/v1/admin/certifications/due-for-reverification`, admin-only, returning the collection envelope `{ data[], meta }` of certifications currently due, each exposing `id`, `name`, `code`, `verifiedAt`, and `dueForReverification = true`, ordered by `verifiedAt` ascending (most stale first). Pagination defaults to 25, capped at 100.

#### Scenario: A cert whose metadata aged past the interval is reported due

- **WHEN** `CERT_REVERIFICATION_INTERVAL_DAYS` is 180 and a certification's `verifiedAt` is 200 days old
- **THEN** `GET /api/v1/admin/certifications/due-for-reverification` includes that certification with `dueForReverification = true`

#### Scenario: A freshly verified cert is not reported due

- **WHEN** a certification's `verifiedAt` is 10 days old and the interval is 180 days
- **THEN** that certification does not appear in the due-for-reverification list

#### Scenario: Non-admin cannot read the due-for-reverification list

- **WHEN** a user with role `user` requests `GET /api/v1/admin/certifications/due-for-reverification`
- **THEN** the response is `403` as RFC 7807 Problem Details

### Requirement: Admin re-verifies a certification through the same source-confirm and citation flow

The system SHALL expose `POST /api/v1/admin/certifications/:id/reverify`, admin-only, that reruns the source-confirmation + per-field grounded-extraction flow against an existing certification from a JSON body of `confirmedSourceUrl` and the admin-reviewed field values + provenance map, updating the certification's exam-format fields and per-field `provenance`, and resetting `verifiedAt` to the re-verification time. The action MUST write exactly one `AuditLog` entry via `AuditLogService.record(...)` with action `cert.reverified`, the calling admin as actor, `targetType = 'Certification'`, `targetId` = the cert id, and `before`/`after` snapshots of the exam-format fields and provenance. Re-verifying a non-existent certification MUST return `404`. Re-verification MUST NOT by itself change the certification's `state` (promotion/demotion remains owned by `cert-go-live`). Non-admin callers MUST receive `403`; unauthenticated callers `401`.

#### Scenario: Re-verification refreshes fields, provenance, and verifiedAt with an audit

- **WHEN** an admin `POST`s `/api/v1/admin/certifications/:id/reverify` with an updated `confirmedSourceUrl` and reviewed field values for a cert that was due for re-verification
- **THEN** the response is `200` and the certification's exam-format fields and per-field `provenance` are updated
- **AND** `verifiedAt` is reset to the re-verification time and the cert is no longer due for re-verification
- **AND** exactly one `audit_logs` row with `action = 'cert.reverified'`, the admin actor, `target_id` = the cert id, and `before`/`after` snapshots exists

#### Scenario: Re-verification does not change state

- **WHEN** an admin re-verifies a `live` certification
- **THEN** the certification's `state` remains `live`

#### Scenario: Re-verifying an unknown certification returns 404

- **WHEN** an admin `POST`s `/reverify` for a cert id that does not exist
- **THEN** the response is `404` as RFC 7807 Problem Details and no audit-log row is written

#### Scenario: Non-admin cannot re-verify

- **WHEN** a user with role `user` `POST`s `/api/v1/admin/certifications/:id/reverify`
- **THEN** the response is `403` as RFC 7807 Problem Details

### Requirement: Worker cron surfaces certifications due for re-verification

The `apps/worker` content pipeline SHALL run a scheduled cron, distinct from the existing stale-source re-ingestion cron (which is owned by `content-pipeline`), that periodically scans certifications whose metadata is due for re-verification (`verifiedAt` null or older than `CERT_REVERIFICATION_INTERVAL_DAYS`) and surfaces them for a human re-check by emitting a gauge metric of the count of due certifications through the existing observability infrastructure and logging the due set. The cron SHALL NOT auto-modify any certification; it only surfaces. This cron is the cert "due for re-verification" half of the shared cross-cutting deliverable; it does not duplicate the stale-source re-ingestion cron.

#### Scenario: The cron emits the count of due certifications

- **WHEN** the cron runs and three certifications have `verifiedAt` older than the configured interval
- **THEN** the due-for-reverification gauge metric is set to 3
- **AND** no certification row is modified by the cron

#### Scenario: The cron is separate from stale-source re-ingestion

- **WHEN** the worker's scheduled crons are inspected
- **THEN** the cert due-for-reverification cron is distinct from the stale-source re-ingestion cron and does not enqueue ingestion jobs

### Requirement: Cert-setup LLM work routes only through the gateway and extends the shared audit vocabulary additively

Source discovery (web search) and per-field extraction/verification SHALL resolve their models exclusively through the `llm-foundation` gateway (`certification-prefill` for discovery and extraction, `answer-verification` for the independent verifier pass); no cert-setup code SHALL import a provider SDK directly or hardcode a model ID. The shared `auditActions` vocabulary in `@readion/shared` SHALL be extended additively with `cert.created`; the existing `cert.reverified` value SHALL be reused for re-verification. The vocabulary extension MUST NOT remove or rename existing action values, and `AuditLogService.record(...)` MUST accept `cert.created` without a type error.

#### Scenario: Discovery and extraction use the gateway, not a provider SDK

- **WHEN** the cert-setup source tree is scanned for direct imports of `@anthropic-ai/sdk` or `openai`
- **THEN** no such import exists and all LLM calls go through the gateway with a configured task type

#### Scenario: The new cert-setup audit action is part of the vocabulary

- **WHEN** the `auditActions` tuple is inspected
- **THEN** it contains `cert.created` in addition to the pre-existing `cert.published` and `cert.reverified`
- **AND** `AuditLogService.record` accepts an `action` of `cert.created` without a type error

### Requirement: Source discovery is backed by a configured web-search provider

The web-search tool used by `POST /api/v1/admin/certifications/discover-sources` SHALL be backed by a real, configured web-search provider through the `CertSearchPort` seam; the placeholder backend that returns no results SHALL NOT be used in a configured environment. The provider SHALL be selected and configured through validated environment configuration (a provider identifier plus its API credentials and an optional maximum result count), read at API startup via the Zod env schema. Each provider result SHALL be mapped to a `CertSearchResult` exposing `url`, `title`, an optional `snippet`, and an `official` flag derived from whether the result's host is the certification vendor's own domain, so that vendor-domain candidates continue to rank ahead of third-party pages.

When the provider is **not configured**, or the provider call **fails or times out**, discovery SHALL degrade to returning an empty `candidates` array (the pre-existing behavior) rather than erroring, and SHALL NOT fabricate URLs; the endpoint SHALL still respond `200`. A not-configured or failed-search condition SHALL be observable through a log entry and/or metric, not silently indistinguishable from "the search genuinely found nothing".

#### Scenario: Configured provider yields grounded candidates

- **WHEN** the web-search provider is configured and an admin `POST`s `{ name: 'AWS Certified Cloud Practitioner', code: 'CLF-C02' }` to `/discover-sources`
- **THEN** the search provider is queried and its returned URLs populate the grounding set
- **AND** the response is `200` with a non-empty `candidates` array whose entries each expose a `url` and `title`
- **AND** a candidate whose host is the vendor's own domain (e.g. `aws.amazon.com`) is ranked ahead of a third-party candidate

#### Scenario: Provider not configured degrades to empty, not error

- **WHEN** no web-search provider credentials are configured and an admin `POST`s a valid body to `/discover-sources`
- **THEN** the response is `200` with an empty `candidates` array
- **AND** the "search provider not configured" condition is recorded in a log entry or metric
- **AND** no fabricated URL appears in the response

#### Scenario: Provider error does not surface as a 5xx

- **WHEN** the configured web-search provider returns an error or exceeds the request timeout during discovery
- **THEN** the discovery endpoint still responds `200` with an empty `candidates` array
- **AND** the failure is recorded in a log entry or metric

#### Scenario: Only genuinely-surfaced URLs are eligible

- **WHEN** the model proposes a candidate URL that the configured provider's results did not contain
- **THEN** that URL is dropped from `candidates` (grounding guard preserved), regardless of provider configuration
