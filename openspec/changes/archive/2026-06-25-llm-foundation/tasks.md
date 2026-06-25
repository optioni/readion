## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the integration test harness: a NestJS testing module importing `LlmModule` against real Redis (Testcontainers) and the Vercel AI SDK mocked at the model boundary (`MockLanguageModelV3` / `MockEmbeddingModelV3` from `ai/test`), per design.md Test Boundaries
- [x] 0.2 Write failing acceptance test for the gateway happy path: a `quiz-generation` request resolves the configured utility model, calls the SDK, returns text + token usage; a verified quiz item is cached and a second identical request is served from cache with no second SDK call; eviction makes the next request call the SDK again
- [x] 0.3 Confirm it fails for the right reason (module/services not implemented), not a harness/config setup error

## 1. AI provider configuration (boot-time validation)

- [x] 1.1 RED: Write unit tests for the AI provider Zod env group — required provider name + API key (fail-fast in production when missing), per-task-type model IDs, independent embedding provider/model, per-task token budgets, response-cache TTL, and the absence of any runtime embedding-dimension var
- [x] 1.2 GREEN: Add the AI provider group to `apps/api/src/config/env.schema.ts` (and reusable fragments in `packages/shared/src/env`) so it parses valid config and fails fast on missing/malformed values
- [x] 1.3 REFACTOR: De-duplicate per-task env keys and align naming with existing schema conventions

## 2. Model registry (task-type → model/tier/token-budget)

- [x] 2.1 RED: Write unit tests for `ModelRegistryService` — each supported task type (quiz-generation, answer-verification, domain-tagging, agent-qa, certification-prefill, material-generation, complex-reasoning) resolves to its configured `{ modelId, tier, maxOutputTokens }`; unknown task type throws
- [x] 2.2 GREEN: Implement `ModelRegistryService` reading resolution from validated config
- [x] 2.3 REFACTOR: Clean up tier/budget derivation

## 3. Embedding service (batched + declared dimension)

- [x] 3.1 RED: Write unit tests for `EmbeddingService` — default model declares dimension 1536; single embed returns a 1536-vector; batch of N inputs returns N vectors in order via one batched call; embedding provider is independent of chat provider; pure `assertDimensionMatches(actual)` helper passes/throws correctly
- [x] 3.2 GREEN: Implement `EmbeddingService` over the Vercel AI SDK `embedMany`/`embed`, exposing the declared dimension constant and the comparison helper
- [x] 3.3 REFACTOR: Clean up batching and dimension exposure

## 4. LLM gateway (generate / stream)

- [x] 4.1 RED: Write unit tests for `LlmService` — `generateText`/`streamText` invoke the SDK with the model resolved for the task type and the task's max-token budget; returns normalized text + token usage; provider comes from `AI_PROVIDER`
- [x] 4.2 GREEN: Implement `LlmService` and `LlmModule` (global/exported) wiring the configured provider adapter, model registry, and embedding service
- [x] 4.3 REFACTOR: Clean up provider-adapter wiring; assert no direct `@anthropic-ai/sdk`/`openai` imports outside the provider-adapter file

## 5. Prompt-cache helper

- [x] 5.1 RED: Write unit tests for the prompt-cache helper — marks static context with the provider cache-control marker on a supporting provider; passes content through unchanged (no error) on a non-supporting provider
- [x] 5.2 GREEN: Implement the prompt-cache helper
- [x] 5.3 REFACTOR: Clean up provider-capability branching

## 6. Verified-only response cache

- [x] 6.1 RED: Write unit tests for the cache key builder — key derived from `{ certificationId, sortedChunkIds, difficulty, format }`; chunk-id order does not change the key; any differing key input produces a different key
- [x] 6.2 GREEN: Implement the cache key builder (pure function)
- [x] 6.3 RED: Write integration tests (real Redis) for `LlmResponseCacheService` — `set` stores only verified payloads and rejects unverified ones; identical-key read is a hit with no LLM call; differing-key read is a miss; entry expires after the configured TTL; `evict(key)` removes the entry
- [x] 6.4 GREEN: Implement `LlmResponseCacheService` over the existing `ioredis` connection with the verified-only `set` signature and `evict`
- [x] 6.5 REFACTOR: Clean up serialization and TTL handling

## 7. Gateway instrumentation

- [x] 7.1 RED: Write unit tests asserting the gateway records latency + token-usage observations labelled `model`/`use_case` on success and increments the error metric on failure, and wraps calls in tracing spans (via injected recorders from the observability infrastructure)
- [x] 7.2 GREEN: Add metrics/tracing emission to `LlmService` through the `observability` infrastructure
- [x] 7.3 REFACTOR: Centralize label construction

## 8. Acceptance Test — Outer Loop GREEN

- [x] 8.1 Confirm the acceptance test passes end-to-end
- [x] 8.2 Verify `apps/api` starts in the local environment with the AI config present (smoke test) — boot and confirm no startup/config errors
- [x] 8.3 REFACTOR: Clean up test setup and mocks if needed

## 9. Change Review — Subagent Verification

- [x] 9.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 9.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 10. Polish

- [x] 10.1 Run linter and fix all errors (`yarn lint`)
- [x] 10.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 10.3 Run type checker with zero errors (`yarn workspace apps/api typecheck`)
- [x] 10.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
