## Why

The standalone Ask-AI page shows a persistent **"Expires in 0m"** pill on a fresh conversation (observed 2026-06-30). Standalone agent conversations have a sliding 4-hour inactivity TTL, so a new chat should read ~4h, not 0m. The design (`openspec/design/AgentChat.html`) surfaces the TTL as a **near-expiry banner**, not a permanent pill. The current display is misleading and visually off-spec.

## What Changes

- Compute and show the **real remaining TTL** for the standalone conversation (from `lastActivityAt` + the 4-hour window), resetting on activity.
- Replace the always-on "Expires in 0m" pill with a **banner shown only when near expiry** (threshold from design), matching `AgentChat.html`.
- Add tests covering: fresh chat (no banner / full TTL), near-expiry (banner shows correct remaining time), and TTL reset on a new message.

## Capabilities

### Modified Capabilities
- `web-agent-chat`: standalone conversation TTL is computed from real activity and surfaced as a near-expiry banner.

## Impact

- **Code**: `apps/web/app/` agent-chat page/header + a TTL composable/helper; vitest tests. Confirm the API exposes `lastActivityAt`/expiry (the agent conversation already persists activity); no new endpoint expected — if a field is missing, flag rather than add backend scope here.
- **No new entity/migration.**
- **Dependencies**: archived `web-agent-chat`, `agent`.
