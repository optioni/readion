## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the integration acceptance harness (Supertest + `@nestjs/testing` + Testcontainers Postgres/Redis, consuming the SSE response at the HTTP layer — no web UI is in scope for this change). Seed an enrolled `UserCertification` with a certification (domains/weights/exam format), an `active` `StudySession` with a quiz `SessionItem` carrying `sourceChunkIds`/`supportingSpans`, seeded `WeakArea` rows + a readiness score, and seeded `content_chunks` with embeddings; mock the LLM provider at the Vercel AI SDK boundary (scripted streamed deltas + deterministic tool-call sequences) per design.md Test Boundaries
- [x] 0.2 Write failing acceptance test for the in-session loop: create an in-session conversation under the seeded session → POST a message → assert `text/event-stream`, ordered text-delta events, a tool invocation + tool-result event, and a terminal completion event → assert `AgentMessage` rows persisted in turn order (user / tool-call / tool-result / assistant) and `lastActivityAt` refreshed
- [x] 0.3 Write failing acceptance test for the standalone loop: create a standalone conversation (no session) → POST a message → assert streamed reply with no cert-scoped tool events and `mode: "standalone"`
- [x] 0.4 Confirm both fail for the right reason (module/endpoints absent, not a harness/setup error)

## 1. Entities & migration (`packages/db`)

- [x] 1.1 RED: Write integration test for `AgentConversation` (user, optional `studySessionId`, optional `certificationId`, `mode` in_session/standalone, `lastActivityAt`, soft-delete marker) and `AgentMessage` (conversation ref, `role` user/assistant/tool/system, JSONB `content` mirroring `CoreMessage`, ordering) persisting and round-tripping against the test DB
- [x] 1.2 GREEN: Add MikroORM entities + the migration creating both tables (indexes on `userId`, `studySessionId`, and `lastActivityAt`; ordered-message index)
- [x] 1.3 REFACTOR: Align with base-entity conventions; confirm migration runs clean up/down

## 2. CoreMessage serialization & conversation repository (pure + DB)

- [x] 2.1 RED: Unit-test `CoreMessage` ↔ `AgentMessage` row (de)serialization (string and content-part-array content; tool-call and tool-result rows) and the ordered-replay array builder
- [x] 2.2 GREEN: Implement the (de)serializer and a `userId`-scoped conversation/message repository (create conversation, append message, load ordered array, get with messages)
- [x] 2.3 REFACTOR: Centralize role/content typing against the SDK `CoreMessage` type

## 3. System-prompt builder (pure logic)

- [x] 3.1 RED: Unit-test the layered prompt builder — static layer (cert name/provider/exam format/weighted domains/strategy), semi-static layer (top-5 weak areas, readiness, active-session focus) with cache-control on the stable prefix, and the minimal standalone prompt with no cert layers (collaborators mocked)
- [x] 3.2 GREEN: Implement the prompt builder selecting layers from conversation mode
- [x] 3.3 REFACTOR: Extract layer/cache-control assembly into named helpers

## 4. In-session tools (`agent-tools`)

- [x] 4.1 RED: Unit-test each tool against mocked collaborators — `semanticSearch` (cert-scoped ranked, capped), `fetchMoreMaterial` fast-vs-slow decision at the similarity threshold (inline payload vs. `{ status: "enqueued", jobId }`), `explainAnswer` deriving citation from stored `SessionItem` provenance (and not-found on another user's item), `getUserProgress` (readiness + ranked weak areas), `getSessionHistory` (recent sessions, mock-exam optional), `examStrategy` (tip payload), and structured-payload shaping per tool with `semanticSearch` marked internal
- [x] 4.2 GREEN: Implement the six tools as Vercel AI SDK tool definitions wired to `semantic-search`, `sessions`/`SessionItem`, `weak-areas`, `readiness`, and the `content-pipeline` ingestion queue (high-priority enqueue for the slow path)
- [x] 4.3 REFACTOR: Centralize similarity/cap thresholds and the abstain-rather-than-guess prompt guidance as config

## 5. Agent service & streaming turn

- [ ] 5.1 RED: Integration-test a turn through `AgentService` — runs the SDK `streamText` tool loop with mode-appropriate model/tools, persists user/tool-call/tool-result/assistant rows in order, refreshes `lastActivityAt`, replays prior ordered messages on a follow-up turn, and emits an SSE error event (not a silent hang) when the gateway errors
- [ ] 5.2 GREEN: Implement `AgentService` (mode-based tool/prompt selection via `llm-foundation` gateway, persist-on-finalize, resume by replay) and the slow-path BullMQ-event → SSE bridge
- [ ] 5.3 REFACTOR: Consolidate streaming-event shaping and per-message persistence

## 6. Controller, SSE endpoint & ownership scoping

- [ ] 6.1 RED: Integration-test the REST/SSE surface — create in-session conversation (`POST /sessions/:id/agent-conversations`), create standalone (`POST /agent-conversations`), stream message turn (`POST /agent-conversations/:id/messages`, `text/event-stream`), get conversation with `?include=messages`, and that cross-user access returns `404` via repository-layer `userId` scoping
- [ ] 6.2 GREEN: Implement the controller + SSE response, `{ data, relationships }` envelopes via the global interceptor, RFC 7807 errors via the global filter, and the agent success/error Prometheus metric
- [ ] 6.3 REFACTOR: Tidy DTOs/validation and `?include=` handling

## 7. Worker TTL-cleanup cron & metric

<!-- parallel-after: 1 -->

- [x] 7.1 RED: Integration-test the cron handler soft-deletes standalone conversations whose `lastActivityAt` is older than 4 hours, leaves recently active standalone ones untouched, and ignores session-linked conversations entirely
- [x] 7.2 GREEN: Implement the `@nestjs/schedule` cron in `apps/worker` for the sliding 4-hour standalone TTL
- [x] 7.3 REFACTOR: Make the TTL window configurable via env

## 8. API client regeneration

- [ ] 8.1 GREEN: Run `yarn codegen` against the running API and commit the regenerated Orval client for the new agent endpoints

## 9. Acceptance Test — Outer Loop GREEN

- [ ] 9.1 Confirm the in-session and standalone acceptance tests pass end-to-end
- [ ] 9.2 Verify all affected apps start in the local environment (smoke test) — boot `apps/api` and `apps/worker` and confirm no startup/config errors
- [ ] 9.3 REFACTOR: Clean up test setup and mocks if needed

## 10. Change Review — Subagent Verification

- [ ] 10.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [ ] 10.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 11. Polish

- [ ] 11.1 Run linter and fix all errors (`yarn lint`)
- [ ] 11.2 Run formatter and apply fixes (`yarn format:fix`)
- [ ] 11.3 Run type checker with zero errors (`apps/api`, `apps/worker`, `packages/db`)
- [ ] 11.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
