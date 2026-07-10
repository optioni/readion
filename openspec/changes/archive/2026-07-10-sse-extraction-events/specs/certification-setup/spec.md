## ADDED Requirements

### Requirement: Extraction status is pushed to the wizard over SSE, with the status GET kept as a fallback

To learn when an extraction job finished, the cert-setup wizard SHALL consume a server-pushed SSE stream instead of polling the status endpoint. The system SHALL expose `GET /api/v1/admin/certifications/extractions/:jobId/events`, admin-only, that streams the extraction job's progress and terminal result as Server-Sent Events per the `job-progress-events` contract: on connect it emits the job's current `state` once, relays the BullMQ `QueueEvents` `completed`/`failed` signal, includes the grounded `fields` result on the terminal `completed` payload, and closes the stream on the terminal event. The route SHALL authenticate via the existing auth cookie (an `EventSource` cannot send an `Authorization` header) and MUST enforce the same `@Roles('admin')` gate as the other cert-setup routes: non-admin callers MUST receive `403` and unauthenticated callers `401`.

The existing `GET /api/v1/admin/certifications/extractions/:jobId` status route SHALL be retained as a fallback for initial paint and for proxies/browsers that drop SSE, and its response shape (`{ data: { state, fields } }`, `fields` null while pending, `404` for an unknown `jobId`) is unchanged. Because the wizard no longer polls that route on an interval, the polling-era workarounds SHALL be removed: the `@SkipThrottle({ agent: true })` on the status GET and the consecutive-failure cap in the web `certExtractionPoll` composable.

The web `CertSetupExtractionStep.vue` SHALL replace its vue-query `refetchInterval` polling with `useReadionEventSource` consuming the events route, apply the extracted `fields` from the pushed terminal payload, and issue at most a single status GET (fallback) rather than repeated interval fetches.

Re-verification runs the same `cert-extraction` job against an existing certification and, before this change, polled the same status GET. Because the status GET no longer carries the `@SkipThrottle({ agent: true })` workaround, the re-verification flow (`useCertReverifyFlow`) SHALL also consume the events route via `useReadionEventSource` — opening the stream once its job id is known and closing it on the terminal event — with the same single status-GET fallback, so no flow polls the status GET on an interval.

#### Scenario: SSE stream pushes the completed extraction result and closes

- **WHEN** an admin connects to `GET /api/v1/admin/certifications/extractions/:jobId/events` for a job that then completes with a grounded `fields` result
- **THEN** the response is `200` with `Content-Type: text/event-stream`
- **AND** the stream emits the job's current `state` on connect
- **AND** on the `QueueEvents` `completed` signal it emits a payload `{ jobId, state: "completed", result: { fields } }` carrying the per-field grounded result
- **AND** the server closes the stream after the terminal event

#### Scenario: SSE stream reports a failed extraction and closes

- **WHEN** an admin is connected to the events route and the extraction job transitions to `failed`
- **THEN** the stream emits `{ jobId, state: "failed" }` and the server closes the stream

#### Scenario: Extraction that already completed is reported to a late subscriber

- **WHEN** an admin connects to the events route after the job has already reached `completed`
- **THEN** the on-connect current-state read emits `{ jobId, state: "completed", result: { fields } }` from the retained job without waiting for a further signal

#### Scenario: Non-admin cannot open the extraction events stream

- **WHEN** a `user`-role caller requests `GET /api/v1/admin/certifications/extractions/:jobId/events`
- **THEN** the response is `403` as RFC 7807 Problem Details
- **AND** an unauthenticated caller receives `401`

#### Scenario: Status GET remains available as a fallback without the throttle workaround

- **WHEN** an admin requests `GET /api/v1/admin/certifications/extractions/:jobId`
- **THEN** the response is unchanged: `200` with `{ data: { state, fields } }` (`fields` null while pending) and `404` for an unknown `jobId`
- **AND** the route no longer carries `@SkipThrottle({ agent: true })`

#### Scenario: Wizard renders extracted fields from a pushed event without polling

- **WHEN** the extraction step is shown and the backend pushes a terminal `completed` event over the events stream
- **THEN** `CertSetupExtractionStep.vue` renders the extracted fields from the pushed payload
- **AND** it does not issue repeated interval status GETs

#### Scenario: Re-verification composes its diff without polling the status GET

- **WHEN** a re-verification is started and the extraction completes
- **THEN** `useCertReverifyFlow` composes the diff from the pushed terminal payload (or, where SSE is unavailable, a single status-GET fallback)
- **AND** it does not poll the status GET on an interval
