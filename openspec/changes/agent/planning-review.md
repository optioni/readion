## Reviewed Artifacts

- proposal.md
- specs/agent-chat/spec.md
- specs/agent-tools/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | Acceptance harness (task 0.1) implied a Playwright UI flow, but this change owns no web view — the in-session split panel and standalone chat UI belong to `web-session-view`/`web-agent-chat`. | Reworded the acceptance harness to an integration-level Supertest + Testcontainers harness consuming the SSE response at the HTTP layer. | tasks.md §0.1 |
| SUGGESTION | design.md | Generic CLI scaffold context stated a "7-day" standalone TTL, conflicting with SPEC/CLAUDE.md/roadmap "sliding 4-hour inactivity TTL". | Recorded the discrepancy explicitly in the TTL decision and implemented the SPEC-authoritative 4-hour window across specs/tasks. | design.md Decisions; specs/agent-chat (TTL requirement) |

## No Remaining Implementation-Blocking Gaps

All capabilities named in proposal.md (`agent-chat`, `agent-tools`) have matching spec files, and the names match the roadmap's Capabilities column exactly. Every spec scenario maps to acceptance/integration/unit work in tasks.md: streaming turns and persistence (§0, §5, §6), entities + migration (§1), CoreMessage (de)serialization (§2), layered prompt (§3), the six tools incl. fast/slow `fetchMoreMaterial` and provenance-based `explainAnswer` (§4), the standalone sliding-4-hour TTL cron (§7), and the agent/SSE error-rate metric (§6). Owned entities `AgentConversation`/`AgentMessage` are created with their migration here (§1) and match the Entity-ownership table; no entity owned by another change is claimed. Test Boundaries name every collaborator the tasks rely on (real Postgres/Redis, mocked SDK provider, real `weak-areas`/`readiness`/`sessions`/`semantic-search`, real BullMQ queue for the slow path). All five dependencies (`llm-foundation`, `sessions`, `grounding-verification`, `weak-areas`, `readiness`) are archived. Scope stays contained to this roadmap row — UI rendering and ingestion internals are explicitly deferred to their owning changes.

## Deferred Non-Blocking Notes

- The SSE event envelope (text-delta / tool-call / tool-result / job-event / done) defaults to the Vercel AI SDK data-stream protocol; pinned as an open question in design.md for `web-session-view`/`web-agent-chat` to consume. Not implementation-blocking for the API/worker.
- `getSessionHistory` includes mock-exam history when present and degrades to session-only otherwise, since `mock-exam` is not a hard dependency of this change (captured in design.md Open Questions and the agent-tools spec scenario).
