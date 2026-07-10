## Context

Cert extraction is a long-running BullMQ job. The web wizard learns it finished by **client-side polling**: `CertSetupExtractionStep.vue` runs a vue-query `refetchInterval` (1.5s) against `GET /admin/certifications/extractions/:jobId` (`certExtractionPoll.ts`). This caused a production incident — a slow PDF extraction let the poll drain the `agent` rate-limit bucket (30/60s) and 429; a 429 leaves the query `data` undefined, so `nextRefetchInterval` kept firing, deepening the limit in a self-reinforcing loop. Two stop-gaps are already in place: `@SkipThrottle({ agent: true })` on the status GET (`cert-setup.controller.ts:192`) and a `MAX_CONSECUTIVE_FAILURES` cap in `certExtractionPoll.ts`. Both treat the symptom.

We already stream over **SSE** (no WebSockets): the agent chat sends `text/event-stream` from `agent.controller.ts` and the web consumes it via `useReadionEventSource` (`EventSource`, `withCredentials`). The agent service already bridges **BullMQ `QueueEvents`** to that stream — `AgentService.waitForMaterialJob` (`agent.service.ts:155`) opens a `QueueEvents` on the material queue, waits for `completed`/`failed`, and reconciles against `queue.getJob(...).getState()` to cover the subscribe-after-finish race. This change reuses exactly that pattern for cert extraction.

Constraints: `EventSource` cannot set an `Authorization` header, so the SSE route must ride the existing cookie auth (the agent SSE already does). API and worker already share one Redis (BullMQ). Extraction jobs are retained after completion (`removeOnComplete: { count: 1000 }`, `queue.defaults.ts`), so a late subscriber can still read the terminal state via `getJob`.

## Goals / Non-Goals

**Goals:**
- Push cert-extraction job status + terminal `fields` to the wizard over SSE instead of polling.
- Back the stream with `QueueEvents` (Redis pub/sub), emitting current state once on connect to close the subscribe-after-complete race, heartbeating to keep the connection alive, and closing on the terminal event.
- Define a small, reusable **job-progress SSE contract** (event payload keyed by BullMQ job id) in `packages/shared` so mock-exam prep and session generation can adopt it in follow-up changes.
- Remove the polling-era workarounds once extraction no longer polls: the `@SkipThrottle({ agent: true })` on the status GET and the `MAX_CONSECUTIVE_FAILURES` cap. Keep the status GET itself as an SSE fallback.

**Non-Goals:**
- Migrating mock-exam prep or session generation off polling (this change delivers extraction only; the contract is designed to be reusable).
- Introducing WebSockets (SSE suffices and matches existing infra).
- Any change to the extraction request/enqueue flow or the grounded-`fields` result shape.

This change modifies an existing admin wizard component and adds no new user-facing screens or email templates, so there is no Claude Design artboard to import — the **Visual Design** section is intentionally omitted.

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (auth/admin) | real (Testcontainers) | n/a |
| Redis / BullMQ `cert-extraction` queue + `QueueEvents` | real (Testcontainers) — the test drives the queue directly (`queue.getJob(...).moveToCompleted/moveToFailed`, or a hand-added job with a seeded `returnvalue`) to fire the `QueueEvents` signal the SSE route relays; the **worker processor is not booted** in the API harness, matching the existing cert-setup harness | n/a |
| Worker cert-extraction processor / LLM / scrapper | not booted / not involved (SSE only reads job state + `returnvalue`) | n/a |
| `JwtAuthGuard` / `RolesGuard` (cookie auth) | real — assert `200/stream` for admin, `403` for `user`, `401` unauthenticated on the SSE route | n/a |
| SSE event serialization (`data:`/`event:` framing, terminal-close decision, current-state-on-connect mapping) | asserted via the streamed response text | real (pure functions) |
| Web `EventSource` + backend | e2e: Playwright `route.fulfill` returns a `text/event-stream` body pushing a `completed` event; assert the wizard renders `fields` and issues **no** repeated status GETs | component test stubs `useReadionEventSource` |

The API acceptance test asserts the SSE **consumer** contract: on connect the route emits the job's current state; when the queue signals `completed`/`failed` the route writes that event and closes; unknown `jobId` → the stream emits a terminal error (or the route 404s before upgrading). It does not exercise the real extraction pipeline.

## Decisions

- **`QueueEvents` over polling Redis in a loop.** Reuse `AgentService.waitForMaterialJob`'s proven pattern: open a `QueueEvents` bound to the queue's connection, subscribe to `completed`/`failed`, and reconcile once against `getJob().getState()` for the race. *Alternative:* a per-connection `setInterval` calling `getJob` — rejected, it just moves the poll server-side and reintroduces the same waste.
- **Cookie auth, not a query-string token.** `EventSource` (`withCredentials: true`) already carries the auth cookie for the agent SSE; the route keeps `@Roles('admin')` unchanged. *Alternative:* a short-lived signed token in the query string — rejected as unnecessary complexity given cookie auth is already proven end-to-end through Cloudflare + ingress for the agent stream.
- **Emit current state once on connect, then relay.** On connect, read `getState()` (+ `returnvalue.fields` if terminal) and emit it immediately, then attach `QueueEvents` listeners. Covers the job finishing before the browser subscribes. *Alternative:* rely on events only — rejected, races on fast jobs.
- **Define the reusable contract now, wire extraction only.** Add a shared job-progress payload type `{ jobId, state, result? }` in `packages/shared` and route the extraction stream through it, but do not touch mock-exam/session flows. *Alternative:* ship an extraction-shaped payload and generalize later — rejected; the payload is small and generalizing the shape now avoids a breaking rename when the next flow adopts it.
- **Unnamed `data:` frames, consumed as `message`.** Each event is written as a bare `data: <json>\n\n` frame with **no `event:` line**, exactly like the agent SSE. This is deliberate: `useReadionEventSource` only listens on the default `message` event, so a named SSE event would be silently dropped. Keeping the extraction stream on default `message` frames lets the web composable consume it **unchanged**. *Alternative:* named events (`event: job-event`) — rejected, it would require extending `useReadionEventSource` for no benefit.
- **Migrate the re-verification flow too (discovered during apply).** `useCertReverifyFlow` runs the same `cert-extraction` job and polled the same status GET. Removing `@SkipThrottle({ agent: true })` would re-expose it to the rate-limit incident, so it moves to SSE as well (it is cert extraction, not one of the deferred flows). This required `useReadionEventSource` to accept a **reactive path** (`MaybeRefOrGetter<string>`), since the reverify job id arrives asynchronously — an empty resolved path opens nothing and the stream opens once the id is known. Static string paths (the wizard) still open immediately. *Alternative:* keep the throttle-skip and defer reverify — rejected, it leaves a known regression in a flow that hits the same endpoint.
- **Keep the status GET as an SSE fallback; drop only the workarounds.** Retain `GET .../extractions/:jobId` for initial paint and for proxies/browsers that drop SSE, but remove `@SkipThrottle({ agent: true })` (a single held SSE stream never touches the per-request bucket) and the `MAX_CONSECUTIVE_FAILURES` cap (the fallback fires at most once, not on an interval). *Alternative:* delete the GET entirely — rejected; it is the graceful-degradation path.
- **Heartbeat + max-duration timeout.** Send a periodic SSE comment (`: keepalive`) to defeat idle-connection reaping, and close the stream after a max duration so a stuck/never-terminating job cannot hold a connection forever; the client falls back to the GET.
- **Disable proxy buffering explicitly.** Set `Cache-Control: no-cache`, `Connection: keep-alive`, and `X-Accel-Buffering: no` (matching/extending the agent SSE headers) so nginx-style ingress does not buffer the stream. Re-confirm the admin path streams unbuffered through Cloudflare + ingress (the agent route already does).

## Risks / Trade-offs

- **Subscribe-after-complete race** → emit current state on connect before attaching listeners (reconcile pattern already in `waitForMaterialJob`).
- **Job evicted before a late subscriber reads it** → retention is `removeOnComplete: { count: 1000 }`; extraction volume is low, so terminal state stays readable well beyond a wizard session. If volume grows, switch to an age-based retention on this queue.
- **Proxy buffers `text/event-stream` on the admin path** → explicit no-buffer headers + re-confirm end-to-end; the GET fallback covers any environment that still buffers.
- **`QueueEvents` connection leak** → one `QueueEvents` per connection opened on connect and closed in a `finally`/on-disconnect handler, mirroring `waitForMaterialJob`'s `queueEvents.close()`.
- **Idle SSE reaped by an intermediary** → heartbeat comment; client reconnect + GET fallback.
- **`EventSource` auto-reconnects after the server closes on the terminal event** → the browser re-opens the route, gets the retained terminal state on connect, and closes again — a slow reconnect loop. The web consumer MUST call `close()` on receiving a terminal (`completed`/`failed`) payload so the stream is not re-opened. This is the client-side counterpart to the server closing on terminal.
- **`EventSource` auto-reconnects after a *max-duration* (non-terminal) close** → the browser re-opens the events route, the server re-reads and re-emits the job's current state, and re-arms the timers. This is accepted degradation, not a distinct GET fallback: it is bounded to one held request per max-duration window (nothing like the removed 1.5s poll) and it eventually delivers the terminal result once the job finishes. Extraction jobs are bounded by worker attempts and reach `completed`/`failed`, so this path is a safety valve, not a normal case.

## Open Questions

- Should the `QueueEvents` instance be shared per-queue (one long-lived subscriber fanning out to connections) or per-connection as in `waitForMaterialJob`? Per-connection is simplest and matches precedent; revisit only if connection churn makes it costly.
- Exact heartbeat interval and max stream duration — pick values consistent with the agent SSE / ingress idle timeouts (resolve against the Cloudflare/ingress config during implementation).
- Should the removed `MAX_CONSECUTIVE_FAILURES` logic in `certExtractionPoll.ts` be deleted or left as dead-code-free fallback? Decision leans delete; the fallback GET fires once, not on a loop.
