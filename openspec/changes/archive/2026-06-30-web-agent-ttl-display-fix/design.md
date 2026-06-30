## Context

The standalone "Ask AI" page (`apps/web/app/pages/agent.vue`) was shipped by the archived `web-agent-chat` change. It already derives a client-side 4-hour inactivity TTL from the conversation's `lastActivityAt`, but the header renders a **persistent TTL pill** (`data-testid="agent-ttl-chip"`) that can read a misleading "Expires in 0m" on a fresh conversation. The design (`openspec/design/AgentChat.html`) surfaces the TTL as a **near-expiry banner** (the orange `ExpiryBanner`), not an always-on pill. This is a frontend-only fidelity/bug fix; no backend, DTO, entity, migration, or `yarn codegen` change is involved.

## Blocker check — activity timestamp availability

Confirmed present end-to-end, so no backend scope is needed:

- Backend DTO exposes it: `apps/api/src/agent/agent.controller.ts:50` (`lastActivityAt!: string`), populated at `:216` from `conversation.lastActivityAt.toISOString()` and refreshed per turn at `apps/api/src/agent/agent.service.ts:263`.
- Orval client type exposes it: `apps/web/src/api/model/agentConversationResponseDto.ts:19` (`lastActivityAt: string`).

The field name is **`lastActivityAt`** (ISO-8601 string).

## Current code (what renders the pill)

- `apps/web/app/pages/agent.vue`
  - Header pill `data-testid="agent-ttl-chip"` (lines ~58-61) rendered unconditionally with `ttlChipText`.
  - `ttlChipText` (lines ~20-27) returns `Expires in ${formatted}` when `ttlWarning.value || remaining === 0`, else `Resets after 4h idle · ${formatted} remaining` — this is the source of the misleading "Expires in 0m" copy.
  - Warning banner `data-testid="agent-expiry-banner"` (lines ~73-79), already gated on `ttlWarning`, with copy "This conversation resets in {N} minutes due to inactivity. Send a message to reset the timer."
  - `now` is re-read every 60s via `setInterval` (lines ~11-15) so the indicator ticks down.
- `apps/web/app/composables/agentChatTtl.ts`
  - `TTL_WINDOW_MS = 4h`, `TTL_WARNING_THRESHOLD_MS = 15m` — the single source for the window and near-expiry threshold.
  - `ttlRemainingMs(lastActivityAt, now)` = `max(0, lastActivity + 4h - now)`; returns the full window when `lastActivityAt` is `null` or unparseable.
  - `isTtlWarning(remainingMs)` = `remainingMs > 0 && remainingMs <= 15m`.
  - `formatTtlRemaining(remainingMs)` → `Xh Ym` / `Ym`.
- `apps/web/app/composables/useStandaloneAgentChat.ts`
  - Owns `lastActivityAt` ref: seeded from `created.data.lastActivityAt` on create (line ~35), set to `new Date().toISOString()` on send (line ~62), cleared on `newChat` (line ~74).

## Remaining-TTL computation and threshold

- Remaining = `lastActivityAt + TTL_WINDOW_MS - now`, clamped at 0 (`ttlRemainingMs`).
- A missing/not-yet-loaded `lastActivityAt` is treated as a full window, so a fresh chat never reads as expired.
- Near-expiry threshold = `TTL_WARNING_THRESHOLD_MS` (15 minutes). The artboard's "12 min idle, banner visible" example sits within this threshold.
- Sending a message refreshes `lastActivityAt`, which recomputes remaining back to ~full window and drops `isTtlWarning` to `false`, hiding the banner.

## Decision — fix approach

Match the artboard's near-expiry banner treatment and remove the misleading always-on pill copy:

1. The header TTL indicator MUST NOT show a false "Expires in 0m" state. The fresh/healthy state shows the calm remaining-time indicator (artboard "Active conversation" header: "Resets after 4h idle · {remaining} remaining"); it never renders the red "Expires in …" variant while the conversation is healthy. Remove the `remaining === 0` / warning branch that produces "Expires in 0m" as a persistent pill.
2. The prominent TTL warning is the **near-expiry banner** (`ExpiryBanner`), shown only when `isTtlWarning(remaining)` is true, with the remaining whole minutes in its copy.
3. Keep `agentChatTtl.ts` as the single source of the 4h window and 15m threshold; the page computes `ttlRemaining` / `ttlWarning` / banner minutes from it against the ticking `now`.

## Visual Design

Visual source of truth: `openspec/design/AgentChat.html` (read in place from the shared design mirror; `DesignSync` is not available in this environment).

| Artboard element | Maps to |
|---|---|
| `ChatHeader` calm TTL chip ("Resets after 4h idle · 3h 42m remaining") on the active artboard | `agent.vue` header indicator (healthy state) |
| `ExpiryBanner` ("This conversation resets in **12 minutes** due to inactivity. Send a message to reset the timer.") on the "Expiry warning" artboard | `agent.vue` `agent-expiry-banner`, gated on `isTtlWarning` |
| Empty-state artboard (`ttl={null}`, no banner) | fresh chat: full remaining TTL, no banner |

## Risks / Non-Goals

- **Non-goal:** any backend, DTO, entity, migration, worker, or `yarn codegen` change. The sliding TTL and its cleanup are owned by the archived `agent` change.
- **Non-goal:** a conversation history/list view — no list endpoint exists; the page works with a single active conversation only.
- **Risk:** clock skew between client `now` and server `lastActivityAt` can shift the displayed remaining time by up to the 60s tick interval; acceptable for an idle-TTL hint.
