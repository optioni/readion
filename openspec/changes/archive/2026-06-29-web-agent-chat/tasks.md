## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the Playwright e2e harness at `apps/web/e2e/agent-chat.e2e.ts` (per the repo `*.e2e.ts` convention) for `/agent` with a logged-in `web-foundation` auth fixture and HTTP stubs for the three consumed endpoints (create standalone, detail+include=messages, SSE turn) per design.md Test Boundaries — including an SSE stub that emits `text-delta` events then `data: [DONE]`, and an `error`-event variant
- [x] 0.2 Write failing acceptance test: user opens `/agent` (empty state with suggestions) → activates a suggestion → user bubble appears → assistant bubble streams token-by-token with a cursor → cursor clears on `[DONE]`; assert no tool cards and no citation chips render
- [x] 0.3 Confirm it fails for the right reason (page/route absent), not a harness/setup error

## 1. Standalone chat page route and shell (`app/pages/agent.vue`)

- [x] 1.1 RED: Component test — mounting the page in the `web-foundation` app shell renders `Shell.AppSidebar` with "Ask AI" active and issues `agentControllerCreateStandalone` exactly once on load, storing `data.id` (assert `mode: 'standalone'`, `studySessionId`/`certificationId` null)
- [x] 1.2 GREEN: Implement `agent.vue` to the `../../design/AgentChat.html` `ChatPage`/`AppSidebar` artboard — create-on-mount via the Orval `useAgentControllerCreateStandalone`, hold the conversation id, render header + (empty state | message list) + input bar
- [x] 1.3 REFACTOR: Extract page state (conversation id, messages, streaming flag) into a small composable to keep the page declarative

## 2. Message hydration and bubble rendering (reuse `agentMessages` + `AgentBubble`)

- [x] 2.1 RED: Component test — given `agentControllerDetail` returns ordered `relationships.messages.data`, `hydrateAgentMessages` output renders user/assistant text bubbles in order and skips `tool`/`system` rows; empty messages → empty state
- [x] 2.2 GREEN: Wire `agentControllerDetail` (with `include=messages`) hydration into the page and render bubbles using the established `AgentBubble` user/assistant treatment (no `AgentToolResult`, no citation chips)
- [x] 2.3 REFACTOR: Confirm reuse of `hydrateAgentMessages`/`extractMessageText` rather than re-parsing `AgentMessageContent`

## 3. SSE turn streaming (reuse `useAgentTurnStream`)

- [x] 3.1 RED: Component/composable test with an injected `fetchImpl` returning a scripted `ReadableStream` — submitting a message appends a user bubble immediately, appends an assistant bubble that grows per `text-delta`, shows a streaming cursor until `[DONE]`, disables send while streaming; whitespace-only input sends nothing
- [x] 3.2 GREEN: Implement `send()` using `useAgentTurnStream().streamTurn(id, content, onEvent)` — handle only `text-delta` (via `extractTextDelta`) and `error`; ignore any non-text events (no tool/job handling in standalone)
- [x] 3.3 RED: Test the `error` path — an `error` SSE event (and a non-OK response) renders the error text on the in-flight assistant message and re-enables send
- [x] 3.4 GREEN: Implement error rendering on the assistant message; REFACTOR the event handler to a minimal standalone subset

## 4. Empty state, suggestions, and "New chat"

- [x] 4.1 RED: Component test — empty state shows intro + suggestion chips per the `EmptyState` artboard; activating a chip submits its text as the first turn and replaces the empty state with the message list
- [x] 4.2 GREEN: Implement the empty state and suggestion seeding; implement "New chat" to clear messages and call `agentControllerCreateStandalone` for a fresh id, returning to the empty state
- [x] 4.3 REFACTOR: Centralise the "general knowledge only · no exam-specific tools" disclosure copy (header subtitle + input footer) from the artboard

## 5. Inactivity TTL surfacing (client-derived from `lastActivityAt`)

- [x] 5.1 RED: Unit test for the TTL helper — remaining = `lastActivityAt + 4h − now`; below the warning threshold the banner should show; sending bumps `lastActivityAt` and recomputes
- [x] 5.2 GREEN: Implement the header TTL indicator (`ChatHeader` chip) and the `ExpiryBanner` warning, derived from `lastActivityAt`; reset on send (optimistic), treating exact artboard figures as illustrative
- [x] 5.3 REFACTOR: Keep the 4h window and warning threshold as named constants; confirm no dependency on any conversation-list endpoint

## 6. Acceptance Test — Outer Loop GREEN

- [x] 6.1 Confirm the acceptance test passes end-to-end
- [x] 6.2 Verify `apps/web` starts in the local environment (smoke test) — boot the app and confirm `/agent` loads with no startup/config errors
- [x] 6.3 REFACTOR: Clean up test setup, SSE stubs, and fixtures

## 7. Change Review — Subagent Verification

- [x] 7.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 7.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 8. Polish

- [x] 8.1 Run linter and fix all errors (`yarn lint`)
- [x] 8.2 Run formatter and apply fixes (`yarn format`)
- [x] 8.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`)
- [x] 8.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace apps/web test:coverage`)
