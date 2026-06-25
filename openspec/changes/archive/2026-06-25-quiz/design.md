## Context

`QuizModule` is the first Phase 6 study feature. Its dependencies are all archived: `content-pipeline` / `semantic-search` (chunk retrieval over the live corpus), `grounding-verification` (the extractive contract, independent verifier, generate→verify→retry→substitute orchestration, `Provenance` shape, and quarantine path), `llm-foundation` (the AI-SDK gateway, utility-tier model resolution, and the verified-only response cache), `user-certifications` (enrollment + repository-layer ownership scoping), and `cert-go-live` (`Certification.state`).

The grounding capability already owns the hard parts: quiz does **not** re-implement validation, verification, retry/substitution, caching write-through, provenance serialization, quarantine, or grounding metrics. Quiz is the *consumer* that supplies a quiz-specific generation function, the retrieved chunks, and a cache key, and that turns verified items into HTTP responses and scored `QuizResponse` rows. This keeps the change small and avoids duplicating the verifier contract.

`SessionItem` (owned by `sessions`) does not exist yet. A `QuizResponse` must therefore be answerable without a session: it links to `UserCertification` and embeds a self-contained question/provenance snapshot. The later `sessions` change adds the `SessionItem` linkage via its own migration.

## Goals / Non-Goals

**Goals:**
- Generate grounded + verified quiz questions for an enrolled user against a `live` certification, driven through the existing grounding orchestration.
- Select question format (`multiple_choice` / `true_false` / `scenario`) deterministically from chunk characteristics + difficulty *before* generation, so `format` is a stable, pre-computable cache-key input.
- Generate grounded + verified explanations for wrong answers from stored provenance.
- Submit and score answers, persisting `QuizResponse` (correctness, confidence 1–5, time taken) scoped to the enrollment.
- Expose a report action that delegates to the shared quarantine path.

**Non-Goals:**
- The verifier, retry/substitution loop, cache write-through, provenance type, quarantine record, and grounding metrics — all owned and emitted by `grounding-verification`.
- Weak-area aggregation, session sequencing/pre-generation, review/SRS, and mock-exam flow — downstream changes that consume `QuizResponse`.
- Any `SessionItem` linkage or session-scoped lifecycle.
- Frontend quiz cards (owned by `web-session-view`). No UI in this change.

This change is backend-only; there is no designed view to import, so the Visual Design section is omitted.

## Test Boundaries

The acceptance test is a NestJS integration test (Supertest) hitting the real API with real Postgres + Redis via Testcontainers. The LLM is the only true external dependency and is mocked at the AI-SDK boundary so generation/verification are deterministic; retrieval embeddings are likewise mocked, while pgvector search runs for real over seeded chunks.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (incl. pgvector) | real (Testcontainers) | real for repo/scoring integration; n/a for pure helpers |
| Redis (LLM response cache) | real (Testcontainers) | n/a |
| LLM generation + verifier calls (AI SDK gateway) | mocked at gateway boundary (deterministic verdicts) | mocked |
| Embedding model (for `semanticSearch`) | mocked at gateway boundary; pgvector search runs real | mocked |
| `grounding-verification` orchestration | real (in-process module) | real for orchestration wiring; format planner & scoring tested as pure units |
| `semantic-search` chunk retrieval | real (in-process; mocked embeddings) | n/a |
| `user-certifications` ownership scoping | real (in-process module) | n/a |

## Decisions

- **Consume the orchestration, don't reimplement it.** Quiz calls the `grounding-verification` orchestration with `{ generate, chunks, cacheKey }`. Alternative — quiz running its own validate/verify loop — was rejected: it would duplicate the verifier contract and the cache gate, and risk divergence in what "verified" means. The orchestration alone holds the verdict the cache requires.
- **Format planner is a pure, deterministic helper owned by quiz.** It maps `{chunk characteristics, difficulty} → format`, with `scenario` reserved for exam-ready difficulty. It is pure so the cache key `{chunkIds, difficulty, format, certification}` is computable *before* any LLM call (cache check precedes generation). Alternative — letting the generation call pick the format — was rejected because it makes the key uncomputable up front and breaks the cache. Sessions (downstream) calls this same helper; quiz owns it now.
- **`QuizResponse` links to `UserCertification`, embeds a question/provenance snapshot, no `SessionItem` FK.** Alternative — FK to `SessionItem` — is impossible (entity owned by the later `sessions` change) and would invert the dependency. Embedding the snapshot (question, options, correctAnswer, `Provenance`) makes a response self-contained for later weak-area/explanation use without re-calling the model; `sessions` adds the nullable session linkage later.
- **Question identity is the cache handle, not a new entity.** Quiz owns no Question entity (entity-ownership table: quiz owns only `QuizResponse`). A generated question is returned with an opaque `id` that resolves to its verified cache entry — i.e. it deterministically encodes the `{ sourceChunkIds, difficulty, format, certification }` cache key. `POST /quiz/:id/answer`, `/explanation`, and `/report` re-read the verified item (question, `correctAnswer`, `Provenance`) from the `llm-cache` by that handle: scoring compares against the cached `correctAnswer`, the answer snapshot is copied into the `QuizResponse`, and report passes the handle's cache key + provenance to the shared quarantine path. Alternative — persisting every generated question as a row — was rejected: it would add an entity quiz does not own and bloat storage with items that may never be answered. A report/answer for a handle whose cache entry has expired or been quarantined returns a clear "question no longer available" error rather than fabricating one.
- **Scoring is server-side against the verified item.** Correctness is computed from the cached question's `correctAnswer`, never trusted from the client. Confidence (1–5) and time-taken come from the client and are validated by `class-validator`.
- **Report delegates to the shared quarantine operation.** The HTTP action (`POST /api/v1/quiz/.../report`) is wired here; the eviction + immutable record is the grounding capability's single quarantine path, shared with auto-flag.
- **Only generate against `live` certs.** A generation request for a `draft` cert is rejected (cert not yet go-live), consistent with `cert-go-live`.

## Risks / Trade-offs

- **Cache key must exclude per-user inputs** → the prompt must contain nothing user-specific; personalization is expressed as chunk *selection*, not text variation. Enforced by keeping the key = `{chunkIds, difficulty, format, certification}` and asserting no user id flows into the prompt.
- **Thin coverage during early ingestion** → the orchestration raises a `fetchMoreMaterial` signal instead of looping; quiz surfaces this as a typed result so the (future) session/agent caller can request ingestion. In this change it returns a clear "insufficient material" response rather than a fabricated question.
- **Deterministic format planner could feel repetitive** → acceptable for v1; difficulty + chunk characteristics give enough variation, and a stable key is worth more than format novelty.
- **Mocked LLM in tests can drift from real provider output shape** → mock at the same gateway boundary the orchestration uses, and assert on the structured contract (`question/options/correctAnswer/supportingSpans/sourceChunkIds`) the validator already enforces.

## Open Questions

- Should a standalone (non-session) quiz-question request be a first-class public endpoint, or only an internal service method that `sessions`/`mock-exam` call? Leaning internal service + a thin generate endpoint for e2e coverage; revisit when `sessions` lands.
- TTL for the verified-question cache — inherit the `llm-foundation` default unless quiz needs a distinct value.
