## Why

`apps/api` and `apps/worker` boot but emit no structured logs, expose no metrics, produce no traces, and report no errors to a central system. Without this baseline, production incidents are undiagnosable and downstream feature changes (LLM, content pipeline, quiz, sessions) have nowhere to emit the metrics SPEC → Observability requires. This change stands up the observability *infrastructure* both apps depend on, and is a prerequisite for `k8s-deployment`.

## What Changes

- **Structured logging (Pino)**: add `nestjs-pino` to `apps/api` and `apps/worker` — JSON logs to stdout, log level from config, `pino-http` request logging on the API, redaction of secrets/auth headers, and request-id correlation.
- **Metrics (Prometheus)**: add `@willsoto/nestjs-prometheus` to both apps, exposing `GET /metrics` (separate Prometheus HTTP port on the worker, which has no main HTTP server). Register Node default metrics plus the *infrastructure* metrics this change owns: HTTP request latency/status (API) and a reusable, injectable metrics registry so feature changes can register their own counters/histograms/gauges.
- **Distributed tracing (OpenTelemetry)**: add `@opentelemetry/sdk-node` with auto-instrumentation for NestJS, MikroORM, HTTP and Redis clients in both apps, exporting OTLP to a configurable collector endpoint; tracing toggleable/no-op when no endpoint is configured (local dev).
- **Error reporting (Sentry)**: add `@sentry/nestjs` to both apps — capture unhandled exceptions with stack traces, request context and user identity; DSN from config; integrate with the global `ExceptionFilter` so reported errors carry the RFC 7807 context. Add a CI build step to upload API/worker source maps to Sentry.
- **Configuration**: extend the shared Zod env-schema helpers (owned by `shared-contracts`) and each app's validated config with the observability group — `LOG_LEVEL`, `PROMETHEUS_PORT` (worker), `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN`, plus a service/environment name — all optional with safe local-dev defaults so the apps still boot without external collectors.

Out of scope (owned elsewhere, called out to avoid overlap):
- **Health checks** (`GET /health`, terminus) — already owned by `api-foundation` (`health-checks` capability).
- **Feature-emitted metrics** (verifier pass/fail, regeneration/substitution, quarantine rate, LLM latency/tokens, BullMQ queue depth/job time, ingestion counts, active-session count) — per IMPLEMENTATION-ORDER "Feature-emitted metrics", these are emitted from inside their owning feature changes using the registry this change provides; this change does not implement them.
- **Frontend Sentry** (`@sentry/nuxt`) — the roadmap scopes this change to "Sentry across api + worker" and it does not depend on `web-foundation`; frontend error reporting lands with `web-foundation`. (See Impact — flagged.)

## Capabilities

### New Capabilities
- `observability`: Cross-cutting logging, metrics, tracing, and error-reporting infrastructure for `apps/api` and `apps/worker` — Pino structured logging, a Prometheus `/metrics` endpoint with an injectable custom-metric registry, OpenTelemetry OTLP tracing with auto-instrumentation, and Sentry error capture wired into the global exception filter, all driven by validated env config.

### Modified Capabilities
<!-- None. Env-schema helpers (shared-contracts) and config wiring are extended additively at the implementation level; no existing spec requirement changes. -->

## Impact

- **Code**: `apps/api` and `apps/worker` bootstrap (`main.ts`), root modules, and a shared observability module/setup per app; CI workflow gains a Sentry source-map upload step.
- **Config**: new observability env vars added to `apps/api/.env.example`, `apps/worker/.env.example`, and validated config schemas; shared env helpers extended.
- **Dependencies**: `nestjs-pino`, `pino-http`, `@willsoto/nestjs-prometheus`, `prom-client`, `@opentelemetry/sdk-node` + instrumentation packages, `@sentry/nestjs`, `@sentry/cli` (CI source maps).
- **Depends on**: `api-foundation` (archived), `worker-foundation` (archived). **Unblocks**: `k8s-deployment` (probes/scrape config), and the metric-emission path for all feature changes.
- **Flag**: SPEC → Observability → Error Reporting lists `@sentry/nuxt` on the frontend, but the roadmap Scope and dependency graph confine this change to api+worker (no `web-foundation` dependency). Recommend frontend Sentry be folded into `web-foundation`; raise with roadmap owner if it should instead live here.
