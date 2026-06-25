## Purpose

The `LlmModule` response cache provides a Redis-backed store for verified LLM-generated quiz questions and explanations. It enforces a verified-only write gate, derives deterministic cache keys from generation inputs, supports configurable TTL expiry, and exposes an eviction operation for quarantine workflows.

## Requirements

### Requirement: Verified-only response cache store

The `LlmModule` SHALL provide a Redis-backed response cache for generated quiz questions and explanations. The cache `set` operation SHALL persist an entry only when the payload is marked verified; attempting to cache an unverified payload SHALL be rejected and store nothing. The definition of "verified" and the verifier pass that produces the verdict are owned by `grounding-verification`; this store enforces only the gate.

#### Scenario: A verified item is stored and then served from cache

- **WHEN** a verified quiz question is written to the cache for a given key
- **AND** a subsequent read is issued for the same key within the TTL
- **THEN** the cached question is returned
- **AND** no LLM call is made to satisfy the read

#### Scenario: An unverified item is never cached

- **WHEN** a caller attempts to cache a payload that is not marked verified
- **THEN** the cache rejects the write and stores nothing
- **AND** a later read for that key returns a miss

### Requirement: Output-determining cache key

The cache key SHALL be derived from the full set of inputs that determine the generated output: the source chunk id(s), difficulty, question format, and certification. Any user-specific input that influences generation MUST be part of the key. Two requests with identical key inputs SHALL resolve to the same cache entry; a change in any key input SHALL resolve to a different entry.

#### Scenario: Identical key inputs hit the same entry

- **WHEN** two requests share the same chunk id(s), difficulty, format, and certification
- **THEN** the second request's read returns the entry written by the first
- **AND** no second LLM call is made

#### Scenario: A different key input misses

- **WHEN** a request differs from a cached entry only in question format
- **THEN** the read returns a cache miss

#### Scenario: Chunk-id set order does not change the key

- **WHEN** two requests reference the same set of source chunk ids in different orders, with all other key inputs equal
- **THEN** both resolve to the same cache entry

### Requirement: Configurable cache TTL

Cache entries SHALL expire after a configurable TTL read from configuration. After the TTL elapses, a read for a previously cached key SHALL return a miss.

#### Scenario: Entry expires after the configured TTL

- **WHEN** a verified item is cached with a configured TTL
- **AND** the TTL has elapsed
- **THEN** a read for that key returns a miss

### Requirement: Eviction for quarantine

The cache SHALL expose an eviction operation that removes a cached entry by its key. After eviction, a read for that key SHALL return a miss until the entry is regenerated and re-cached. This is the path invoked when a question or explanation is reported/quarantined (the quarantine trigger itself is owned by `grounding-verification`/`quiz`).

#### Scenario: Evicted entry is no longer served

- **WHEN** a cached entry is evicted by its key
- **AND** a subsequent read is issued for the same key within what would have been the TTL
- **THEN** the read returns a miss
- **AND** the next generation for that key must call the LLM again
