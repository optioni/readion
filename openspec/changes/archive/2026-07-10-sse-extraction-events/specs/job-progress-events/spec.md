## ADDED Requirements

### Requirement: Background job progress is delivered as a server-pushed SSE stream

The system SHALL provide a reusable Server-Sent Events contract for reporting the progress and terminal result of a background (BullMQ) job to an authenticated browser client, so long-running jobs push their status instead of being polled. A job-progress SSE route SHALL respond with `Content-Type: text/event-stream`, set `Cache-Control: no-cache`, `Connection: keep-alive`, and `X-Accel-Buffering: no` so intermediaries do not buffer the stream, and hold a single connection open for the life of the job rather than answering one request per status check.

Each SSE message payload SHALL be a JSON object keyed by the BullMQ job id with the shape `{ jobId, state, result? }`, where `state` is the BullMQ job state (`waiting` | `active` | `completed` | `failed`) and `result` is the job's return value, present only once the job has reached a terminal state and produced one. The stream SHALL be backed by BullMQ `QueueEvents` (Redis pub/sub) rather than a server-side poll loop, so the API is notified of worker completion by Redis.

Because `EventSource` cannot send an `Authorization` header, a job-progress SSE route SHALL authenticate via the existing auth cookie (as the agent chat SSE already does) and enforce the same authorization the equivalent non-streaming route enforces.

#### Scenario: Stream opens with the correct SSE headers

- **WHEN** an authorized client connects to a job-progress SSE route for an existing job
- **THEN** the response status is `200` with `Content-Type: text/event-stream`
- **AND** the response sets `Cache-Control: no-cache` and `X-Accel-Buffering: no`
- **AND** the connection stays open rather than closing after a single payload

#### Scenario: Current job state is emitted once on connect

- **WHEN** a client connects while the job's current BullMQ state is `active`
- **THEN** the stream immediately emits one `data:` payload `{ jobId, state: "active" }` before relaying any `QueueEvents` signal
- **AND** the emitted `jobId` equals the job id in the route

#### Scenario: Terminal completion event is pushed then the stream closes

- **WHEN** the job transitions to `completed` with a return value while a client is connected
- **THEN** the `QueueEvents` `completed` signal causes the stream to emit `{ jobId, state: "completed", result }` carrying the job's return value
- **AND** the server closes the stream after emitting the terminal event

#### Scenario: Terminal failure event is pushed then the stream closes

- **WHEN** the job transitions to `failed` while a client is connected
- **THEN** the stream emits `{ jobId, state: "failed" }`
- **AND** the server closes the stream after emitting the terminal event

#### Scenario: Job that finished before the client subscribed is still reported

- **WHEN** a client connects after the job has already reached `completed`
- **THEN** the on-connect current-state read emits `{ jobId, state: "completed", result }` from the retained job
- **AND** the stream closes without waiting for a `QueueEvents` signal that will never arrive

#### Scenario: Idle stream is kept alive by a heartbeat

- **WHEN** a job stays non-terminal longer than the heartbeat interval
- **THEN** the stream periodically writes an SSE comment (`: keepalive`) so idle-connection reapers do not drop the connection

#### Scenario: Stream is bounded by a maximum duration

- **WHEN** a job never reaches a terminal state within the configured maximum stream duration
- **THEN** the server closes the stream so a stuck job cannot hold the connection indefinitely
- **AND** the browser `EventSource` auto-reconnects and re-reads the job's current state on the new connection — bounded to one held request per max-duration window (not the interval poll this change removes), and delivering the terminal result once the job finishes

#### Scenario: QueueEvents subscription is released on disconnect

- **WHEN** a client disconnects or the stream closes for any reason
- **THEN** the per-connection `QueueEvents` subscription is closed, leaking no Redis subscription
