## MODIFIED Requirements

### Requirement: Eviction for quarantine

The cache SHALL expose an eviction operation that removes a cached entry by its key. After eviction, a read for that key SHALL return a miss until the entry is regenerated and re-cached. This is the path invoked when a question or explanation is reported/quarantined (the quarantine trigger itself is owned by `grounding-verification`/`quiz`).

Because a cache key is derived from its constituent source chunk id(s), the cache SHALL additionally maintain a chunk-id reverse index at write time (mapping each constituent chunk id to the set of cache keys derived from it) and SHALL expose an evict-by-chunk-id operation that evicts every cache key indexed under a given chunk id. This is the path invoked when a chunk is superseded (the supersede trigger itself is owned by `chunk-lifecycle`). Evicting by chunk id SHALL also prune that chunk id's reverse-index entry.

#### Scenario: Evicted entry is no longer served

- **WHEN** a cached entry is evicted by its key
- **AND** a subsequent read is issued for the same key within what would have been the TTL
- **THEN** the read returns a miss
- **AND** the next generation for that key must call the LLM again

#### Scenario: Write-through indexes each constituent chunk id

- **WHEN** an item is cached under a key derived from chunk ids `{c1, c2}`
- **THEN** the reverse index records that key under both `c1` and `c2`

#### Scenario: Evict-by-chunk-id removes every derived entry

- **WHEN** two cached items were written under keys derived from chunk id `c1`
- **AND** evict-by-chunk-id is invoked for `c1`
- **THEN** reads for both keys return a miss
- **AND** the reverse-index entry for `c1` is removed
