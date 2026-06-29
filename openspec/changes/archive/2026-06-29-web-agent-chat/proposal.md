## Why

The `agent` backend ships a **standalone** general-knowledge tutor (a dedicated `AgentConversation` with `mode: standalone`, no certification/session context, no cert-scoped tools, and a sliding 4-hour inactivity TTL), but `apps/web` has no page that exposes it. Today the only agent UI is the **in-session** panel built by `web-session-view`, which is bound to a `StudySession`. This change adds the standalone "Ask AI" chat page so a learner can ask free-form questions outside of a study session — the last Phase 10 frontend surface for the agent.

## What Changes

- Add a standalone agent chat page at `apps/web` route `/agent` (sidebar "Ask AI"), rendered in the `web-foundation` app shell.
- On entry, create a standalone conversation via `POST /api/v1/agent-conversations` (`agentControllerCreateStandalone`) and hydrate any existing messages via `GET /api/v1/agent-conversations/:id?include=messages` (`agentControllerDetail`).
- Stream assistant turns over SSE via `POST /api/v1/agent-conversations/:id/messages`, reusing the `web-session-view` `useAgentTurnStream` fetch-reader composable and the `agentMessages` hydration helper.
- Render the conversation with reused `AgentBubble`-style user/assistant bubbles. **No tool-result cards and no citation chips** — the standalone agent has no cert-scoped tools, so the stream only carries `text-delta` and `error` events. The `web-session-view` `ToolCard*` components and `toolCardRegistry` are intentionally **not** used here.
- Empty state for a new chat (intro + suggestion chips that seed the first message), a "New chat" affordance (start a fresh standalone conversation), an input bar with send, and a streaming cursor while a turn is in flight.
- Surface the sliding 4-hour inactivity TTL in the UI (header "resets after 4h idle" indicator and an inactivity-warning banner), derived client-side from the conversation's `lastActivityAt`.
- E2E (Playgright) + component tests covering: create-on-enter, send/stream a turn, empty-state suggestion seeding, new-chat reset, and error rendering.

No backend changes. No new entities or migrations. No `yarn codegen` — every consumed endpoint already exists in the committed Orval client (`apps/web/src/api/agent/`).

## Capabilities

### New Capabilities
- `web-agent-chat`: The standalone agent chat page — conversation lifecycle (create / hydrate / new-chat), SSE turn streaming, message rendering without tool cards or citations, empty/suggestion state, and the 4-hour inactivity-TTL surfacing.

### Modified Capabilities
<!-- None. This is a net-new frontend page; it reuses but does not change the behaviour of the archived `web-session-view` / `web-foundation` / `agent` capabilities. -->

## Impact

- **apps/web** — new page `app/pages/agent.vue`, new components for the standalone chat surface, reuse of `app/composables/useAgentTurnStream.ts` and `app/composables/agentMessages.ts`, the `web-foundation` app shell, and Pinia auth/CSRF wiring. New Playwright e2e spec under `apps/web/e2e/` and co-located component specs.
- **Consumed API (already in the Orval client, no codegen):** `agentControllerCreateStandalone`, `agentControllerDetail`, and the raw SSE `POST /api/v1/agent-conversations/:id/messages` (consumed via `fetch` reader, not the generated `agentControllerStreamTurn` stub, since SSE-over-POST is not an `EventSource`).
- **No backend, DTO, entity, migration, or worker changes.** The standalone-conversation TTL cleanup cron is owned by the archived `agent` change; this page only reads/refreshes `lastActivityAt`.
