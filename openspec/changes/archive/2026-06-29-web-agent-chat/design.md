## Context

The `agent` backend (archived) ships both agent modes. The **in-session** mode is already wired into `apps/web` by `web-session-view` (the `AgentPanel`, `useAgentTurnStream` SSE composable, `agentMessages` hydration helper, `AgentBubble`, and the `agent/ToolCard*` registry). This change adds the **standalone** mode page (`/agent`, "Ask AI"), which is deliberately simpler: a general-knowledge tutor with no certification/session context and no cert-scoped tools.

The standalone backend contract is already committed in the Orval client (`apps/web/src/api/agent/`), so no backend edits and no `yarn codegen` are needed. The page consumes three endpoints; the SSE turn is consumed via a `fetch` reader (not the generated `agentControllerStreamTurn` stub) because SSE-over-POST is not an `EventSource`.

Constraints: TypeScript strict (no `any`), absolute path-alias imports, Biome, outside-in TDD (Playwright e2e first, then component tests), co-located `*.spec.ts`, ≥80% coverage. No backend/DTO/entity/migration/worker changes.

## Goals / Non-Goals

**Goals:**
- A standalone "Ask AI" page in the `web-foundation` app shell that creates a standalone conversation, hydrates its messages, and streams turns over SSE.
- Maximum reuse of the `web-session-view` agent primitives: `useAgentTurnStream`, `agentMessages` (`hydrateAgentMessages` / `extractMessageText`), and the user/assistant bubble pattern.
- Empty state with suggestion chips, "New chat" reset, streaming cursor, error rendering, and a client-derived 4-hour inactivity-TTL indicator + warning banner.

**Non-Goals:**
- Any tool-result rendering or citation chips. The standalone agent exposes no cert-scoped tools, so the stream only carries `text-delta`/`error`; the `ToolCard*` components and `toolCardRegistry` are not used here.
- The in-session agent panel (owned by `web-session-view`).
- Any backend change, DTO change, new entity/migration, or Orval regeneration. The standalone-TTL cleanup cron is owned by the archived `agent` change.
- A conversation history/list view — no list endpoint exists on the backend; the page works with a single active conversation only.

## Visual Design

Visual source of truth: the committed shared design mirror under `openspec/design/`. The `DesignSync` connector is **not available** in this environment, so the canonical artboard is read in place from the shared mirror and is **not** copied into this change. It loads the sibling `app-shell.jsx` and the `_ds/` token bundle.

| Artboard / screen | Maps to |
|---|---|
| `../../design/AgentChat.html` — `ChatPage` + `AppSidebar` (`active="Ask AI"`) | `/agent` page shell inside the `web-foundation` app shell |
| `../../design/AgentChat.html` — `ChatHeader` (avatar, "Study assistant", "General knowledge · no session context", TTL chip, "New chat") | Chat header component |
| `../../design/AgentChat.html` — `UserBubble` / `AssistantBubble` (+ streaming `.cursor`) | Reused user/assistant bubble pattern from `web-session-view` `AgentBubble` |
| `../../design/AgentChat.html` — `InputBar` (textarea, send, "general knowledge only · no exam-specific tools attached" footer) | Chat input bar |
| `../../design/AgentChat.html` — `EmptyState` (intro + `SUGGESTIONS` chips) | New-chat empty state |
| `../../design/AgentChat.html` — `ExpiryBanner` + header expired TTL chip | Inactivity-warning banner + header TTL indicator |

**Layout to implement:** the standard `web-foundation` app shell (`Shell.AppSidebar active="Ask AI"`) with a single full-height column: header, scrolling message list (or empty state), and a pinned input bar. Bubbles follow the established `AgentBubble` treatment (user = surface + secondary text; assistant = `primary` background + white text) rather than introducing new bubble components.

### Design ↔ contract reconciliation

The behavioural spec + the real backend contract win wherever the artboard diverges. The artboard was drawn ahead of the API.

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Artboard shows **no tool cards** ("No tool cards" in the canvas subtitle) | The standalone agent's tool set is **empty** — SPEC AgentModule: standalone has "no cert-scoped tools"; the stream carries only `text-delta`/`error` | Confirmed aligned: render text bubbles + errors only. Do not import `ToolCard*`/`toolCardRegistry`. This also confirms the **"no citations"** reconciliation — citations only exist on in-session tool output, which is absent here. |
| Header/footer copy: "General knowledge · no session context" / "Answers from general knowledge only · no exam-specific tools attached" | Matches SPEC ("general-knowledge tutor … no inline source citations here") | Keep the copy; it is the user-facing disclosure that no cert grounding is implied. |
| TTL chip shows exact remaining time ("3h 42m remaining"), and "Expires in 12 min" / expiry banner "resets in 12 minutes" | Contract returns `lastActivityAt` (ISO) only; TTL is a fixed sliding **4 hours** enforced server-side. No countdown field is returned | Derive remaining time client-side as `lastActivityAt + 4h − now`; refresh on each sent message (server bumps `lastActivityAt`, re-fetch or optimistically reset). Treat the exact figures in the artboard as illustrative. |
| "New chat" button in the header | No reset endpoint — but `POST /api/v1/agent-conversations` always creates a fresh standalone conversation | "New chat" clears the view and calls `agentControllerCreateStandalone` again for a new `id`. |
| Empty-state `SUGGESTIONS` are generic CS questions (TCP/UDP, TLS, CAP) | No backend suggestion source exists for standalone chat | Ship static suggestion chips; activating one sends it as the first user turn. Not presented as backend data. |
| Multi-paragraph `AssistantBubble` (`paragraphs[]`) | The stream delivers a single growing text string via `text-delta`; persisted content is `AgentMessageContent` (string or parts) | Accumulate `text-delta` into one text body; render with `whitespace-pre-wrap` (as `AgentBubble` already does). No paragraph-array contract. |
| Artboard `InputBar` is a multi-line `textarea`; `web-session-view` input is a single-line `<input>` | Cosmetic only | Use a textarea-style input matching the artboard; Enter submits, send disabled while streaming. |

## Test Boundaries

This is a frontend-only change; "acceptance test" is the Playwright e2e against the running web app, and "unit tests" are component/composable specs (Vitest + `@nuxt/test-utils`). The API is stubbed at the HTTP boundary in both — no real Postgres/Redis is involved on the web side.

| Dependency | In acceptance test (e2e) | In unit/component tests |
|---|---|---|
| `POST /api/v1/agent-conversations` (create standalone) | HTTP stub returning `{ data: { id, mode: 'standalone', studySessionId: null, certificationId: null, lastActivityAt, createdAt }, relationships }` | mocked Orval method / fetch stub |
| `GET /api/v1/agent-conversations/:id?include=messages` (hydrate) | HTTP stub returning ordered `relationships.messages.data` | mocked Orval method / fetch stub |
| `POST /api/v1/agent-conversations/:id/messages` (SSE turn) | HTTP stub emitting an SSE body: `text-delta` events then `data: [DONE]`; an `error`-event variant | `fetchImpl` injected into `useAgentTurnStream` returning a scripted `ReadableStream` |
| Auth/CSRF (Pinia auth store, CSRF cookie) | real `web-foundation` auth flow (logged-in fixture) | `accessToken`/`csrfToken` passed via `StreamTurnOptions` |
| Backend DB / Redis / LLM | not involved (web change) — stubbed at HTTP | not involved |

## Decisions

- **Reuse `useAgentTurnStream` and `agentMessages` as-is.** They already implement the exact SSE wire format (`data:` framing, `[DONE]`, `text`/`textDelta` dual key, error fallback) and message hydration. Standalone chat needs a strict subset (no `tool-result`/`job-event` handling). Alternative — a bespoke standalone composable — was rejected as duplication; the shared composable is mode-agnostic.
- **Consume SSE via `fetch` reader, not the Orval `agentControllerStreamTurn` stub.** The generated stub posts no body and types the response as `void`; SSE-over-POST cannot use `EventSource`. The `useAgentTurnStream` fetch-reader is the established pattern. The generated `agentControllerCreateStandalone` and `agentControllerDetail` query/mutation composables are used directly for the non-streaming calls.
- **Do not import the tool-card layer.** `toolCardRegistry`/`AgentToolResult`/`ToolCard*` are in-session-only. Keeping them out of the standalone page is both correct (no tools run) and keeps the bundle/markup minimal — matching the artboard's "No tool cards".
- **Derive TTL client-side from `lastActivityAt`.** No countdown is on the wire and no list endpoint exists; the page is single-conversation. Remaining = `lastActivityAt + 4h − now`, recomputed on send. Alternative — polling `agentControllerDetail` for a fresh `lastActivityAt` — is available if optimistic reset proves insufficient, but optimistic reset on send is preferred to avoid extra round-trips.
- **Standard app shell, not the minimal-chrome session layout.** Unlike the immersive session view, standalone chat is a normal navigable page; it uses `Shell.AppSidebar active="Ask AI"` per the artboard.

## Risks / Trade-offs

- [The committed `agentControllerStreamTurn` Orval stub is unusable for SSE] → Intentionally bypass it with the `useAgentTurnStream` fetch reader; document why so a future reader does not "fix" the page to call the stub.
- [Client-derived TTL can drift from the server's actual sliding window] → The indicator is advisory; the server is authoritative. On reconnect/hydrate the page reads the real `lastActivityAt`. Worst case the banner is shown slightly early/late, never causing data loss.
- [No conversation-list endpoint] → The page intentionally keeps a single active conversation and "New chat" replaces it; prior standalone conversations are not browsable (out of scope, matches backend capability).
- [SSE `text-delta` key drift between live SDK (`text`) and fixtures (`textDelta`)] → Already handled by `extractTextDelta`; reuse it rather than re-parsing.

## Open Questions

- Should "New chat" be confirmed when the current conversation has unsent context? Default: no confirmation (cheap to recreate; matches the artboard's single-tap "New chat"). Revisit only if user testing shows accidental resets.
- Exact warning threshold for the inactivity banner (artboard illustrates ~12 min). Default to a small fixed threshold (e.g. 15 min) computed against the 4h window; tune during implementation.
