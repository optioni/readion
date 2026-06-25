## ADDED Requirements

### Requirement: Extractive-generation contract

The system SHALL define a structured shape for any grounded generated item — `question`, `options[]`, `correctAnswer`, `supportingSpans[]`, and `sourceChunkIds[]` — published in `packages/shared`, and a validator that enforces the extractive contract before any verifier call. Every entry in `supportingSpans` MUST be a verbatim substring of the text of one of the cited `sourceChunkIds`, and the `correctAnswer` MUST be backed by at least one supporting span. An item that fails the contract SHALL be rejected by the validator and MUST NOT proceed to the verifier or be persisted.

#### Scenario: Verbatim span over a cited chunk passes the contract

- **WHEN** the validator is given an item whose every `supportingSpan` appears verbatim in the text of a chunk listed in `sourceChunkIds`, and at least one span backs the `correctAnswer`
- **THEN** the validator reports the item as contract-valid
- **AND** the item is allowed to proceed to the verifier pass

#### Scenario: A span not present in any cited chunk fails the contract

- **WHEN** the validator is given an item containing a `supportingSpan` that does not appear verbatim in the text of any chunk in `sourceChunkIds`
- **THEN** the validator reports the item as contract-invalid with the offending span identified
- **AND** the item does not proceed to the verifier pass

#### Scenario: A correct answer with no supporting span fails the contract

- **WHEN** the validator is given an item whose `supportingSpans` are all verbatim but none of them backs the `correctAnswer`
- **THEN** the validator reports the item as contract-invalid
- **AND** the item does not proceed to the verifier pass

#### Scenario: A span citing a chunk id not in the retrieved set is rejected

- **WHEN** the validator is given an item whose `sourceChunkIds` references a chunk id that is not among the chunks supplied for generation
- **THEN** the validator reports the item as contract-invalid

### Requirement: Independent verifier pass

Before any generated question or explanation is shown or cached, the system SHALL run an independent verifier as a separate `answer-verification` utility-tier model call (resolved through the `llm-foundation` gateway), distinct from the generation call, so the generator never grades its own output. The verifier SHALL check that the `correctAnswer` is entailed by the cited supporting span(s) and that every distractor option is incorrect per the cited source. It SHALL return a structured verdict carrying an overall pass/fail, a score, and per-distractor findings.

#### Scenario: Verifier issues a separate utility-model call

- **WHEN** the verifier checks a generated item
- **THEN** it issues an `answer-verification` task-type call through the gateway, separate from the generation call
- **AND** the resolved model tier for that call is `utility`

#### Scenario: Entailed answer with incorrect distractors passes

- **WHEN** the verifier evaluates an item whose `correctAnswer` is entailed by its cited span and whose distractors are each incorrect per the source
- **THEN** the verdict is `pass`
- **AND** the verdict carries a score and a per-distractor finding for each option

#### Scenario: Answer not entailed by the span fails

- **WHEN** the verifier evaluates an item whose `correctAnswer` is not entailed by the cited span
- **THEN** the verdict is `fail`

#### Scenario: A distractor that is actually correct fails verification

- **WHEN** the verifier evaluates an item where one distractor is also supported as correct by the source
- **THEN** the verdict is `fail`
- **AND** the offending distractor is identified in the per-distractor findings

### Requirement: Generate, verify, retry, and substitute orchestration

The system SHALL provide a reusable grounded-generation orchestration that downstream generators drive by supplying a generation function, the retrieved chunks, and a cache key. For each requested item the orchestration SHALL run the extractive-contract validator and then the independent verifier. On a contract or verifier rejection it SHALL regenerate up to a configured maximum number of attempts `N`. If the item still fails after `N` attempts, the orchestration SHALL discard it and signal that a substitute MUST be generated from a different concept/chunk so the requested count stays full. A returned item SHALL always be both contract-valid and verifier-passed; an unverified item SHALL never be returned to the caller. When an item passes, the orchestration SHALL write it through to the `llm-cache` under the supplied key, since it alone holds the verifier verdict the cache gate requires; an item that fails or is discarded SHALL NOT be written to the cache.

#### Scenario: First attempt passes and is returned with its verdict

- **WHEN** the orchestration generates an item that is contract-valid and the verifier passes on the first attempt
- **THEN** the item is returned to the caller marked verified with its verdict and provenance attached
- **AND** no regeneration is attempted

#### Scenario: Regeneration recovers a rejected item within N attempts

- **WHEN** the first generated item fails verification and a regenerated item passes on the second attempt, with `N` configured to 3
- **THEN** the orchestration returns the second, passing item
- **AND** a regeneration count of 1 is recorded for that item

#### Scenario: Exhausting N attempts triggers substitution from a different concept

- **WHEN** every attempt up to the configured `N` fails verification for the chosen concept/chunk
- **THEN** the orchestration discards the item and signals a substitution from a different concept/chunk
- **AND** the substitution event is recorded

#### Scenario: An unverified item is never returned

- **WHEN** the orchestration cannot produce a passing item for a slot
- **THEN** it returns either a verified substitute or a thin-coverage signal
- **AND** it never returns an item whose verdict is not `pass`

#### Scenario: A passing item is written through to the cache; a failing one is not

- **WHEN** an item passes verification under a supplied cache key
- **THEN** the orchestration writes it through to the `llm-cache` under that key with its verified verdict
- **AND** a later read for that key is a hit served without an LLM call
- **WHEN** instead the item fails verification and is discarded
- **THEN** nothing is written to the cache for that key

### Requirement: Thin-coverage fetch-more-material signal

When the retrieved chunks for a topic are genuinely thin — the retrieval similarity scores fall below the configured grounding threshold — the orchestration SHALL raise a `fetchMoreMaterial` signal for that topic rather than forcing a low-confidence item or looping regeneration. The signal SHALL identify the certification and target domain/topic so the caller can request additional ingestion.

#### Scenario: Below-threshold retrieval raises fetchMoreMaterial

- **WHEN** the chunks supplied for a topic all have retrieval similarity below the configured grounding threshold
- **THEN** the orchestration raises a `fetchMoreMaterial` signal naming the certification and target domain
- **AND** it does not exhaust regeneration attempts against the thin material

#### Scenario: Sufficient coverage does not raise the signal

- **WHEN** at least one supplied chunk for the topic is at or above the grounding threshold
- **THEN** no `fetchMoreMaterial` signal is raised and generation proceeds normally

### Requirement: Provenance and verdict persistence shape

The system SHALL define a shared `Provenance` value type — `sourceChunkIds`, `supportingSpans`, and the verifier verdict and score — as an embeddable structure in `packages/shared` that entity-owning changes embed where they persist a generated item (`SessionItem`, the `MockExam` question array, `QuizResponse`). The persisted provenance SHALL be a self-contained snapshot sufficient to render citation chips and drive the `explainAnswer` tool without re-calling the model. This change SHALL NOT create any entity, table, or migration.

#### Scenario: Provenance snapshot is self-contained

- **WHEN** a verified item's provenance is serialized for persistence
- **THEN** it contains the `sourceChunkIds`, the `supportingSpans`, and the verifier verdict and score
- **AND** rendering its citations requires no further model call

#### Scenario: No entity or migration is introduced

- **WHEN** the change's database footprint is inspected
- **THEN** it adds no entity, table, or migration
- **AND** the provenance type is consumed by the entity-owning changes that persist it

### Requirement: Quarantine and cache eviction

The system SHALL provide a quarantine operation that, given a generated item's cache key and its provenance, evicts the cached entry through the `llm-cache` eviction API and produces an immutable quarantine record (item reference, provenance, and reason) for admin surfacing. A quarantined item SHALL never be served from cache or reused. The operation SHALL be the single path invoked both by a user "report" and by an automatic flag; the user-facing report HTTP action itself is wired by the consuming feature (`quiz`/`mock-exam`).

#### Scenario: Reported item is evicted and recorded

- **WHEN** an item is quarantined by its cache key and provenance with a reason
- **THEN** the cached entry for that key is evicted
- **AND** an immutable quarantine record carrying the provenance and reason is produced

#### Scenario: A quarantined key is not served from cache

- **WHEN** a read is issued for a cache key after its item was quarantined
- **THEN** the read returns a miss
- **AND** the next generation for that key must call the LLM again

#### Scenario: Report and auto-flag share one quarantine path

- **WHEN** a quarantine is triggered by a user report and, separately, by an automatic flag
- **THEN** both go through the same quarantine operation producing an equivalent record and eviction

### Requirement: Reading-block and agent grounding without a verifier gate

The system SHALL provide grounding guarantees for the non-verifier-gated paths. For reading blocks it SHALL expose a verbatim-cap helper that enforces a configurable maximum amount of verbatim source text any single item may surface, so composed prose stays grounded in cited chunks rather than reproducing source pages. For the agent path it SHALL expose an abstention contract: answer only from retrieved context, and when material is thin abstain ("I don't have enough material on that") rather than guess, with abstention able to trigger `fetchMoreMaterial`. This change defines these helpers/contracts; the reading-block composer and agent system prompt are assembled by their owning changes.

#### Scenario: Verbatim cap rejects over-quoting

- **WHEN** a composed reading block would surface verbatim source text exceeding the configured cap
- **THEN** the verbatim-cap helper reports a violation identifying the excess

#### Scenario: Within-cap composition passes

- **WHEN** a composed reading block's verbatim source text is within the configured cap and every quoted span is from a cited chunk
- **THEN** the verbatim-cap helper reports no violation

#### Scenario: Thin agent context yields abstention

- **WHEN** the abstention helper is evaluated against retrieved context whose similarity is below the grounding threshold for the question
- **THEN** it indicates the agent SHALL abstain rather than answer
- **AND** the abstention is eligible to trigger `fetchMoreMaterial`

### Requirement: Grounding metrics

The system SHALL emit, through the existing observability infrastructure, the grounding metrics named in SPEC → Observability → Metrics: verifier pass/fail rate, regeneration count per item, substitution/abstention rate, and user-reported/quarantined-item rate per certification.

#### Scenario: Verifier outcomes are recorded

- **WHEN** the verifier returns a pass and, separately, a fail
- **THEN** the verifier pass/fail metric is incremented for each outcome

#### Scenario: Regeneration and substitution are counted

- **WHEN** an item is regenerated once and another item is substituted after exhausting attempts
- **THEN** a regeneration observation and a substitution observation are recorded

#### Scenario: Quarantine rate is labelled by certification

- **WHEN** an item for a given certification is quarantined
- **THEN** the quarantined-item-rate metric is incremented with that certification's label
