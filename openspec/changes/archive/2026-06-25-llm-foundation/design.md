## Context

`apps/api` is bootstrapped (`api-foundation`, archived) with `@nestjs/config` + Zod env validation, a global response/error envelope, an `ioredis` connection, and the `observability` metrics/tracing infrastructure. There is no LLM layer: nothing calls the Vercel AI SDK, embeds text, or caches generated content. Per the roadmap, `llm-foundation` must land before `content-pipeline` because domain tagging and embeddings during ingestion both go through this layer, and before `grounding-verification`/`quiz`, which generate and cache verified content.

CLAUDE.md mandates: all LLM calls via the Vercel AI SDK (never a provider SDK directly), model IDs from config per task tier, TypeScript strict mode, absolute-path imports, no entity/migration for this change (entity-ownership table), and outside-in TDD.

This is a non-UI internal service layer — no HTTP endpoints, no frontend, no Claude Design source. The **Visual Design** section is intentionally omitted.

## Goals / Non-Goals

**Goals:**
- One provider-agnostic `LlmModule` gateway for text generation, streaming, and embeddings via the Vercel AI SDK; provider chosen from config.
- Task-type → model + tier + token-budget resolution from env vars; callers request a task, never a model string.
- Batched embedding service exposing the configured model's declared dimension (default 1536, OpenAI `text-embedding-3-small`).
- Provider prompt-caching helper for repeated static context, no-op on non-supporting providers.
- Redis-backed **verified-only** response cache keyed on output-determining inputs, with configurable TTL and an eviction (quarantine) path.
- Gateway-level metrics (latency, token usage, error rate per model/use-case) and tracing spans, emitted through `observability`.
- AI provider config group added to the `apps/api` Zod schema, failing fast at boot.

**Non-Goals:**
- The verifier pass and the meaning of "verified" — owned by `grounding-verification`; this change only enforces the cache gate and stores the verdict-bearing payload.
- The boot-time embedding-dimension check against the live `content_chunks` pgvector column — that column is owned by `content-pipeline`, which lands later; this change ships only the declared-dimension constant and a pure comparison helper.
- Actual prompt content for quiz/explanation/tagging/agent, chunking, pgvector upsert/dedup, quarantine triggers, agent system-prompt assembly — all owned by later changes.
- Any new entity, migration, or HTTP route.

## Test Boundaries

The provider HTTP calls are the only true external dependency. Per outside-in TDD, the acceptance test exercises the gateway/cache through their NestJS module boundary against a **real Redis (Testcontainers)** with the **Vercel AI SDK provider mocked at the model boundary** using the SDK's built-in test doubles (`MockLanguageModelV2` / `MockEmbeddingModelV2` from `ai/test`) — so no live LLM tokens are spent and outputs are deterministic, while the SDK plumbing, model resolution, token-budget wiring, instrumentation, and cache logic are all real.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Vercel AI SDK provider model (chat + embeddings) | Mocked at model boundary (`MockLanguageModelV2` / `MockEmbeddingModelV2` from `ai/test`) | Mocked at model boundary |
| Redis (response cache) | real (Testcontainers) | real (Testcontainers) for cache logic; pure key-builder needs no Redis |
| `@nestjs/config` env schema | real (loaded with test env) | real (Zod schema parsed directly) |
| Prometheus metrics / OTEL tracing (`observability`) | real registry, assert observed metrics | metric/span emission asserted via injected recorder |
| Postgres / `content_chunks` column | not involved (deferred to `content-pipeline`) | not involved; dimension comparison is a pure function over a number |

## Decisions

- **Mock the SDK at the model boundary, not via HTTP.** The Vercel AI SDK ships `MockLanguageModelV2`/`MockEmbeddingModelV2` test doubles that plug in where a real provider model would. Chosen over HTTP-level mocking (nock) because it is provider-agnostic (the whole point of the gateway), deterministic, and exercises the real SDK call path. Alternative — hitting a live provider in CI — rejected: non-deterministic, costs tokens, leaks keys.
- **Task-type registry over free-form model strings.** A `ModelRegistryService` maps each task type to `{ modelId, tier, maxOutputTokens }` resolved from config at startup. Chosen so callers express intent (`quiz-generation`) and cost controls/instrumentation labels are centralized; an unknown task type errors rather than silently defaulting. Alternative — callers pass model IDs — rejected: re-hardcodes models across modules and defeats per-tier budgeting.
- **Embedding provider configured independently of chat provider.** Two separate provider/model config keys because some chat providers (Anthropic) have no embedding model (SPEC). Default embeddings use OpenAI even when chat is Anthropic.
- **Declared dimension constant, not a live-column boot check, here.** The embedding service exposes `EMBEDDING_DIMENSION` derived from the configured model plus a pure `assertDimensionMatches(actual)` helper. The actual boot-time assertion against the `content_chunks` column is wired by `content-pipeline` (column owner). Chosen to respect entity/migration ownership boundaries and avoid shipping an unrunnable check.
- **Verified-only enforced in the cache `set` signature.** `set` accepts only a payload carrying a truthy `verified` verdict (type-enforced), so an unverified item is unrepresentable at the cache boundary rather than guarded by a runtime `if` callers might forget. Eviction is a first-class `evict(key)` for the quarantine path.
- **Cache key is a stable hash of canonicalized inputs.** Key = hash of `{ certificationId, sortedChunkIds, difficulty, format }`. Chunk ids are sorted so set-order doesn't fork the key; format is a planner-decided, known-up-front input so the cache can be checked before any LLM call (SPEC: Session Item Generation → formats). Any generation-influencing user input must be folded into the key (SPEC: LLM Cost Optimisation).
- **Reuse the existing `ioredis` connection.** The cache uses the Redis client already provided by `api-foundation` rather than a second connection pool.

## Risks / Trade-offs

- **Provider prompt-caching is provider-specific** → the helper centralizes the cache-control marking and no-ops on providers that lack it, so downstream callers don't branch on provider.
- **SDK test doubles can drift from real provider behavior** (e.g. token-usage shape) → keep the mock outputs aligned with the SDK's documented `usage` contract and assert on the gateway's normalized usage type, not raw provider fields.
- **Deferring the embedding dimension boot-check** could let a misconfigured embedding model slip through until `content-pipeline` → mitigated by shipping the pure validator + constant now and an explicit task note in `content-pipeline` to wire it; the dimension is also fixed at column-migration time, so the window is config-only.
- **Cache key omitting a real generation input would serve wrong content across users** → the spec makes "any user-specific generation input must be in the key" normative and the design forbids per-user prompt variation that isn't keyed (personalization is content *selection*, not text variation).

## Open Questions

- Exact env var names for the AI group (e.g. `AI_MODEL_QUIZ_GENERATION` vs `AI_UTILITY_MODEL`) — resolve during tasks to match existing `apps/api/src/config/env.schema.ts` naming conventions; leaning toward per-task-type vars to keep resolution direct.
- Whether token budgets are configured per task type or per tier with per-task overrides — default to per-task-type vars with tier-derived defaults; confirm against how `content-pipeline`/`quiz` want to tune them.
