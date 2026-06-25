## Context

`llm-foundation` (archived) shipped the `LlmModule` gateway — including the `answer-verification` utility-tier task type — and the `llm-cache` *verified-only* response cache, whose `set` only persists items already marked verified and whose `evict(key)` is the quarantine path. `content-pipeline` (archived) shipped `semantic-search`: provenance-bearing chunk retrieval (chunk id, source id, source URL, `primaryDomain`, `metadata`) with a configurable minimum-similarity threshold (default `0.75`) used to detect thin coverage.

What does not exist yet is the meaning of "verified" and everything around it: the extractive-generation contract, the independent verifier pass, the generate→verify→retry→substitute orchestration, the shared provenance/verdict shape that gets persisted, the quarantine/report mechanism, and the reading-block/agent grounding contract. Per the roadmap (Phase 4), this must land before `quiz`, `mock-exam`, and `agent`, all of which depend on it.

CLAUDE.md constraints that bind this change: all LLM calls via the Vercel AI SDK gateway (never a provider SDK), model IDs from config per tier, TypeScript strict mode (no `any`/`as unknown`), absolute-path imports, outside-in TDD, and — per the entity-ownership table — **no entity, table, or migration** here. This is an internal service + shared-contract layer with no HTTP endpoint of its own.

## Goals / Non-Goals

**Goals:**
- An extractive-contract validator (pure) that enforces verbatim supporting spans over cited chunks before any model call.
- An independent `VerifierService` that runs a separate `answer-verification` gateway call and returns a structured verdict (pass/fail, score, per-distractor findings).
- A reusable `GroundedGenerationService` orchestration: validate → verify → regenerate up to `N` → substitute → `fetchMoreMaterial` on thin coverage; only ever returns a verified item.
- A shared `Provenance` embeddable + verifier-verdict types in `packages/shared`, embedded (not owned) by `sessions`/`mock-exam`/`quiz`.
- A `QuarantineService` that evicts the cache entry and produces an immutable quarantine record, shared by user-report and auto-flag.
- Reading-block verbatim-cap and agent-abstention helpers/contracts (no verifier gate on those paths).
- Grounding metrics through the `observability` infrastructure: verifier pass/fail, regeneration, substitution/abstention, quarantine rate per cert.

**Non-Goals:**
- Actual quiz/explanation/reading-block prompt content and the user-facing "report" HTTP endpoint — owned by `quiz`/`mock-exam`.
- Persisting provenance on `SessionItem`/`MockExam`/`QuizResponse` — their entity-owning changes embed the shared type.
- The agent system prompt and the `fetchMoreMaterial` tool implementation — owned by `agent`.
- The `AuditLog` entry on quarantine (`admin` owns `AuditLog`) and the admin quarantine-review UI (`web-admin`).
- Any entity, migration, or HTTP route.

This change is a non-UI internal service layer — no frontend views, no Claude Design source. The **Visual Design** section is intentionally omitted.

## Test Boundaries

The only true external dependency is the LLM provider call behind the gateway, plus Redis behind the cache. Per outside-in TDD, the acceptance test exercises `GroundingModule` through its NestJS module boundary against **real Redis (Testcontainers)** with the **Vercel AI SDK mocked at the model boundary** (`MockLanguageModelV2` from `ai/test`, the same approach `llm-foundation` used), so the verifier's call path, the cache gate/eviction, and the orchestration are all real while outputs stay deterministic and no tokens are spent. The extractive-contract validator, verbatim-cap, and abstention helpers are pure and need no I/O.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| LLM provider (verifier / generation calls) | Mocked at model boundary (`MockLanguageModelV2` from `ai/test`) via the gateway | Mocked at model boundary |
| `llm-foundation` gateway (`answer-verification` resolution) | real module, mocked provider model | real resolution; provider mocked |
| `llm-cache` (Redis response cache + `evict`) | real (Testcontainers Redis) | real (Testcontainers) for cache/quarantine; pure validators need none |
| `semantic-search` retrieval | real service with stub/seeded chunks (no live scrapper) | retrieval results passed in as fixtures |
| Prometheus metrics / OTEL tracing (`observability`) | real registry, assert observed metrics | emission asserted via injected recorder |
| Postgres / domain entities (`SessionItem`, `MockExam`, `QuizResponse`) | not involved — provenance is a serializable value object only | not involved; provenance shape tested as a pure type |

## Decisions

- **Verifier is a distinct gateway call, not a second pass of the generator.** The verifier resolves the `answer-verification` task type and issues its own call so the model never grades its own work (SPEC: "a distinct call"). Alternative — asking the generator to self-check in one call — rejected: defeats the independence guarantee.
- **Extractive contract enforced by a pure validator *before* the verifier.** Verbatim-substring checking of `supportingSpans` against cited chunk text is deterministic and free, so it runs first and short-circuits a wasted verifier call when an item is ungrounded. The model verifier then judges only entailment/distractor-correctness, which is genuinely a model task. Alternative — letting the verifier also catch non-verbatim spans — rejected: spends a model call on something a string check settles, and is less reliable.
- **Orchestration takes an injected generation function; it does not own prompts.** `GroundedGenerationService` is generic over "produce a candidate item from these chunks", so `quiz` and `mock-exam` supply their own prompts while reusing one validate→verify→retry→substitute policy. Chosen to keep the faithfulness guarantee in one place and prompts in their owning features. Alternative — baking quiz prompts here — rejected: leaks `quiz` scope into a Phase-4 foundation.
- **"Verified" is a typed verdict, and the cache `set` only accepts it.** The verdict object the verifier returns is exactly what `llm-cache.set` requires as its verified marker, so an unverified item is unrepresentable at the cache boundary rather than guarded by a forgettable runtime `if`. Reuses the gate `llm-foundation` already shipped.
- **Provenance is a shared embeddable, persisted by entity owners — no table here.** Per the entity-ownership table, `grounding-verification` owns no entity. The `Provenance` value type lives in `packages/shared` and is embedded into `SessionItem`/`MockExam`/`QuizResponse` by their owning changes. Citations are rendered from this snapshot, so a later superseded chunk does not corrupt historical items (SPEC: provenance is a snapshot).
- **Quarantine = evict + immutable record, one path for report and auto-flag.** `QuarantineService.quarantine(key, provenance, reason)` calls `llm-cache.evict` and emits a record for admin surfacing; both the user "report" action (wired by `quiz`/`mock-exam`) and automatic flags call it. No `Quarantine` entity exists in the ownership table, so the record is a value object surfaced to admins over the stored item's state and the metric, not a new table; the `AuditLog` write is left to the consuming privileged-action change (`admin` owns `AuditLog`).
- **Thin-coverage detection reuses the retrieval threshold, not a new heuristic.** `fetchMoreMaterial` is raised when supplied chunks are all below the `semantic-search` grounding threshold, so "thin" has one definition across retrieval and generation. Alternative — a separate confidence cutoff here — rejected: two thresholds drift.
- **Reading-block and agent paths are grounded but not verifier-gated.** Reading blocks rely on the chunk text *being* the source plus a verbatim cap; the agent relies on abstention because streaming output cannot be pre-verified (SPEC). This change ships the cap and abstention helpers; the composer/system-prompt assembly is deferred to `sessions`/`agent`.

## Risks / Trade-offs

- **Verifier roughly doubles cold-generation calls** (generate + verify, plus regenerations) → runs on the cheap `utility` tier and only verified items are cached, so steady-state cost stays bounded (SPEC); regeneration is capped at `N`.
- **A subtly wrong verifier could pass a bad item or reject good ones** → the verdict is structured (per-distractor findings + score) so failures are inspectable, the quarantine/report path is the real-world backstop for the rare miss, and metrics expose pass/fail and quarantine rates per cert as a quality signal.
- **Verbatim-substring matching is sensitive to whitespace/markup normalization** → normalize chunk text and spans consistently (same normalization on both sides) before substring comparison so faithful quotes are not rejected on formatting noise; cover with unit tests.
- **SDK test doubles can drift from real provider verdict shape** → assert on the gateway's normalized output and the service's own verdict type, not raw provider fields, mirroring `llm-foundation`.
- **Provenance shape must satisfy three future consumers** (`SessionItem`, `MockExam`, `QuizResponse`) → keep it a minimal, serializable value object with no entity coupling so each owner can embed it without importing this module's services.

## Open Questions

- Default value of `N` (max regeneration attempts) and whether it is per task type or a single grounding-wide config — lean toward one config value with room for per-caller override; confirm against how `quiz`/`mock-exam` want to tune it.
- The verbatim-cap unit (characters vs. percentage of the item, and per-span vs. per-item total) — resolve in tasks; default to a per-item character cap from config.
- Exact env var names for the grounding group (`GROUNDING_MAX_REGEN_ATTEMPTS`, `GROUNDING_VERBATIM_CAP`, reuse of the retrieval threshold) — align with existing `apps/api/src/config/env.schema.ts` conventions during tasks.
- Whether the quarantine record is surfaced purely via metrics + the stored item's state now, with the admin read model deferred to `content-admin`/`web-admin` — assume yes; this change exposes the record shape and eviction, not an admin query endpoint.
