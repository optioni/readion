## Reviewed Artifacts

- proposal.md
- specs/job-progress-events/spec.md
- specs/certification-setup/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | design.md | Decision referenced a named SSE event (`event: job-event`), but the web consumer `useReadionEventSource` only listens on the default `message` event (like the agent SSE), so a named event would be silently dropped. | Replaced the wording with an explicit decision: unnamed `data: <json>\n\n` frames consumed as `message`, keeping `useReadionEventSource` unchanged. | design.md → Decisions |
| CRITICAL | design.md, tasks.md | `EventSource` auto-reconnects when the server closes the stream on the terminal event, causing a slow reconnect loop; no artifact required the client to stop. | Added the risk + mitigation (client must `close()` on terminal) to design, and made task 3.2 call the composable's `close()` on any terminal payload. | design.md → Risks; tasks.md → 3.2 |
| WARNING | tasks.md | job-progress-events scenarios for the heartbeat, max-duration close, and QueueEvents subscription release had no corresponding test/impl work. | Added RED task 2.2 covering heartbeat, max-duration close, and subscription cleanup with injectable/short timing; noted in GREEN 2.4 that interval/max-duration are injectable/config-driven. | tasks.md → 2.2, 2.4 (group renumbered) |
| SUGGESTION | tasks.md | The SSE response headers from the spec (`text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`) were only implied. | Spelled the header set out in the route GREEN task. | tasks.md → 2.5 |

## No Remaining Implementation-Blocking Gaps

All capabilities named in proposal.md have matching spec files (`job-progress-events` ADDED as a new capability; `certification-setup` extended with an ADDED requirement — the existing status-GET behavior and response shape are unchanged, so ADDED, not MODIFIED, is correct). Every spec scenario now has corresponding acceptance-test work in tasks.md, the test boundaries in design.md match what the tasks drive (real Postgres/Redis via Testcontainers, worker processor not booted, queue driven directly; e2e via Playwright `route.fulfill` SSE stub), and no task invents a mock boundary design.md does not name. Outside-in ordering holds: e2e acceptance → shared contract → API (parallel) / web (parallel) → outer-loop GREEN → review → polish. No implementation-blocking gaps remain.

## Deferred Non-Blocking Notes

- Migrating mock-exam prep and session generation off polling is explicitly a non-goal (proposal.md); the `job-progress-events` contract is designed to be reused by those flows in later changes.
- Exact heartbeat interval and max stream duration are left to implementation to align with the Cloudflare/ingress idle timeouts (design.md → Open Questions); the timing is injectable so tests are not coupled to production values.
