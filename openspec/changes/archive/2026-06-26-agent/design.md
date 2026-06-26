## Context

`AgentModule` is the streaming AI tutor — the product's core differentiator (PRD FR5). Everything it composes is already archived: `llm-foundation` (Vercel AI SDK gateway, streaming, embeddings, Redis cache, prompt-cache layering), `sessions` (the `StudySession` lifecycle the in-session agent attaches to, and the `SessionItem` provenance `explainAnswer` reads), `grounding-verification` (the abstain-rather-than-guess + citation contract), `weak-areas` (ranked per-domain scores), `readiness` (the exam-readiness score), and `content-pipeline` (`content_chunks` + semantic search + the high-priority ingestion queue the slow path enqueues into).

This change owns two new entities — `AgentConversation` and `AgentMessage` — and a worker TTL cron, and exposes the SSE surface the two frontend chat views attach to. The central constraint is the **two-mode split**: the in-session agent carries the full cert-scoped tool set, prompt-cached context, and grounding contract; the standalone agent has **no tools, no cert context, no citations**, and a sliding 4-hour TTL. Conflating them would imply grounding the standalone chat cannot provide.

This is a non-UI, backend-only change. No web views or email templates are owned here, so there is no Visual Design section — the in-session split panel, citation chips, and tool-result rendering belong to `web-session-view`, and the standalone chat to `web-agent-chat`.

## Goals / Non-Goals

**Goals:**
- Own `AgentConversation` + `AgentMessage` tables and their migration. Persist every message type (user / assistant / tool-call / tool-result) as separate ordered rows with JSONB content mirroring the Vercel AI SDK `CoreMessage` type, so a conversation replays to the SDK verbatim on resume.
- One SSE streaming turn endpoint built on the SDK `streamText` loop (model + tools resolved from `llm-foundation`), persisting assistant/tool messages as they finalize.
- In-session mode: cert-scoped tool set, layered prompt-cached system prompt (static / semi-static / dynamic), grounding + abstention contract; lifecycle bound to its `StudySession` (no independent timeout).
- Standalone mode: general-knowledge tutor, **no tools, no cert context, no citations**, sliding 4-hour inactivity TTL.
- The six in-session tools, including `fetchMoreMaterial` fast path (inline) and slow path (high-priority job enqueue + `jobId` + SSE job-event bridge).
- Repository-layer ownership scoping on `userId`; cross-user access → 404.
- Worker TTL-cleanup cron + agent/SSE error-rate metric.

**Non-Goals:**
- Web/UI rendering of streamed messages, citation chips, or tool-result components — owned by `web-session-view` / `web-agent-chat`.
- Ingestion pipeline internals the slow path enqueues into — owned by `content-pipeline`; this change only enqueues and bridges job events.
- Readiness / weak-area / quiz-verification computation — read-only consumers here.
- The session-abandonment cron — owned by `sessions`; it already retires session-linked conversations, so this change must not double-handle them.

## Test Boundaries

Following repo convention: integration tests hit real Postgres + Redis via Testcontainers and never mock the DB; the LLM provider is always mocked at the Vercel AI SDK boundary (no real model calls in CI). SSE is asserted at the HTTP layer by consuming the event stream.

| Dependency | In acceptance test (e2e/integration) | In unit tests |
|---|---|---|
| Postgres (`AgentConversation`/`AgentMessage`) | real (Testcontainers) | real (Testcontainers) for repo logic; n/a for pure logic |
| Redis (BullMQ slow-path queue, LLM cache) | real (Testcontainers) | n/a |
| LLM provider (Vercel AI SDK `streamText`/tools) | mocked at the SDK boundary — scripted streamed deltas + deterministic tool-call sequences | mocked at the SDK boundary |
| `llm-foundation` gateway (model tier, prompt-cache layering) | real module wired to the mocked SDK provider | mocked collaborator (prompt-builder/tool units) |
| Semantic retrieval over `content_chunks` | real pgvector query against seeded chunks | mocked retrieval (tool units) |
| `sessions` / `SessionItem` provenance (for `explainAnswer`) | real rows seeded in the test DB | mocked collaborator (tool unit) |
| `weak-areas` / `readiness` (for `getUserProgress`/`getSessionHistory`) | real modules against seeded rows | mocked collaborators (tool/prompt units) |
| `content-pipeline` high-priority ingestion queue (slow path) | real BullMQ queue; assert a job is enqueued and bridge a fake completion event | mocked queue (tool unit) |
| Worker scheduler (`@nestjs/schedule`) | invoke the cron handler directly against the test DB | n/a |
| Auth (`JwtAuthGuard`) | real guard with a test-issued JWT | n/a |
| SSE transport | real HTTP — consume the event stream and assert ordered events | n/a |

Pure-logic units to isolate (no DB): layered system-prompt builder (static/semi-static/dynamic split + cache-control markers), tool-result payload shaping per tool, the fast-vs-slow `fetchMoreMaterial` decision (retrieval-score threshold), TTL-expiry predicate for the cleanup cron, and `CoreMessage` ↔ `AgentMessage` row (de)serialization.

## Decisions

- **Two entities; messages as ordered `CoreMessage` JSONB rows, not one blob.** `AgentMessage` stores one row per message (`role`, JSONB `content` = the SDK `CoreMessage` content: string or content-part array), with tool calls and tool results as their own rows. Resume fetches the ordered array and passes it straight to `streamText`. Alternative — store the whole transcript as one JSONB column on the conversation — rejected: loses per-row provenance, makes streaming-append and partial-failure recovery awkward, and diverges from the SPEC's "separate messages to allow full conversation reconstruction."
- **Mode is a property of the conversation, enforced at creation.** A conversation is either session-linked (has `studySessionId`, cert-scoped tools, prompt-cached context) or standalone (`studySessionId` null, no tools, no cert context). The tool set and system prompt are selected from the stored mode, never from the request. Alternative — single mode with tools toggled per request — rejected: invites a standalone chat accidentally getting cert tools and implying grounding it lacks (SPEC explicitly forbids this).
- **Streaming via SDK `streamText` over SSE; persist on finalize.** The turn opens an SSE response, runs the SDK multi-step tool loop, streams text deltas + tool lifecycle events to the client, and writes `AgentMessage` rows as each assistant/tool message finalizes (not per token). Alternative — buffer the whole turn then persist and return — rejected: defeats the streaming UX that is the entire point.
- **Layered prompt for caching.** The in-session system prompt is built in three layers with cache-control on the stable prefixes: **static** (cert name/provider/exam format/domain weights/strategy — stable per certification), **semi-static** (top-5 weak areas, readiness, active-session focus — stable per session), **dynamic** (everything per-request → fetched via tools, never in the prompt). The rule: changes-per-request ⇒ tool; stable-for-the-session ⇒ cached prompt. Standalone mode uses a minimal general-tutor prompt with no cert layers.
- **`fetchMoreMaterial` fast path inline, slow path as a job.** The tool first attempts generation from chunks already retrievable above the similarity threshold (fast, in-turn, no worker). Only when coverage is genuinely thin does it enqueue a **high-priority** job on the `content-pipeline` ingestion queue and return `{ status: "enqueued", jobId }`; the SSE channel then bridges that job's BullMQ events, and on completion the agent re-runs `semanticSearch`. New content never arrives synchronously in the same turn. Ingested chunks persist to the shared KB even if the user leaves — work is never wasted. Alternative — always enqueue — rejected: needless latency for the common case; alternative — always inline — rejected: can't cover genuinely missing topics.
- **`explainAnswer` derives from stored provenance, not re-stated sources.** It reads the `SessionItem`'s persisted `sourceChunkIds`/`supportingSpans` + verifier verdict and returns a structured explanation with a real citation chip. This keeps citations as genuine references (SPEC Grounding & Verification), not the model re-inventing a source.
- **Standalone TTL is a sliding 4-hour inactivity window, swept by a worker cron.** Each message refreshes `lastActivityAt`; a `@nestjs/schedule` cron in `apps/worker` soft-deletes standalone conversations past the window. Session-linked conversations are explicitly excluded — they are retired by the `sessions` abandonment cron. (Note: the generic CLI scaffold context said "7-day TTL"; SPEC/CLAUDE.md/roadmap are authoritative at **sliding 4-hour**, which is what is implemented.)
- **Grounding/abstention is prompt-enforced, not verifier-gated.** Streamed responses can't be pre-verified, so the in-session system prompt mandates: answer only from retrieved context, cite, and abstain ("I don't have enough material on that") rather than guess — abstention can trigger `fetchMoreMaterial`. This matches the SPEC's "reading blocks & agent — grounded, not verifier-gated."
- **Ownership at the repository layer.** Every conversation/message query is scoped on `userId` (and, for in-session, the parent session's ownership in the same scoped query). Cross-user access returns 404, not 403.

## Risks / Trade-offs

- [SSE connection dropped mid-turn, before assistant message persisted] → Persist each message as it finalizes within the turn; on reconnect/resume the ordered array replays cleanly. A dropped turn loses only the in-flight (not-yet-finalized) assistant delta.
- [Slow-path job never completes / user navigates away] → `jobId` returned immediately; ingested chunks persist to the shared KB regardless, so a later turn or session benefits. The SSE bridge tolerates the client disconnecting.
- [Prompt-cache invalidation when weak-areas/readiness change mid-session] → Semi-static layer is snapshotted at conversation start for cache stability; genuinely fresh figures are always reachable via `getUserProgress` (the dynamic layer), so staleness in the cached prefix never blocks accurate answers.
- [Tool emitting unbounded chunk text into the model context] → Reuse the `llm-foundation` token-budget/verbatim caps; `semanticSearch`/`fetchMoreMaterial` return capped, ranked results.
- [Standalone agent implying cert grounding] → Hard architectural exclusion: standalone conversations are created with no tools and no cert layers, selected from stored mode not request input.

## Open Questions

- Exact SSE event envelope (text-delta / tool-call / tool-result / job-event / done) — to be pinned in the spec scenarios so `web-session-view`/`web-agent-chat` can rely on a stable contract; default to the Vercel AI SDK data-stream protocol unless a project convention overrides.
- Whether `getSessionHistory` reads mock-exam history directly or only session history when `mock-exam` is present — include mock history when available, degrade to session-only otherwise (mock-exam is not a hard dependency of this change).
