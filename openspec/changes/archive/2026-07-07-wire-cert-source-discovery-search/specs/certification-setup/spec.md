## ADDED Requirements

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
