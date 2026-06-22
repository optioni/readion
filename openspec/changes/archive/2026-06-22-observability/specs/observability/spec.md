## ADDED Requirements

### Requirement: Structured JSON logging

Both `apps/api` and `apps/worker` SHALL emit structured JSON logs to stdout via `nestjs-pino`. The log level SHALL be read from the `LOG_LEVEL` env var (default `info`). The API SHALL log every HTTP request via `pino-http`. Logs SHALL redact sensitive fields (authorization headers, cookies, passwords, tokens) and SHALL include a per-request correlation id.

#### Scenario: API emits a structured request log line

- **WHEN** the API receives `GET /api/v1/health` (or any request) with `LOG_LEVEL=info`
- **THEN** a single-line JSON log object is written to stdout for that request
- **THEN** the object contains `level`, `time`, a `req` with `method` and `url`, a `res` with `statusCode`, and a `responseTime`/duration field
- **THEN** the object carries a request correlation id (e.g. `req.id`) that is also returned to the client as a response header

#### Scenario: Log level filters lower-severity logs

- **WHEN** the API or worker boots with `LOG_LEVEL=warn`
- **THEN** calls to the logger at `debug` and `info` produce no output
- **THEN** calls at `warn` and `error` are written to stdout

#### Scenario: Sensitive fields are redacted

- **WHEN** a request arrives carrying an `authorization` header and a session `cookie`
- **THEN** the emitted request log object shows those values as `[Redacted]` rather than their plaintext

#### Scenario: Worker logs are structured JSON

- **WHEN** the worker logs a message during boot or job processing
- **THEN** the output is a single-line JSON object with `level` and `time`, not a human-formatted string

### Requirement: Prometheus metrics endpoint

Both apps SHALL expose a Prometheus-format `GET /metrics` endpoint via `@willsoto/nestjs-prometheus`. Because the worker has no main HTTP server, its `/metrics` endpoint SHALL be served on a dedicated port from `PROMETHEUS_PORT`. The endpoint SHALL include Node.js default process metrics. The API SHALL record an HTTP request-duration histogram labelled by method, route, and status code.

#### Scenario: API exposes default and HTTP metrics

- **WHEN** a client requests `GET /metrics` on the API after at least one prior API request
- **THEN** the response status is 200 with content type `text/plain; version=0.0.4`
- **THEN** the body contains default process metrics (e.g. `process_cpu_seconds_total`, `nodejs_eventloop_lag_seconds`)
- **THEN** the body contains an HTTP request-duration histogram series carrying `method`, `route`/`path`, and `status_code` labels

#### Scenario: Worker exposes metrics on its dedicated port

- **WHEN** the worker boots with `PROMETHEUS_PORT=9091` and a client requests `GET /metrics` on port `9091`
- **THEN** the response status is 200 in Prometheus text format
- **THEN** the body contains Node.js default process metrics

### Requirement: Injectable custom-metric registry

The observability infrastructure SHALL provide an injectable way for any feature module to register and update custom Prometheus metrics (counters, gauges, histograms) that are then exposed on the same `/metrics` endpoint. This is the mechanism feature changes use to emit their domain metrics; this change provides the mechanism but not the feature metrics themselves.

#### Scenario: A registered custom counter appears on /metrics

- **WHEN** a module registers a counter named `readion_test_events_total` and increments it once
- **THEN** a subsequent `GET /metrics` response includes the line `readion_test_events_total 1`

### Requirement: Distributed tracing via OpenTelemetry

Both apps SHALL initialize the OpenTelemetry Node SDK before the application bootstraps, with auto-instrumentation for NestJS/HTTP, MikroORM (database), and outbound HTTP/Redis clients. When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, spans SHALL be exported over OTLP to that endpoint. When it is unset (local dev), tracing SHALL initialize as a no-op exporter and the app SHALL still boot normally.

#### Scenario: Incoming API request produces a server span

- **WHEN** tracing is configured with an OTLP endpoint and the API handles an incoming request that triggers a database query
- **THEN** a server span is created for the HTTP request
- **THEN** a child span is created for the database query, parented to the request span

#### Scenario: App boots with tracing disabled

- **WHEN** the API or worker boots with `OTEL_EXPORTER_OTLP_ENDPOINT` unset
- **THEN** the SDK initializes without throwing and the application starts and serves requests normally
- **THEN** no OTLP export is attempted

### Requirement: Error reporting via Sentry

Both apps SHALL initialize `@sentry/nestjs` when `SENTRY_DSN` is set, capturing unhandled exceptions with stack traces, request context, and user identity. Reporting SHALL be wired so errors surfaced by the global RFC 7807 `ExceptionFilter` are sent to Sentry. When `SENTRY_DSN` is unset, the app SHALL boot normally and send nothing. The CI build SHALL upload API and worker source maps to Sentry so reported stack traces map to TypeScript source.

#### Scenario: Unhandled exception is reported when DSN is set

- **WHEN** the API boots with a valid `SENTRY_DSN` and a request handler throws an unhandled (non-`HttpException`) error
- **THEN** the error is captured and sent to Sentry with its stack trace and the request context
- **THEN** the client still receives an RFC 7807 problem-details response from the global exception filter

#### Scenario: No reporting without a DSN

- **WHEN** the API or worker boots with `SENTRY_DSN` unset and an error is thrown
- **THEN** the application does not initialize the Sentry client and no event is transmitted
- **THEN** the application continues to run normally

### Requirement: Validated observability configuration

Each app's Zod-validated config SHALL include the observability group: `LOG_LEVEL` (one of pino's levels; default `info`), `OTEL_EXPORTER_OTLP_ENDPOINT` (optional URL), `SENTRY_DSN` (optional), and a service/environment name; the worker config SHALL additionally include `PROMETHEUS_PORT`. Each app SHALL fail fast at startup if a provided observability value is malformed, and SHALL boot with safe defaults when optional values are absent. The new vars SHALL be documented in each app's `.env.example`.

#### Scenario: Malformed log level fails fast

- **WHEN** the API boots with `LOG_LEVEL=verbose` (not a valid pino level)
- **THEN** startup aborts with a clear validation error naming `LOG_LEVEL`

#### Scenario: Boots with defaults when optional vars omitted

- **WHEN** the API boots with `OTEL_EXPORTER_OTLP_ENDPOINT` and `SENTRY_DSN` unset
- **THEN** config validation passes, `LOG_LEVEL` resolves to `info`, and the app starts

#### Scenario: Malformed OTLP endpoint fails fast

- **WHEN** the worker boots with `OTEL_EXPORTER_OTLP_ENDPOINT=not-a-url`
- **THEN** startup aborts with a clear validation error naming `OTEL_EXPORTER_OTLP_ENDPOINT`
