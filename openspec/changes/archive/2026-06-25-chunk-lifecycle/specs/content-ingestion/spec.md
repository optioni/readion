## MODIFIED Requirements

### Requirement: Content-hash upsert and dedup

The worker SHALL use each chunk's `contentHash` as the upsert key so re-ingesting unchanged content does not create duplicate chunks. On re-ingestion the upsert SHALL be followed by reconciliation (see the `chunk-lifecycle` capability): after the new chunk set is upserted, chunks previously present for the source but absent from the latest fetch are marked `superseded` rather than left as dangling `active` rows. Reconciliation runs as part of the source's ingestion-completion handling.

#### Scenario: Unchanged content not duplicated

- **WHEN** a source is ingested, then re-ingested with identical content
- **THEN** the chunk count for that source is unchanged after the second run
- **THEN** every chunk remains `state = 'active'`

#### Scenario: New content inserted on re-ingestion

- **WHEN** a source is re-ingested and produces a chunk with a previously unseen `contentHash`
- **THEN** a new `content_chunks` row is inserted for that chunk with `state = 'active'`

#### Scenario: Re-ingestion triggers reconciliation of disappeared chunks

- **WHEN** a source is re-ingested and a chunk previously present for the source is absent from the latest fetch
- **THEN** reconciliation marks that chunk `state = 'superseded'` after the upsert completes
