## ADDED Requirements

### Requirement: Embedding-similarity chunk retrieval

The system SHALL provide a retrieval service that, given a query embedding and a certification, returns `content_chunks` for that certification ranked by cosine similarity to the query, using the pgvector HNSW index. Each returned chunk SHALL carry its provenance (chunk id, source id, source URL, `primaryDomain`, and `metadata`) so downstream generation can cite it.

#### Scenario: Nearest chunks returned ranked by similarity

- **WHEN** the service is queried with an embedding for a certification that has ingested chunks
- **THEN** chunks for that certification are returned ordered by descending cosine similarity
- **THEN** each result includes its chunk id, source id, source URL, and `primaryDomain`

#### Scenario: Results scoped to the queried certification

- **WHEN** two certifications each have chunks and the service is queried for one of them
- **THEN** only chunks belonging to the queried certification are returned

### Requirement: Minimum similarity threshold

The retrieval service SHALL discard any candidate whose cosine similarity is below a configurable minimum threshold (default `0.75`), even if it is among the nearest neighbours.

#### Scenario: Below-threshold neighbours discarded

- **WHEN** the nearest chunk to a query has cosine similarity `0.62` and the threshold is `0.75`
- **THEN** that chunk is excluded from the results

#### Scenario: Threshold configurable via env

- **WHEN** the similarity threshold is configured to `0.80` via environment variable
- **THEN** chunks with similarity between `0.75` and `0.80` are excluded that would have passed at the default

### Requirement: Domain-filtered retrieval

The retrieval service SHALL support restricting results to chunks tagged with one or more target domains, matching against any entry in a chunk's `domainTags` (not only `primaryDomain`).

#### Scenario: Match on a non-primary domain tag

- **WHEN** retrieval is filtered to domain `Architecture` and a chunk has `primaryDomain = 'Security'` but also a `domainTags` entry for `Architecture` above threshold
- **THEN** that chunk is eligible to be returned

#### Scenario: Chunk outside target domains excluded

- **WHEN** retrieval is filtered to domain `Networking` and a chunk has no `Networking` entry in its `domainTags`
- **THEN** that chunk is excluded even if its similarity exceeds the threshold
