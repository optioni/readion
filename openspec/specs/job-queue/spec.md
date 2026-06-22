## Purpose

Defines the BullMQ-based job queue infrastructure for the worker: how queues are registered on the shared Redis connection, what defaults apply to all content-ingestion jobs, how job lifecycle events are surfaced, and how concrete processors are structured. Also specifies the typed HTTP client for the scrapper sidecar.

## Requirements

### Requirement: BullMQ root on the shared Redis connection

The worker SHALL register the BullMQ root (`@nestjs/bullmq`) using the shared `ioredis` connection from the worker runtime, so queues and the runtime/health surface observe the same Redis connection. BullMQ MUST NOT open its own separate connection from raw env.

#### Scenario: Queues use the shared connection

- **WHEN** the BullMQ root is configured and a queue is registered in a `@nestjs/testing` context against a real Redis Testcontainer
- **THEN** the queue connects through the shared Redis connection provider and a job added to it is readable back from that same Redis instance

### Requirement: Per-source-type queue registration with project defaults

The worker SHALL expose a reusable helper to register a BullMQ queue (one per content source type) that applies the project's default job options: automatic retries with **exponential backoff** and bounded attempts, plus removal of completed/failed jobs past a retention bound. The helper MUST let a caller name the queue while inheriting these defaults, and MUST allow per-queue overrides.

#### Scenario: Registered queue carries exponential-backoff defaults

- **WHEN** a queue is registered through the helper without overrides
- **THEN** its default job options specify `attempts` greater than 1 and `backoff.type: "exponential"` with a non-zero delay

#### Scenario: A failing job is retried before being marked failed

- **WHEN** a processor for a helper-registered queue throws on its first execution and the job has `attempts: 3`
- **THEN** BullMQ re-enqueues the job with an increasing delay and the job is only marked `failed` after the third attempt throws

#### Scenario: Per-queue overrides are honored

- **WHEN** a queue is registered with an explicit `attempts` override
- **THEN** the registered queue uses the overridden value while still inheriting the exponential-backoff strategy from the defaults

### Requirement: Job event emission for status visibility

A helper-registered queue SHALL emit BullMQ job lifecycle events (`completed`, `failed`, and `progress`) so a later admin UI can report ingestion job status. The events MUST carry the job id and, for `failed`, the failure reason.

#### Scenario: Completed event fires with the job id

- **WHEN** a processor handles a job successfully on a helper-registered queue with a `QueueEvents` listener attached
- **THEN** a `completed` event fires carrying that job's id

#### Scenario: Failed event carries the failure reason

- **WHEN** a processor exhausts its attempts and the job is marked `failed`
- **THEN** a `failed` event fires carrying the job id and the thrown error's message as the failure reason

### Requirement: Abstract base processor conventions

The worker SHALL provide an abstract base processor (extending the `@nestjs/bullmq` `WorkerHost`) that centralizes structured logging of job start, success, and failure and re-throws handler errors so BullMQ's retry/backoff engages. Concrete processors extend it by implementing a single typed `handle`/`process` method.

#### Scenario: Base logs the job lifecycle

- **WHEN** a concrete processor extending the base successfully handles a job
- **THEN** the base emits a structured "started" log and a structured "completed" log, each including the queue name and job id

#### Scenario: Handler errors propagate to BullMQ

- **WHEN** a concrete processor's `handle` throws
- **THEN** the base logs a structured "failed" entry with the job id and error message and re-throws so the job is retried per its attempts/backoff rather than being silently swallowed

#### Scenario: Concrete processor consumes an enqueued job end-to-end

- **WHEN** a job is added to a helper-registered queue whose concrete processor extends the base, in a context wired to a real Redis Testcontainer
- **THEN** the processor's `handle` receives the job payload and the job reaches the `completed` state

### Requirement: Typed scrapper HTTP client

The worker SHALL provide an injectable, typed client that calls the `amerkurev/scrapper` sidecar over HTTP — using the validated `SCRAPPER_URL` base, a configurable request timeout — to fetch a URL and return cleaned content (text/markdown plus basic metadata). Non-2xx responses, timeouts, and transport errors MUST be surfaced as a typed client error rather than leaking the raw HTTP failure, so callers (and BullMQ retry) can react uniformly.

#### Scenario: Successful fetch returns cleaned content

- **WHEN** the client requests a URL and the scrapper stub responds 200 with a cleaned content body
- **THEN** the client resolves a typed result exposing the cleaned text/markdown and the originating source URL

#### Scenario: Upstream error becomes a typed client error

- **WHEN** the scrapper stub responds with a 500 (or the request times out)
- **THEN** the client rejects with a typed scrapper error carrying the failed URL and the underlying status/cause, not an unhandled transport exception

#### Scenario: Base URL comes from validated config

- **WHEN** the client issues a request for a path
- **THEN** the outbound request targets the configured `SCRAPPER_URL` base rather than a hardcoded host
