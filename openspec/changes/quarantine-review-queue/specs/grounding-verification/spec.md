## MODIFIED Requirements

### Requirement: Quarantine and cache eviction

When the independent verifier rejects a generated item beyond the retry/substitution budget, the system SHALL quarantine it AND **persist a reviewable `QuarantinedItem` record** (verdict, reason, certification, domain, source-chunk provenance) in addition to evicting it from the verified cache and incrementing the quarantine metric. The quarantine metric and eviction behavior are unchanged; persistence makes quarantined items available to the admin review queue (`content-quarantine-review`). Approving a quarantined item SHALL re-instate it through the existing cache/knowledge-base path.

#### Scenario: Quarantine writes a durable record

- **WHEN** an item is quarantined after exhausting the retry/substitution budget
- **THEN** it is evicted from the verified cache, the quarantine metric increments, AND a `QuarantinedItem` row (`status: pending`) is persisted with the verdict, reason, and provenance
