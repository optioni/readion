## Reviewed Artifacts

- proposal.md
- specs/web-agent-chat/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | The acceptance-test setup (0.1) named a "Playwright e2e harness" without a concrete file path; the repo convention is `apps/web/e2e/*.e2e.ts` (e.g. `session-view.e2e.ts`, `progress.e2e.ts`). | Pinned the e2e file to `apps/web/e2e/agent-chat.e2e.ts` so the outer-loop test lands in the right place. | tasks.md → group 0.1 |
| SUGGESTION | tasks.md | Polish commands could drift from real workspace scripts. | Verified against `apps/web/package.json` — `typecheck`, `test:coverage`, `lint`, `format` are the actual scripts; tasks 8.1–8.4 already match. No change needed. | tasks.md → group 8 (verified, no edit) |

## Reconciliation verification (no edits required)

- **Capability coverage.** proposal.md declares exactly one new capability `web-agent-chat`; `specs/web-agent-chat/spec.md` exists and matches; no Modified Capabilities; nothing exists only in tasks/design. Aligned.
- **Endpoints pinned to concrete Orval methods.** The three consumed endpoints are pinned across proposal/design/tasks to committed client methods: create → `agentControllerCreateStandalone` / `useAgentControllerCreateStandalone`; hydrate → `agentControllerDetail` / `useAgentControllerDetail` (with `include=messages`); SSE turn → raw `POST /api/v1/agent-conversations/:id/messages` consumed via the `useAgentTurnStream` fetch reader (the generated `agentControllerStreamTurn` stub is deliberately bypassed — it posts no body and types the response `void`, and SSE-over-POST is not an `EventSource`). design.md → Decisions and Risks record this; no `yarn codegen` is required.
- **Standalone vs in-session create.** Confirmed the standalone create is `POST /api/v1/agent-conversations` (no parent, no body) returning `mode: standalone` with null `studySessionId`/`certificationId`, distinct from `sessionAgentConversationsControllerCreateInSession` (`POST /api/v1/sessions/:id/agent-conversations`, session-scoped, cert-scoped tools). proposal/design/spec are consistent on this.
- **No tool cards / no citations.** Verified against the real standalone tool set: SPEC AgentModule says standalone has "no cert-scoped tools"; `agent.service.runTurn` only yields raw SDK parts plus `error`, and with an empty tool set no `tool-result`/`job-event` is produced. The artboard's own subtitle says "No tool cards". spec.md has a dedicated requirement asserting no `ToolCard*`/citation rendering, and tasks 2.2/3.2 exclude the tool-card layer. Fully reconciled.
- **TTL.** All four artifacts use the sliding **4-hour** inactivity TTL (per SPEC Agent Context / AgentModule and the `AgentChat.html` artboard), client-derived from `lastActivityAt`. The generic CLI context's "7-day" figure was correctly overridden by the SPEC/contract; no contradiction remains across artifacts.
- **No list endpoint.** Confirmed the backend exposes no standalone-conversation list endpoint; spec.md and design.md explicitly constrain the page to a single active conversation (create / detail / stream), so no task depends on a nonexistent endpoint.
- **Test boundaries ↔ tasks.** design.md Test Boundaries names every collaborator the tests touch (the three HTTP-stubbed endpoints, the injected `fetchImpl` for SSE, auth/CSRF via `StreamTurnOptions`); tasks 0.1 and 3.1 use exactly these boundaries and invent none.

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved. Every spec scenario maps to acceptance/component work in tasks.md, the design resolves the SSE-consumption, TTL-derivation, tool-card-exclusion, and reuse decisions, and all consumed endpoints are pinned to committed Orval methods (no codegen, no backend change). The change is ready for `/opsx:apply`.

## Deferred Non-Blocking Notes

- Exact inactivity-warning threshold (artboard illustrates ~12 min) is intentionally left to implementation as a named constant against the 4h window — recorded in design.md → Open Questions and tasks 5.3.
- Whether a client-side optimistic TTL reset is sufficient versus re-fetching `agentControllerDetail` for a fresh `lastActivityAt` is recorded in design.md → Decisions/Risks; optimistic reset is the default, with detail re-fetch available as a fallback. Non-blocking.
