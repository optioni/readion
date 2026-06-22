## Why

The scaffold left `apps/worker` as a bare NestJS "hello world" — `NestFactory.createApplicationContext(AppModule)` with an empty module and a `console.log`. The content pipeline (SPEC → Content Pipeline — `apps/worker`) is a headless NestJS app that runs BullMQ processors and `@nestjs/schedule` cron jobs and fetches web content through the `amerkurev/scrapper` sidecar. Every downstream worker change — `content-pipeline`, and the cleanup crons owned by `users`/`sessions`/`agent`/`mock-exam`/`chunk-lifecycle`/`email-lifecycle` — assumes these primitives already exist: that a validated config has booted, that a Redis-backed BullMQ queue can be registered with the project's retry/eventing conventions, that an abstract processor base handles errors uniformly, that `@nestjs/schedule` is wired, and that a typed scrapper client can fetch and clean a page. This change stands up that worker runtime once so every later change registers a queue or a cron instead of reinventing the bootstrap.

## What Changes

- **Bootstrap the worker runtime**: a headless NestJS application context (no HTTP server, no `setGlobalPrefix`/Swagger) that loads validated config, imports `DbModule` from `@readion/db`, opens a shared Redis connection, registers BullMQ + `@nestjs/schedule` roots, and logs readiness via a structured signal rather than `console.log`. Graceful shutdown hooks drain queue connections and the ORM on `SIGTERM`/`SIGINT`.
- **Validated configuration**: `@nestjs/config` loaded with a Zod schema for `apps/worker` that fails fast at boot on missing/malformed env. This change establishes the base schema with the groups the worker runtime itself consumes — `DATABASE_URL`, `REDIS_URL`, `SCRAPPER_URL`, `NODE_ENV` — reusing the `@readion/shared` env helpers (`zodRequiredUrl`, fragments). Downstream changes (`content-pipeline`, lifecycle-window crons) extend this schema additively with their own groups.
- **Shared Redis connection provider**: one `ioredis` connection built from validated config, injected by BullMQ (and reusable by later worker code). Quit on module destroy.
- **BullMQ foundation + queue conventions**: register the BullMQ root against the shared Redis connection and expose a reusable way to register a **queue per source type** with the project's defaults — automatic retries with **exponential backoff** (important for rate-limited sources) and **emitted job events** (completed/failed/progress) so the admin UI can later report ingestion status. This change ships the registration helper and default job options; it does **not** create any concrete ingestion queue (that is `content-pipeline`).
- **Base processor conventions**: an abstract `WorkerHost`-style processor base that centralizes structured logging of job start/success/failure and consistent error propagation (so BullMQ retry/backoff engages), to be extended by every downstream processor. A trivial in-change processor exercises the base against a real Redis-backed queue in tests.
- **`@nestjs/schedule` foundation**: register `ScheduleModule.forRoot()` so downstream changes can declare `@Cron` jobs. **No concrete cron** is added here — the SPEC's cleanup/staleness crons are each owned by their feature change.
- **Typed scrapper HTTP client**: a `ScrapperModule` exposing an injectable, typed client that calls the `amerkurev/scrapper` sidecar over HTTP to fetch and clean a page into text/markdown, with a configurable base URL, timeout, and error mapping. This is the fetch primitive `content-pipeline` (and `cert-setup-grounding`) build on; this change ships the client and its contract, not any source-type fetch strategy.

No domain entity and no migration are introduced (per the roadmap entity-ownership table, `worker-foundation` owns no entity). No content chunking, embeddings, domain tagging, or `ContentSource`/`ContentChunk` work — that is `content-pipeline`. No Prometheus `/metrics`, OTEL, Pino, or Sentry wiring — that belongs to `observability` (which depends on this change).

## Capabilities

### New Capabilities
- `worker-runtime`: headless NestJS application-context bootstrap for `apps/worker` — fail-fast `@nestjs/config` + Zod env validation reusing `@readion/shared` helpers, `DbModule` import, shared `ioredis` connection provider, `@nestjs/schedule` root registration, and graceful shutdown. No HTTP server.
- `job-queue`: BullMQ foundation on the shared Redis connection — a reusable per-source-type queue registration helper with the project's default job options (exponential-backoff retries, job-event emission for admin status), an abstract base processor (structured logging + consistent error/retry propagation), and the typed scrapper HTTP client used to fetch and clean source content.

### Modified Capabilities
<!-- None — this change introduces foundation capabilities only. -->

## Impact

- **Code**: `apps/worker/src` — new `main.ts` bootstrap (application context + shutdown hooks), `app.module.ts` root wiring (`ConfigModule`, `DbModule`, `RedisModule`, `BullModule` root, `ScheduleModule.forRoot()`), `src/config/` (Zod env schema + typed config), `src/redis/` (shared `ioredis` provider), `src/queue/` (queue-registration helper + default job options + abstract base processor), `src/scrapper/` (typed HTTP client module). Removes the scaffold's empty `AppModule`/`console.log` remnants.
- **Dependencies (apps/worker)**: `@nestjs/config`, `zod`, `@nestjs/bullmq` (+ `bullmq`), `ioredis`, `@nestjs/schedule`, an HTTP client for the scrapper (`undici`/native `fetch` or `@nestjs/axios`). Consumes existing `@readion/shared` (env helpers) and `@readion/db` (`DbModule`, Testcontainers harness).
- **Database**: none — no entity, no migration. The worker imports `DbModule` to share the ORM connection; the schema is owned by `db-foundation` and the entity-owning changes.
- **Entities owned**: none (per the roadmap entity-ownership table).
- **Cross-cutting**: provides the `@nestjs/schedule` + BullMQ *foundation* that the SPEC's worker-side crons (account hard-purge → `users`, session abandonment → `sessions`, agent TTL → `agent`, mock auto-submit → `mock-exam`, superseded-chunk delete → `chunk-lifecycle`, stale-source re-ingestion → `content-pipeline`, weekly digest → `email-lifecycle`) plug into. No concrete cron and no feature-emitted metric is attributed to this change.
- **Out of scope (owned elsewhere)**: per-source fetch strategies, chunking, domain tagging, embeddings, pgvector upsert, and all concrete ingestion queues (`content-pipeline`); the concrete cleanup/staleness crons (their owning feature changes); Prometheus/OTEL/Pino/Sentry across the worker (`observability`); the LLM/AI provider config group (`llm-foundation` and `content-pipeline` extend the Zod schema).
- **Depends on**: `shared-contracts` (archived) and `db-foundation` (archived).
- **Unblocks**: `observability`, `content-pipeline`, and transitively every worker-side cron and the rest of the content pipeline.
