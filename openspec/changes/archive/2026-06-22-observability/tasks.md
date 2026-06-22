## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the integration test harness for `apps/api` and `apps/worker` (`@nestjs/testing` + Supertest; Testcontainers Postgres+Redis for OTEL DB/Redis spans; in-memory OTEL span exporter; Sentry transport stub/spy; captured Pino stream) per design.md Test Boundaries — no real OTLP collector, no real sentry.io
- [x] 0.2 Write failing acceptance test: API boots, serves a request, and `GET /metrics` returns 200 Prometheus text containing default process metrics and an HTTP-duration histogram with `method`/`route`/`status_code` labels; the request emits a redacted structured JSON log line carrying a correlation id; an unhandled error is captured by the (stubbed) Sentry transport while the client still receives an RFC 7807 body
- [x] 0.3 Write failing acceptance test: worker boots and `GET /metrics` on `PROMETHEUS_PORT` returns 200 with default metrics; worker logs are single-line JSON
- [x] 0.4 Confirm both fail for the right reason (no observability wiring yet — not a harness/setup error)

## 1. Observability Configuration (Zod env group)

- [x] 1.1 RED: Write unit tests for the observability config schema — valid case; default `LOG_LEVEL=info` when omitted; malformed `LOG_LEVEL=verbose` rejected naming the var; malformed `OTEL_EXPORTER_OTLP_ENDPOINT=not-a-url` rejected; optional `SENTRY_DSN`/OTLP omitted passes; worker schema requires/validates `PROMETHEUS_PORT`
- [x] 1.2 GREEN: Add the observability env group (`LOG_LEVEL`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN`, service/environment name; worker adds `PROMETHEUS_PORT`) to each app's Zod config, extending the `shared-contracts` env-schema helpers; document the vars in `apps/api/.env.example` and `apps/worker/.env.example`
- [x] 1.3 REFACTOR: De-duplicate shared observability env definitions into `packages/shared`

## 2. Structured Logging (nestjs-pino)

- [x] 2.1 RED: Write unit/integration tests — level filtering honours `LOG_LEVEL`; emitted request log is valid JSON with `req.method`/`req.url`/`res.statusCode`/duration and a correlation id echoed as a response header; `authorization` and `cookie` render as `[Redacted]`; worker logger emits JSON
- [x] 2.2 GREEN: Wire `nestjs-pino` + `pino-http` into `apps/api` and `apps/worker` (level from config, redaction paths, `genReqId` + response header), replacing the default NestJS logger
- [x] 2.3 REFACTOR: Extract shared Pino options/redaction config used by both apps

## 3. Prometheus Metrics + Injectable Registry

- [x] 3.1 RED: Write integration tests — API `/metrics` returns 200 with default metrics and the HTTP-duration histogram labelled by route template (not raw path); a feature-registered custom counter `readion_test_events_total` incremented once appears on `/metrics`; worker `/metrics` served on `PROMETHEUS_PORT` returns default metrics
- [x] 3.2 GREEN: Add `@willsoto/nestjs-prometheus` to both apps; expose API `/metrics`; record the HTTP request-duration histogram (method/route/status_code) via interceptor/middleware; stand up the worker's dedicated `/metrics` HTTP listener on `PROMETHEUS_PORT`; provide the injectable custom-metric registration mechanism
- [x] 3.3 REFACTOR: Ensure registry is reset between test app instances to avoid duplicate-registration errors; bound label cardinality to route templates

## 4. Distributed Tracing (OpenTelemetry)

- [x] 4.1 RED: Write integration tests using an in-memory span exporter — a DB-touching API request produces a server span with a child DB span; with `OTEL_EXPORTER_OTLP_ENDPOINT` unset the SDK initializes no-op and the app boots and serves normally with no export attempted
- [x] 4.2 GREEN: Add `tracing.ts` (SDK + auto-instrumentations for HTTP/NestJS, MikroORM/pg, ioredis) imported as the first line of each `main.ts`; OTLP exporter only when the endpoint is configured, otherwise no-op
- [x] 4.3 REFACTOR: Share the tracing bootstrap between api and worker (service-name parameterized)

## 5. Error Reporting (Sentry)

- [x] 5.1 RED: Write integration tests with a stubbed Sentry transport — with `SENTRY_DSN` set, an unhandled (non-`HttpException`) error is captured with stack trace + request context while the client receives an RFC 7807 problem-details response; with `SENTRY_DSN` unset, no client is initialized and nothing is transmitted
- [x] 5.2 GREEN: Initialize `@sentry/nestjs` in both apps gated on `SENTRY_DSN`; route the global RFC 7807 `ExceptionFilter` to `Sentry.captureException` for unhandled/5xx errors, preserving the problem-details body and attaching user identity
- [x] 5.3 GREEN: Add the CI build step that uploads `apps/api` and `apps/worker` source maps to Sentry via `@sentry/cli`
- [x] 5.4 REFACTOR: Extract shared Sentry init/filter integration used by both apps

## 6. Acceptance Test — Outer Loop GREEN

- [x] 6.1 Confirm both acceptance tests (API and worker) pass end-to-end
- [x] 6.2 Verify all affected apps start in the local environment (smoke test) — boot `apps/api` and `apps/worker` and confirm no startup/config errors with observability wired and with optional vars omitted
- [x] 6.3 REFACTOR: Clean up test setup, exporters, and Sentry stubs

## 7. Change Review — Subagent Verification

- [x] 7.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 7.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 8. Polish

- [x] 8.1 Run linter and fix all errors (`yarn lint`)
- [x] 8.2 Run formatter and apply fixes (`yarn format`)
- [x] 8.3 Run type checker with zero errors (`yarn workspace apps/api typecheck && yarn workspace apps/worker typecheck`)
- [x] 8.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
