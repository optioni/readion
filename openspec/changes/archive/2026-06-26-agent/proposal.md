## Why

The product's core differentiator is an always-available AI tutor — the substitute for "asking the instructor" (PRD §3, FR5). The study loop (sessions, quiz, weak-areas, readiness, grounding) is now in place, but there is nowhere for a learner to ask a question. This change adds the streaming agent: an in-session, cert-grounded tutor with tools, and a standalone general-knowledge tutor. Agent engagement (≥1 interaction in ≥50% of sessions) is a tracked success metric, so this is on the MVP critical path.

## What Changes

- New **`AgentModule`** in `apps/api` owning the `AgentConversation` and `AgentMessage` entities (tables + migration). `AgentMessage.content` is JSONB mirroring the Vercel AI SDK `CoreMessage` type; user / assistant / tool-call / tool-result are each persisted as separate ordered rows so a conversation can be reconstructed and replayed to the SDK verbatim.
- **SSE streaming endpoint** — agent responses streamed over Server-Sent Events via the Vercel AI SDK (`streamText`). All LLM calls go through the SDK gateway from `llm-foundation` (mid-tier model); no provider SDKs imported directly.
- **Two agent modes:**
  - **In-session agent** — linked to a `StudySession`, scoped to that session's certification, with the full cert-scoped tool set. System prompt enforces grounding: answer only from retrieved context, cite sources, and **abstain** rather than guess when material is thin (abstention can trigger `fetchMoreMaterial`). No independent timeout; lifecycle follows its `StudySession` (the `sessions` abandonment cron retires it).
  - **Standalone agent** — a general-knowledge tutor with **no certification context and no cert-scoped tools**, answering from the model's general knowledge only. No inline citations. Sliding **4-hour inactivity TTL** refreshed on each message.
- **In-session agent tools** (capability `agent-tools`):
  - `semanticSearch` — query `content_chunks` by embedding similarity (internal; informs the agent's text response).
  - `fetchMoreMaterial` — **fast path (default):** generate from chunks already in the knowledge base, inline within the turn (no worker job). **Slow path:** when chunk coverage is genuinely thin, enqueue a high-priority worker ingestion job and return its `jobId`; the frontend subscribes to that job's BullMQ events over the same SSE channel, and on completion the agent re-runs `semanticSearch`. Ingested chunks persist to the shared knowledge base even if the user navigates away.
  - `explainAnswer` — structured explanation of a quiz answer derived from the stored `SessionItem` provenance (`sourceChunkIds`/`supportingSpans`) with a source citation.
  - `examStrategy` — advice on question-type approach or domain strategy.
  - `getUserProgress` — current readiness score + top weak-area domain scores + confidence ratings (read via `readiness` / `weak-areas`).
  - `getSessionHistory` — recent session and mock-exam history with per-domain accuracy trends.
- **Prompt-cached context** — the in-session system prompt is layered for prompt caching: static (cert name/provider/exam format/domain weights/strategy), semi-static (top-5 weak areas, readiness, active-session focus), dynamic (everything per-request fetched via tools). Built through the `llm-foundation` prompt-caching support.
- **Conversation persistence & resume** — every turn appends `AgentMessage` rows; resuming fetches the full ordered array and passes it straight to the SDK.
- **Worker cron** (`apps/worker`): soft-delete standalone `AgentConversation` records past their sliding 4-hour inactivity TTL. Session-linked conversations are explicitly **not** touched here (retired with their `StudySession`).
- **Metric**: emit agent/SSE error-rate (and basic agent-engagement signal) per SPEC Observability → Metrics and the guardrail metric in PRD §3.
- All agent resources enforce repository-layer ownership scoping on `userId`; cross-user access returns `404`.

## Capabilities

### New Capabilities
- `agent-chat`: conversation lifecycle and modes — in-session vs. standalone creation, SSE streaming turn over the Vercel AI SDK, `AgentConversation`/`AgentMessage` persistence as ordered `CoreMessage` JSONB rows, resume by replaying the full message array, prompt-cached layered system prompt, sliding 4-hour TTL for standalone conversations and the worker cleanup cron, ownership scoping, and the agent/SSE error-rate metric.
- `agent-tools`: the in-session cert-scoped tool set (`semanticSearch`, `fetchMoreMaterial` fast+slow, `explainAnswer`, `examStrategy`, `getUserProgress`, `getSessionHistory`), their grounding/abstention contract, the slow-path job enqueue + SSE job-event bridge, and the structured tool-result payloads the frontend renders inline.

### Modified Capabilities
<!-- None — no existing capability's requirements change. -->

## Impact

- **Entities owned (new tables + migration):** `AgentConversation` (session-linked or standalone, `lastActivityAt` for TTL, soft-delete marker) and `AgentMessage` (ordered rows, `role`, JSONB `CoreMessage` content). Both are listed under this change in the Entity-ownership table.
- **API:** new endpoints under `/api/v1` — create conversation (in-session under a session, or standalone), the SSE streaming message turn, list/get conversation with messages, scoped to the user. Orval client regenerated and committed.
- **Worker:** new `@nestjs/schedule` cron for standalone-conversation TTL cleanup; consumes the high-priority ingestion queue from `content-pipeline` for the slow-path `fetchMoreMaterial`.
- **Depends on (all archived):** `llm-foundation` (SDK gateway, streaming, embeddings, prompt caching), `sessions` (in-session lifecycle + `SessionItem` provenance for `explainAnswer`), `grounding-verification` (abstain-rather-than-guess + citation contract), `weak-areas` (`getUserProgress`/`getSessionHistory` inputs), `readiness` (readiness score). Slow-path also reaches the `content-pipeline` ingestion queue and `semantic-search`.
- **Consumed downstream by:** `web-session-view` (split-panel in-session chat + tool-result rendering), `web-agent-chat` (standalone chat), `product-analytics` (agent-engagement rate).
- **Boundaries kept out of scope:** any web/UI rendering of tool results (`web-session-view`/`web-agent-chat`), the ingestion pipeline internals the slow path enqueues into (`content-pipeline`), and readiness/weak-area computation (`readiness`/`weak-areas`).
