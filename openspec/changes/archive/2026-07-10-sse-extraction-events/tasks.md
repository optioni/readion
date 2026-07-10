## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Extend the admin e2e mock harness (`apps/web/e2e/support/admin-seed.ts`) with an SSE stub: a `route.fulfill` for `GET /api/v1/admin/certifications/extractions/:jobId/events` returning `Content-Type: text/event-stream` with a body that pushes one terminal `completed` payload `{ jobId, state: "completed", result: { fields } }`, plus a request counter on the status GET so the test can assert it is not polled on an interval (design.md → Test Boundaries)
- [x] 0.2 Write failing acceptance test in `apps/web/e2e/admin.e2e.ts` for spec scenario "Wizard renders extracted fields from a pushed event without polling": the cert-setup wizard reaches the extraction step, receives the pushed `completed` event, renders `extraction-field-*` values, and issues at most one status GET (no interval polling)
- [x] 0.3 Confirm it fails for the right reason (wizard still polls / does not consume the events stream), not a harness/setup error

## 1. Shared job-progress SSE contract (`packages/shared`)

- [x] 1.1 RED: Unit test in `packages/shared/src/.../*.spec.ts` for the `job-progress-events` contract — the `{ jobId, state, result? }` payload type, an SSE-framing helper (`data: <json>\n\n`), the heartbeat comment token (`: keepalive`), and an `isTerminalState(state)` predicate covering `completed`/`failed` vs `waiting`/`active` (spec: job-progress-events)
- [x] 1.2 GREEN: Add the contract types + helpers under a new `packages/shared/src/job-progress/` module and export them from `packages/shared/src/index.ts`
- [x] 1.3 REFACTOR: Ensure names read as a reusable contract (not extraction-specific) so mock-exam prep / session generation can adopt it later

## 2. API SSE endpoint (`apps/api`) — QueueEvents-backed extraction stream <!-- parallel-after: 1 -->

- [x] 2.1 RED: Integration tests (Supertest + `@nestjs/testing` + Testcontainers Postgres/Redis, extending the cert-setup acceptance harness; worker processor NOT booted) for `GET /admin/certifications/extractions/:jobId/events` covering the certification-setup spec scenarios — 200 + `text/event-stream`/`X-Accel-Buffering: no` headers, current-state emitted on connect, `completed`→`{ ..., result: { fields } }`→stream closes (driven by `queue.getJob(...).moveToCompleted(...)`), `failed`→closes, late-subscriber reads a job already `completed`, `403` for `user`, `401` unauthenticated
- [x] 2.2 RED: Tests for the remaining job-progress-events lifecycle scenarios with injectable/short timing — heartbeat comment (`: keepalive`) written while the job stays non-terminal, the stream closing on the configured max-duration for a never-terminating job, and the per-connection `QueueEvents` being closed on disconnect/close (spy, no leaked subscription)
- [x] 2.3 RED: Integration test asserting the retained status GET `GET /admin/certifications/extractions/:jobId` is unchanged (`200` `{ data: { state, fields } }`, `404` unknown) and no longer carries `@SkipThrottle({ agent: true })`
- [x] 2.4 GREEN: Implement a job-events SSE service that opens a per-connection `QueueEvents` on the `cert-extraction` queue (connection from `queue.opts.connection`, mirroring `AgentService.waitForMaterialJob`), emits current state on connect via `getJob().getState()`/`returnvalue`, relays `completed`/`failed`, writes unnamed `data:` frames plus heartbeat comments, enforces a max-duration timeout, closes the stream on the terminal event, and closes `QueueEvents` in a `finally`; heartbeat interval and max duration are injectable/config-driven so tests can use short values
- [x] 2.5 GREEN: Add the `@Get('extractions/:jobId/events')` route to `CertSetupController` (keep `@Roles('admin')`, `@SkipEnvelope()`, cookie auth; set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`) wiring the SSE service through the shared contract; register the job-events provider in `CertSetupModule`
- [x] 2.6 GREEN: Remove the `@SkipThrottle({ agent: true })` workaround (and its comment) from the status GET now that the wizard no longer polls it
- [x] 2.7 GREEN: Run `yarn codegen` and commit the regenerated Orval client if the OpenAPI spec changed (the events route is consumed via `EventSource`, but keep the client in sync)
- [x] 2.8 REFACTOR: Extract any SSE header/framing writing shared with the agent controller if it reduces duplication without coupling the two features

## 3. Web consumption (`apps/web`) — extraction step over SSE <!-- parallel-after: 1 -->

- [x] 3.1 RED: Component test in `apps/web/tests/components/CertSetupExtractionStep.spec.ts` (stubbing `useReadionEventSource`) asserting the step applies `fields` from a pushed terminal payload, renders them, and does not start interval polling; update/remove `certExtractionPoll` unit expectations for the deleted consecutive-failure cap
- [x] 3.2 GREEN: Replace the vue-query `refetchInterval` polling in `CertSetupExtractionStep.vue` with `useReadionEventSource<JobProgressPayload>` on `/admin/certifications/extractions/:jobId/events`; apply `result.fields` on the terminal event and call the composable's `close()` on any terminal (`completed`/`failed`) payload so `EventSource` does not auto-reconnect to the closed stream; keep a single status GET for initial paint / SSE-unavailable fallback
- [x] 3.3 GREEN: Reduce `certExtractionPoll.ts` to the fallback path — delete `MAX_CONSECUTIVE_FAILURES` and the interval-driven `nextRefetchInterval` loop, keeping only the terminal/error helpers the fallback still needs
- [x] 3.4 REFACTOR: Ensure reconnect + fallback behaviour is clean and the component has no dead polling state
- [x] 3.5 GREEN: Enhance `useReadionEventSource` to accept a reactive path (`MaybeRefOrGetter<string>`) so a caller whose job id arrives asynchronously can subscribe once it is known; string paths stay backward-compatible (open immediately). Discovered during apply: the re-verification flow shares the extraction status GET, so removing `@SkipThrottle` (2.6) required migrating it off polling too
- [x] 3.6 GREEN: Migrate `useCertReverifyFlow` (same cert-extraction job) from vue-query polling to `useReadionEventSource` + a single status-GET fallback, closing the stream on terminal; update `AdminCertReverify` / `AdminCertifications` reverify specs to the SSE model

## 4. Acceptance Test — Outer Loop GREEN

- [x] 4.1 Confirm the Playwright acceptance test (0.2) and the API integration tests (group 2) pass end-to-end
- [x] 4.2 Verify all affected apps start in the local environment (smoke test) — boot `apps/api`, `apps/web`, and `apps/worker` and confirm no startup/config errors, and that an extraction stream opens and closes against local Redis
- [x] 4.3 REFACTOR: Clean up test harness/mocks (SSE stub, QueueEvents fixtures) if needed

## 5. Change Review — Subagent Verification

- [x] 5.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 5.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 6. Polish

- [x] 6.1 Run linter and fix all errors (`yarn lint`)
- [x] 6.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 6.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 6.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
