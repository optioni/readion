## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the integration test harness: a NestJS testing module importing `GroundingModule` (which imports the existing `LlmModule`) against real Redis (Testcontainers) with the Vercel AI SDK mocked at the model boundary (`MockLanguageModelV2` from `ai/test`), and `semantic-search` retrieval seeded with fixture chunks, per design.md Test Boundaries
- [x] 0.2 Write failing acceptance test for the grounded-generation happy path + recovery: a generation function producing a contract-valid item that the (mocked) verifier passes is returned marked verified with provenance and cached; a first-attempt verifier failure followed by a passing regeneration returns the second item and records one regeneration; quarantining that item's cache key evicts it so the next read is a miss
- [x] 0.3 Confirm it fails for the right reason (`GroundingModule`/services not implemented), not a harness/config setup error

## 1. Grounding configuration (boot-time validation)

- [x] 1.1 RED: Write unit tests for the grounding Zod env group — max regeneration attempts `N`, the per-item verbatim cap, and reuse of the `semantic-search` grounding threshold; fail-fast on missing/malformed values
- [x] 1.2 GREEN: Add the grounding config group to `apps/api/src/config/env.schema.ts` (shared fragments under `packages/shared/src/env` where reusable) so it parses valid config and fails fast otherwise
- [x] 1.3 REFACTOR: Align naming with existing env-schema conventions

## 2. Shared contract & provenance types (`packages/shared`)

- [x] 2.1 RED: Write unit tests for the extractive item shape, the `Provenance` embeddable (`sourceChunkIds`, `supportingSpans`, verdict, score), the verifier-verdict type (pass/fail, score, per-distractor findings), and the grounding signals (`fetchMoreMaterial`, substitution) — asserting a provenance snapshot serializes self-contained
- [x] 2.2 GREEN: Implement the shared types/value objects in `packages/shared/src`
- [x] 2.3 REFACTOR: Ensure the types couple to no entity and no service, so entity-owning changes can embed them freely

## 3. Extractive-contract validator (pure)

- [x] 3.1 RED: Write unit tests for `extractive-contract.ts` — a verbatim span over a cited chunk passes; a span absent from every cited chunk fails with the offending span identified; a correct answer with no backing span fails; a `sourceChunkIds` entry outside the supplied chunk set is rejected; whitespace/markup normalization is applied consistently to both sides before substring comparison
- [x] 3.2 GREEN: Implement the pure validator
- [x] 3.3 REFACTOR: Centralize text normalization

## 4. Independent verifier pass

- [x] 4.1 RED: Write unit tests for `VerifierService` — issues a separate `answer-verification` task-type call (utility tier) through the gateway, distinct from generation; an entailed answer with incorrect distractors returns `pass` with per-distractor findings and a score; an answer not entailed by the span returns `fail`; a distractor that is actually correct returns `fail` naming the offending option
- [x] 4.2 GREEN: Implement `VerifierService` over the `LlmModule` gateway with a structured verdict
- [x] 4.3 REFACTOR: Clean up verdict parsing/normalization (assert on the normalized verdict type, not raw provider fields)

## 5. Grounded-generation orchestration

- [x] 5.1 RED: Write unit tests for `GroundedGenerationService` (validator + verifier injected/mocked) — first-pass valid+passing item returns verified with provenance and no regeneration; a failure then a pass within `N` returns the second item and records 1 regeneration; exhausting `N` discards and signals substitution from a different concept/chunk; an unverified item is never returned
- [x] 5.2 RED: Write unit tests for thin-coverage handling — supplied chunks all below the grounding threshold raise a `fetchMoreMaterial` signal naming certification + domain and do not exhaust regenerations; at least one at/above threshold proceeds normally
- [x] 5.3 RED: Write integration tests (real Redis via `llm-cache`) for verified-only cache write-through — a passing item is written through under the supplied cache key and a later read is a hit with no LLM call; a failed/discarded item writes nothing
- [x] 5.4 GREEN: Implement `GroundedGenerationService` (validate → verify → retry up to `N` → substitute → `fetchMoreMaterial`, with verified write-through to `llm-cache`), accepting an injected generation function, retrieved chunks, and a cache key
- [x] 5.5 REFACTOR: Clean up the attempt loop, signal types, and cache write-through

## 6. Quarantine & cache eviction

- [x] 6.1 RED: Write integration tests (real Redis via `llm-cache`) for `QuarantineService` — quarantining by cache key + provenance + reason evicts the cached entry and produces an immutable quarantine record carrying the provenance and reason; a post-quarantine read is a miss; user-report and auto-flag go through the same operation producing equivalent results
- [x] 6.2 GREEN: Implement `QuarantineService` over the `llm-cache` `evict` API plus the quarantine-record value object and report intake
- [x] 6.3 REFACTOR: Clean up the record shape and eviction wiring

## 7. Reading-block & agent grounding helpers (no verifier gate)

- [x] 7.1 RED: Write unit tests for `verbatim-cap.ts` — over-quoting beyond the configured per-item cap reports a violation identifying the excess; within-cap composition with all spans from cited chunks reports no violation
- [x] 7.2 RED: Write unit tests for `abstention.ts` — context below the grounding threshold indicates the agent SHALL abstain and is eligible to trigger `fetchMoreMaterial`; sufficient context indicates answer
- [x] 7.3 GREEN: Implement the verbatim-cap and abstention helpers
- [x] 7.4 REFACTOR: Reuse the shared threshold/normalization logic

## 8. Grounding metrics

- [x] 8.1 RED: Write unit tests asserting verifier pass and fail each increment the pass/fail metric; a regeneration and a substitution each record an observation; a quarantine increments the quarantined-item-rate metric labelled by certification — via injected recorders from the `observability` infrastructure
- [x] 8.2 GREEN: Emit the grounding metrics from `VerifierService`, `GroundedGenerationService`, and `QuarantineService` through the observability infrastructure
- [x] 8.3 REFACTOR: Centralize label construction

## 9. Acceptance Test — Outer Loop GREEN

- [x] 9.1 Confirm the acceptance test passes end-to-end
- [x] 9.2 Verify `apps/api` starts in the local environment with the grounding config present (smoke test) — boot and confirm no startup/config errors
- [x] 9.3 REFACTOR: Clean up test setup and mocks if needed

## 10. Change Review — Subagent Verification

- [x] 10.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 10.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 11. Polish

- [x] 11.1 Run linter and fix all errors (`yarn lint`)
- [x] 11.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 11.3 Run type checker with zero errors (`yarn workspace apps/api typecheck`)
- [x] 11.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
