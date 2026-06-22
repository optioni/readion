## Context

`apps/worker` exists only as the scaffold's headless "hello world": `main.ts` calls `NestFactory.createApplicationContext(AppModule)`, `AppModule` is empty, and readiness is a `console.log`. Per SPEC → Content Pipeline — `apps/worker`, the worker is a NestJS app with **no HTTP server** that runs BullMQ processors and `@nestjs/schedule` cron jobs, and fetches web content through the `amerkurev/scrapper` sidecar over HTTP.

The platform primitives this change consumes already exist: `@readion/shared` exports the Zod env helpers (`zodRequiredUrl`, `redisUrlFragment`, `databaseUrlFragment`) and `@readion/db` exports a global `DbModule` plus a Testcontainers harness (`createDbHarness`) over Postgres+pgvector. `api-foundation` (archived) already established the sibling pattern this mirrors: `@nestjs/config` + Zod fail-fast schema, a single shared `ioredis` connection injected by everything Redis-touching, and graceful shutdown — the worker repeats that shape minus the HTTP layer.

Per the roadmap entity-ownership table, `worker-foundation` owns **no entity and no migration**; it imports `DbModule` to share the connection. The concrete cleanup/ingestion crons and all source-type fetch strategies are owned by downstream changes — this change ships only the foundation they register against.

## Goals / Non-Goals

**Goals:**
- A bootable headless `apps/worker` (application context, no HTTP listener) with fail-fast `@nestjs/config` + Zod env validation (`DATABASE_URL`, `REDIS_URL`, `SCRAPPER_URL`, `NODE_ENV`) reusing `@readion/shared` helpers, additively extensible by downstream changes.
- A single shared `ioredis` connection provider, injected by BullMQ, quit on shutdown.
- A BullMQ foundation: per-source-type queue registration helper with the project's default job options (exponential-backoff retries, job-event emission) and an abstract base processor (structured logging + error/retry propagation), proven against a real Redis Testcontainer.
- `@nestjs/schedule` `ScheduleModule.forRoot()` registered so downstream `@Cron`s have a home — no concrete cron.
- A typed `ScrapperModule` HTTP client over the sidecar with config-driven base URL, timeout, and typed error mapping.
- Graceful shutdown closing Redis + ORM on `SIGTERM`/`SIGINT`.

**Non-Goals:**
- Any HTTP server, controller, route, or `/api/v1` surface — the worker is headless.
- Source-type fetch strategies, cleaning/normalizing, chunking, domain tagging, embeddings, pgvector upsert, `ContentSource`/`ContentChunk` entities — owned by `content-pipeline`.
- Any concrete cron job (account purge, session abandonment, agent TTL, mock auto-submit, superseded-chunk delete, stale-source re-ingestion, weekly digest) — each owned by its feature change; this change only stands up `@nestjs/schedule`.
- Prometheus `/metrics`, OpenTelemetry, Pino logging, and Sentry across the worker — owned by `observability` (which depends on this change). Base-processor logging here uses NestJS `Logger`; `observability` later swaps the transport.
- The LLM/AI provider config group — `llm-foundation`/`content-pipeline` extend the Zod schema additively.
- Any domain entity or migration.

## Test Boundaries

Per CLAUDE.md, integration tests hit real infrastructure via Testcontainers — never mock the database or Redis. BullMQ is exercised against a **real Redis Testcontainer** so retry/backoff and job-event behaviour are genuinely observed, not faked. The scrapper sidecar is a third-party container; the worker depends only on its **HTTP contract**, so the client is tested against a local in-process HTTP stub server (a real `http.Server` returning canned responses) — this keeps the suite hermetic while exercising the real fetch/parse/error-mapping path. Running the client against the real `amerkurev/scrapper` sidecar is left to the `content-pipeline` ingestion tests (per the CLAUDE.md gotcha).

The outer acceptance loop is a **NestJS integration test** (not Playwright — the worker has no HTTP server to drive): boot the worker context via `@nestjs/testing` with a real Redis container and the `@readion/db` harness, register a trivial test queue + processor through the helper, add a job, and assert the processor consumes it to `completed` with the configured backoff/eventing in force.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Redis (shared connection + BullMQ) | real (Testcontainers `redis`) | not used (pure logic only) |
| Postgres (via `DbModule`) | real (Testcontainers `pgvector/pgvector:pg17`, reusing `@readion/db` harness) | not used |
| BullMQ queues/processors | real (against the real Redis container) | not used |
| `amerkurev/scrapper` sidecar | in-process HTTP stub server (real `http.Server`, canned responses) | n/a |
| Scrapper client fetch/parse/error-mapping | real client against the stub | n/a (logic covered via the stub-backed integration test) |
| Zod env schema | real (parse sample env objects) | real (parse valid/invalid env objects — no process boot) |
| Queue default-options builder / event wiring | real (asserted on live queue behaviour) | real (pure builder unit tests on the produced job options) |

## Decisions

- **Headless application context, mirroring the api-foundation shape minus HTTP.** `NestFactory.createApplicationContext` with `app.enableShutdownHooks()`; no `listen`, no Swagger, no global prefix. *Alternative:* a full HTTP app with no routes. *Why:* SPEC is explicit the worker has no HTTP server; an application context is the lighter, correct primitive and keeps the deployment a Deployment-with-no-ingress.
- **Reuse `@readion/shared` env helpers and the `DbModule`/Testcontainers harness verbatim.** The worker config composes `databaseUrlFragment`/`redisUrlFragment` and adds `SCRAPPER_URL`/`NODE_ENV`; tests reuse `createDbHarness`. *Alternative:* a worker-local env schema and its own ORM bootstrap. *Why:* single source of truth, and it keeps the worker's DB conventions identical to the API's.
- **One shared `ioredis` connection injected into BullMQ.** A `RedisModule` exposes a `REDIS_CLIENT` provider built from `REDIS_URL`; `BullModule.forRootAsync` is configured to reuse that exact connection. *Alternative:* let `@nestjs/bullmq` open its own connection from host/port env. *Why:* one connection is cheaper, and a later worker health/metrics surface reflects the exact connection BullMQ relies on — the same rationale api-foundation used for the throttler store.
- **Queue registration helper + a shared default-job-options builder.** A small `registerSourceQueue(name, overrides?)` wrapper over `BullModule.registerQueue` injects defaults: `attempts: 3`, `backoff: { type: 'exponential', delay: <base> }`, and `removeOnComplete`/`removeOnFail` retention bounds — overridable per queue. *Alternative:* each downstream change hand-writes `registerQueue` options. *Why:* pre-naming the conventions (mirroring the roadmap's pre-naming discipline) stops `content-pipeline` and the cron changes from inventing inconsistent retry/eventing policy.
- **Abstract base processor over `WorkerHost`.** An abstract class extends `@nestjs/bullmq`'s `WorkerHost`, wraps the subclass's typed `handle(job)` with start/success/failure structured logs (NestJS `Logger`) and **re-throws** on error so BullMQ's attempts/backoff engage. *Alternative:* leave each `@Processor` to log and handle errors itself. *Why:* uniform observability and guaranteed retry semantics — swallowing an error would silently defeat the backoff the SPEC calls out for rate-limited sources.
- **Job-event emission via `QueueEvents`.** The helper wires `completed`/`failed`/`progress` events carrying job id (+ failure reason) for the future admin status UI. *Alternative:* defer eventing to `content-admin`. *Why:* SPEC → BullMQ lists "Job events emitted for status visibility in admin UI" as a pipeline property; standing it up here keeps every queue consistent from birth.
- **Scrapper client over `fetch`/`undici` with typed errors and a config-driven base.** `ScrapperModule` exposes a `ScrapperClient` whose base URL and timeout come from validated config; non-2xx/timeout/transport failures map to a typed `ScrapperError` (failed URL + status/cause). *Alternative:* `@nestjs/axios`. *Why:* a thin native-fetch client keeps deps minimal and the typed error lets BullMQ retry react uniformly; the choice is internal and swappable.
- **`@nestjs/schedule` registered but empty.** `ScheduleModule.forRoot()` only. *Why:* SPEC's crons are each owned downstream; standing up the registry now means those changes add a `@Cron` method, not bootstrap plumbing.

## Risks / Trade-offs

- **Real Redis + Postgres Testcontainers per acceptance run slow boot.** → Reuse the `@readion/db` Postgres harness, start one shared Redis container per suite, and keep BullMQ-touching assertions in a single acceptance spec.
- **BullMQ retry/backoff tests are timing-sensitive and can flake.** → Use a small/zero backoff base in tests, assert on attempt counts and terminal job state (`completed`/`failed` + `attemptsMade`) rather than wall-clock delays, and isolate Redis keys (unique queue names / `flushdb`) between cases.
- **Job events can be missed if the `QueueEvents` listener attaches after the job finishes.** → In tests, attach the listener and await its `ready` before adding the job; assert via an event-collected promise with a bounded timeout.
- **A hand-rolled fetch client could drift from the real scrapper contract.** → Keep the client thin and contract-typed; the stub mirrors the sidecar's documented response shape, and `content-pipeline` validates against the real sidecar.
- **Base-processor logging via NestJS `Logger` will be replaced by Pino in `observability`.** → Keep logging behind the standard `Logger` interface so the later transport swap is config-only, not a processor rewrite.

## Open Questions

- HTTP client for the scrapper: native `fetch`/`undici` is assumed for minimal deps; confirm vs. `@nestjs/axios` at implementation time if request cancellation/timeout ergonomics push the other way.
- Default `attempts` / backoff base and `removeOnComplete`/`removeOnFail` retention bounds — start with `attempts: 3`, exponential, and bounded retention, and promote any of these to config if `content-pipeline` needs per-source tuning.
- Scrapper request timeout default — pick a sensible value (e.g. 30s for page fetches) and expose it as config if source types prove to need different ceilings.
