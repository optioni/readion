## Why

Long-running background jobs report progress to the browser by **client-side polling**. The cert-setup wizard polls `GET /admin/certifications/extractions/:jobId` every 1.5s (`certExtractionPoll.ts`), and the same pattern drives mock-exam "preparing" (`useMockExamAttempt.ts`) and session generation. This is wasteful (dozens of requests per job) and fragile: it just caused a production incident — a PDF extraction ran long enough that the poll drained the `agent` rate-limit bucket (30/60s) and 429'd, and because a 429 leaves the query with no data, the poll kept firing through the errors in a self-reinforcing loop. A stop-gap fix (skip the `agent` throttle on the status GET + cap consecutive poll failures) is already in place, but it treats the symptom.

We do **not** have WebSockets — the agent chat streams over **SSE** (`text/event-stream` in `agent.controller.ts`, consumed by `useReadionEventSource` / `EventSource` on the web). SSE plus the Redis/BullMQ we already run is exactly the machinery needed to **push** job progress instead of polling for it: a single held connection, an immediate terminal event, and no per-request rate-limit exposure. This change migrates cert extraction from polling to server-pushed SSE and establishes a reusable job-progress contract the other polling flows can adopt next.

## What Changes

- Add an SSE endpoint, `GET /admin/certifications/extractions/:jobId/events`, that streams the extraction job's status and terminal result (the grounded `fields`) as Server-Sent Events, then closes on `completed`/`failed`.
- Back the stream with BullMQ **`QueueEvents`** (Redis) so the API is notified of worker completion instead of polling Redis in a loop. On connect, emit the **current** job state once (to cover the subscribe-after-complete race), then relay subsequent events.
- Web: replace the vue-query `refetchInterval` polling in `CertSetupExtractionStep.vue` with `useReadionEventSource` consuming the new stream; keep a single `GET` status call as a fallback for the initial paint and for proxies/browsers that drop SSE.
- Define a small, reusable **job-progress SSE contract** (event names + payload shape keyed by BullMQ job id) so mock-exam prep and session generation can move off polling in follow-up changes — this change delivers extraction only.
- Once extraction no longer polls, retire the `@SkipThrottle({ agent: true })` workaround on the status GET and the consecutive-failure cap in `certExtractionPoll.ts` (or keep the GET purely as the SSE fallback).

Non-goals: migrating every polling flow in one change (extraction only here); introducing WebSockets (SSE suffices and matches existing infra); any change to the extraction result/grounding contract itself.

## Capabilities

### New Capabilities
- `job-progress-events`: a server-pushed SSE stream for background (BullMQ) job status and terminal result, replacing client polling for long-running admin/user jobs. Delivered first for certification extraction; contract is reusable for mock-exam prep and session generation.

### Modified Capabilities
- `certification-setup` (extraction status delivery): how the wizard learns an extraction finished changes from client polling to an SSE push. The extraction request/enqueue flow and the grounded-fields result shape are unchanged.

## Impact

- **API** (`apps/api`): new SSE controller/route; `QueueEvents` wiring in the cert-extraction (or a shared `job-events`) module; SSE lifecycle handling — emit-current-state-on-connect, heartbeat/keep-alive, close on terminal state, and a max-duration timeout. Auth: the SSE route keeps `@Roles('admin')`; `EventSource` cannot send an `Authorization` header, so it must ride the **existing cookie auth** (the agent SSE already relies on this, so there is precedent).
- **Worker** (`apps/worker`): no logic change if the API subscribes via `QueueEvents`; verify jobs retain their return value / TTL long enough for a late subscriber to still read the terminal state.
- **Web** (`apps/web`): `CertSetupExtractionStep.vue` swaps polling for `useReadionEventSource`; add reconnect + single-GET fallback; the `certExtractionPoll` composable is reduced to (or kept only for) the fallback path.
- **Infra**: `QueueEvents` adds Redis pub/sub load and requires API and worker to share the same Redis (already the case). The ingress/reverse proxy must not buffer `text/event-stream` — the agent chat already streams through Cloudflare + ingress, so the path is known-good, but this must be re-confirmed for the admin route.
- **Rate limiting**: an open SSE stream is a single held request, so it does not touch the per-request throttle buckets — the `agent`-skip workaround becomes unnecessary.
- **Tests**: e2e that the wizard renders the extracted fields from a pushed event with no polling; API integration test that the SSE endpoint emits `completed`/`failed` from a `QueueEvents` signal and closes; retain the `GET` status endpoint and its tests as the fallback.
- **Design decisions to resolve** (in `design.md`): EventSource auth (confirm cookie auth end-to-end vs. a short-lived token in the query string), proxy buffering confirmation for the admin path, the subscribe-after-complete race (read-once-on-connect), and whether to ship the generalized `job-progress-events` contract now or extraction-shaped first and generalize later.
