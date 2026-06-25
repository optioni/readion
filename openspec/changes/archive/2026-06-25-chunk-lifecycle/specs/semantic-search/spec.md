## MODIFIED Requirements

### Requirement: Embedding-similarity chunk retrieval

The system SHALL provide a retrieval service that, given a query embedding and a certification, returns `content_chunks` for that certification ranked by cosine similarity to the query, using the pgvector HNSW index. Retrieval SHALL only consider chunks whose `state = 'active'`; `superseded` chunks are excluded from retrieval and never seed new generation, though they remain readable for history by direct id lookup. Each returned chunk SHALL carry its provenance (chunk id, source id, source URL, `primaryDomain`, and `metadata`) so downstream generation can cite it.

#### Scenario: Nearest chunks returned ranked by similarity

- **WHEN** the service is queried with an embedding for a certification that has ingested chunks
- **THEN** active chunks for that certification are returned ordered by descending cosine similarity
- **THEN** each result includes its chunk id, source id, source URL, and `primaryDomain`

#### Scenario: Results scoped to the queried certification

- **WHEN** two certifications each have chunks and the service is queried for one of them
- **THEN** only chunks belonging to the queried certification are returned

#### Scenario: Superseded chunks excluded from retrieval

- **WHEN** a chunk that would otherwise rank above the similarity threshold has `state = 'superseded'`
- **THEN** it is excluded from the retrieval results
- **THEN** it remains readable by direct id lookup for history
