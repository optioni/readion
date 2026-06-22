## Context

`apps/api` (NestJS HTTP server) and `apps/worker` (NestJS app with BullMQ, no HTTP server) boot today with no observability. SPEC → Observability requires Pino logging, a Prometheus `/metrics` endpoint, OpenTelemetry tracing, and Sentry error reporting across both apps. Health checks (`/health`, terminus) are already delivered by `api-foundation` and are out of scope here. This change provides infrastructure that every later feature change and `k8s-deployment` builds on; per IMPLEMENTATION-ORDER the feature-specific metrics are emitted by their owning changes, so the contract here is "stand up the pipes + a registry feature code can plug into".

## Goals / Non-Goals

**Goals:**
- Structured JSON logging via `nestjs-pino` in both apps, level-configurable, request-logged on the API, with secret redaction and request-id correlation.
- A Prometheus `GET /metrics` endpoint in both apps (worker on a dedicated `PROMETHEUS_PORT`), with Node default metrics + API HTTP-duration histogram.
- An injectable custom-metric registry so feature modules can emit their own counters/gauges/histograms onto the same endpoint.
- OpenTelemetry Node SDK with auto-instrumentation (NestJS/HTTP, MikroORM, Redis), OTLP export when configured, no-op otherwise.
- `@sentry/nestjs` error capture in both apps, wired through the global exception filter, DSN-gated, plus a CI source-map upload step.
- Observability env group added to each app's Zod config and `.env.example`.

**Non-Goals:**
- Frontend `@sentry/nuxt` (belongs to `web-foundation`; this change has no `web-foundation` dependency — see proposal flag).
- Health checks (`api-foundation`).
- Any feature-specific metric (verifier, quarantine, LLM, BullMQ queue depth, ingestion, active-session) — those land in their owning changes via the registry provided here.
- Log shipping / collector / Grafana / Prometheus server deployment (operational concern of `k8s-deployment`).
- New database entities or migrations (this change owns none).

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| NestJS app (api/worker) | real (`@nestjs/testing` + Supertest against the bootstrapped app) | n/a |
| HTTP `/metrics` & request endpoints | real (Supertest) | n/a |
| Postgres / Redis (for OTEL DB/Redis spans) | real (Testcontainers) | n/a |
| OTLP collector | not run; assert SDK init + span creation via in-memory span exporter | in-memory span exporter |
| Sentry transport | mocked (stub/spy on Sentry `captureException` / transport) — never hit sentry.io | mocked |
| Pino output | real logger writing to a captured stream, assert parsed JSON | real logger to in-memory stream |
| Config validation | real Zod schema with crafted env objects | real Zod schema (pure) |

Pure-logic unit tests cover: config Zod schema (valid/invalid/default cases) and any redaction-path/label-extraction helper. Everything else is verified at the integration layer because it is wiring.

## Decisions

- **`nestjs-pino` over raw pino**: integrates with NestJS DI, the built-in `Logger`, and `pino-http` request logging in one module. Redaction via pino's `redact` paths (`req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.token`). Request id from `pino-http` `genReqId`, echoed back as a response header for correlation.
- **`@willsoto/nestjs-prometheus` with a shared default registry**: gives Node default metrics and a DI-friendly way to declare metric providers. The "injectable custom-metric registry" is realized through this package's metric providers + an `OnApplicationBootstrap`-safe accessor, so feature changes inject their counter/histogram without re-standing-up Prometheus. API HTTP histogram implemented as a small interceptor/middleware recording method/route/status_code labels (route template, not raw path, to bound cardinality).
- **Worker `/metrics` on a dedicated port**: the worker has no main HTTP server, so spin a minimal standalone HTTP listener on `PROMETHEUS_PORT` exposing only `/metrics`. Keeps the worker scrapeable without giving it an app server.
- **OTEL initialized pre-bootstrap in a separate `tracing.ts` imported first in `main.ts`**: auto-instrumentation must patch modules before they are required. Use `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node` (covers HTTP, NestJS, pg/MikroORM driver, ioredis). OTLP exporter only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; otherwise SDK starts with no exporter (no-op) so local dev needs no collector.
- **Sentry gated on `SENTRY_DSN`**: `Sentry.init` only when DSN present; integrate `@sentry/nestjs` and route the global RFC 7807 `ExceptionFilter` to `Sentry.captureException` for non-`HttpException`/5xx errors so the client still gets a problem-details body. No DSN → no init → silent. Source maps uploaded in CI via `@sentry/cli` after the build step (api + worker), not at runtime.
- **Config extends `shared-contracts` env helpers additively**: add the observability group to each app's existing Zod schema; all observability vars optional with defaults (`LOG_LEVEL=info`) except they fail fast when present-but-malformed. No spec-level change to `env-schema`, so no delta spec for it.

## Risks / Trade-offs

- **OTEL auto-instrumentation patch ordering** → import `tracing.ts` as the very first line of each `main.ts`; cover with an integration assertion that a DB-touching request yields parent/child spans via an in-memory exporter.
- **Prometheus label cardinality from raw URLs** → label with the NestJS route template (`/api/v1/sessions/:id`), not the concrete path.
- **Double-registering the default Prometheus registry across test app instances** → use the package's module-scoped registry and clear metrics between tests to avoid "metric already registered" errors.
- **Accidentally shipping logs/events from tests** → Sentry transport mocked in tests; OTLP exporter unset in tests (in-memory exporter only).
- **Worker extra HTTP port** → bind only `/metrics`, document the port, and ensure it does not clash with anything in `docker-compose`.

## Open Questions

- Frontend Sentry (`@sentry/nuxt`): confirm with the roadmap owner whether it folds into `web-foundation` (recommended) or should be pulled into this change. Proceeding with api+worker only.
- Whether the worker's metrics port should also be reused as a future liveness surface for k8s — deferred to `k8s-deployment`; this change only exposes `/metrics` there.
