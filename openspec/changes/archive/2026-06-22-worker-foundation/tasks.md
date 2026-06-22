## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Add `apps/worker` deps (`@nestjs/config`, `zod`, `@nestjs/bullmq`, `bullmq`, `ioredis`, `@nestjs/schedule`, and the scrapper HTTP client dep — native `fetch`/`undici` or `@nestjs/axios`). No Redis/DB mocking — acceptance tests use real Testcontainers per design.md Test Boundaries (reuse the `@readion/db` Postgres harness; start a real `redis` container); the scrapper sidecar is an in-process HTTP stub server
- [x] 0.2 Write the failing acceptance integration test (`*.spec.ts`, co-located under `apps/worker/src`): boot the worker application context via `@nestjs/testing` with real Postgres (via `@readion/db` harness) + real Redis, register a trivial test queue + processor through the queue helper, add a job, and assert — (a) the context resolves `ConfigModule`/`DbModule`/`RedisModule`/BullMQ root/`SchedulerRegistry` and exposes no HTTP listener (`worker-runtime`); (b) the shared `ioredis` client answers `PING` and the queue connects through it (`worker-runtime`, `job-queue`); (c) the enqueued job is consumed by the base-derived processor to `completed` and a `completed` `QueueEvents` event fires with the job id (`job-queue`); (d) the scrapper client returns cleaned content from the stub and maps a 500 to a typed error (`job-queue`)
- [x] 0.3 Confirm it fails for the right reason (missing config/redis/queue/processor/scrapper wiring — not a container or import setup error)

## 1. Configuration & Zod Env Schema

- [x] 1.1 RED: Unit test the worker env schema — parsing a valid env object (`DATABASE_URL`, `REDIS_URL`, `SCRAPPER_URL`, `NODE_ENV`) yields typed values with `NODE_ENV` defaulting to `development`; a missing `REDIS_URL` and a malformed `SCRAPPER_URL` (`"not-a-url"`) each throw an error naming the offending variable (`worker-runtime` scenarios "Valid config exposes typed values", "Boot fails when a required variable is missing", "Boot fails when a URL variable is malformed")
- [x] 1.2 GREEN: Implement `src/config/` — Zod schema composing `@readion/shared` `databaseUrlFragment`/`redisUrlFragment` plus `SCRAPPER_URL` (`zodRequiredUrl`) and `NODE_ENV`; register `@nestjs/config` with `validate` and a typed config accessor
- [x] 1.3 REFACTOR: Centralize defaults/constants; ensure strict typing (no `any`) and additive extensibility for downstream changes

## 2. Shared Redis Connection Provider

- [x] 2.1 RED: Integration test — a `RedisModule` exposes a `REDIS_CLIENT` (`ioredis`) provider resolvable in an `@nestjs/testing` module against the test Redis container and answers `PING` with `PONG` (`worker-runtime` scenario "Redis client is injectable and responds to PING")
- [x] 2.2 GREEN: Implement `src/redis/` — a single shared `ioredis` client provider built from the validated `REDIS_URL`, injectable by BullMQ and later worker code
- [x] 2.3 REFACTOR: Quit the client on module destroy and assert it reaches an `end` state on shutdown (`worker-runtime` scenario "Connection is closed on shutdown"); export the injection token

## 3. Scrapper HTTP Client

- [x] 3.1 RED: Integration test against an in-process HTTP stub server — a successful 200 returns a typed result exposing cleaned text/markdown + the source URL; a 500 (and a timeout) reject with a typed `ScrapperError` carrying the failed URL and status/cause; the outbound request targets the configured `SCRAPPER_URL` base (`job-queue` scenarios "Successful fetch returns cleaned content", "Upstream error becomes a typed client error", "Base URL comes from validated config")
- [x] 3.2 GREEN: Implement `src/scrapper/` — `ScrapperModule` + injectable `ScrapperClient` over `fetch`/`undici` with config-driven base URL + request timeout and a typed `ScrapperError` mapping for non-2xx/timeout/transport failures
- [x] 3.3 REFACTOR: Extract the response-parsing and error-mapping helpers as pure, tested functions; ensure no raw HTTP failure leaks to callers

## 4. Queue Default Options & Registration Helper

- [x] 4.1 RED: Unit test the default-job-options builder — defaults specify `attempts` > 1 and `backoff.type: "exponential"` with a non-zero delay plus `removeOnComplete`/`removeOnFail` retention bounds; an explicit `attempts` override is honored while the exponential-backoff strategy is still inherited (`job-queue` scenarios "Registered queue carries exponential-backoff defaults", "Per-queue overrides are honored")
- [x] 4.2 GREEN: Implement `src/queue/` — a default-options constant/builder and a `registerSourceQueue(name, overrides?)` wrapper over `BullModule.registerQueue` that injects the defaults and merges overrides
- [x] 4.3 REFACTOR: Centralize the defaults as named constants; keep the helper additively typed for per-source-type queues

## 5. Abstract Base Processor

- [x] 5.1 RED: Unit/integration test — a concrete processor extending the base logs structured "started"/"completed" entries (with queue name + job id) on success, and on a thrown `handle` logs a structured "failed" entry (job id + error message) and re-throws so BullMQ retries (`job-queue` scenarios "Base logs the job lifecycle", "Handler errors propagate to BullMQ")
- [x] 5.2 GREEN: Implement the abstract base processor over `@nestjs/bullmq` `WorkerHost` — wrap the subclass `handle(job)` with start/success/failure structured `Logger` calls and re-throw on error
- [x] 5.3 REFACTOR: Keep logging behind the standard NestJS `Logger` interface (so `observability` can swap the transport); ensure the typed `handle` signature is the only required override

## 6. BullMQ Root, Retry & Job Events

- [x] 6.1 RED: Integration test against real Redis — `BullModule.forRootAsync` reuses the shared `REDIS_CLIENT`; a helper-registered queue's job is readable from that same Redis; a processor that throws on the first execution with `attempts: 3` is re-enqueued with increasing delay and only marked `failed` after the third attempt; a `completed` event fires with the job id and a `failed` event carries the job id + failure reason (`job-queue` scenarios "Queues use the shared connection", "A failing job is retried before being marked failed", "Completed event fires with the job id", "Failed event carries the failure reason", "Concrete processor consumes an enqueued job end-to-end")
- [x] 6.2 GREEN: Configure the BullMQ root against the shared Redis connection; wire `QueueEvents` (`completed`/`failed`/`progress`) carrying job id + failure reason for the helper-registered queue
- [x] 6.3 REFACTOR: Isolate Redis keys / unique queue names between cases; use a small backoff base and assert on `attemptsMade` + terminal state rather than wall-clock timing

## 7. Scheduling Foundation

- [x] 7.1 RED: Integration test — the worker context resolves `@nestjs/schedule` `SchedulerRegistry` and reports zero registered cron jobs (`worker-runtime` scenario "Schedule registry is available")
- [x] 7.2 GREEN: Register `ScheduleModule.forRoot()` at the root; add no concrete cron
- [x] 7.3 REFACTOR: Confirm no stray `@Cron` is defined; document that downstream changes add their crons here

## 8. Bootstrap & Root Wiring

- [x] 8.1 RED: Acceptance assertions — the worker boots as an application context with no HTTP listener / no bound port; `app.close()` quits the shared Redis connection and closes the MikroORM connection without throwing; no worker-owned migration is added (`worker-runtime` scenarios "Boot exposes no HTTP listener", "Application context resolves the root module", "Shutdown hooks close connections", "EntityManager is resolvable in the worker context", "No worker-owned migration is added")
- [x] 8.2 GREEN: Wire `main.ts` (`createApplicationContext` + `enableShutdownHooks`) and `app.module.ts` — import `ConfigModule`, `DbModule`, `RedisModule`, BullMQ root, `ScheduleModule.forRoot()`, `ScrapperModule`, queue module; replace the scaffold `console.log` readiness signal with a structured `Logger` log
- [x] 8.3 REFACTOR: Remove the scaffold's empty `AppModule` remnants; ensure strict-mode typing and absolute-path (alias) imports throughout; update `apps/worker/.env.example` to the validated variables (`DATABASE_URL`, `REDIS_URL`, `SCRAPPER_URL`, `NODE_ENV`)

## 9. Acceptance Test — Outer Loop GREEN

- [x] 9.1 Confirm the acceptance test passes end-to-end against real Postgres + Redis with the scrapper stub
- [x] 9.2 REFACTOR: Clean up the test harness (shared container setup, Redis key isolation, stub server lifecycle) and remove duplication

## 10. Change Review — Subagent Verification

- [x] 10.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only by severity — CRITICAL/WARNING/SUGGESTION — and does not edit code)
- [x] 10.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 11. Polish

- [x] 11.1 Run linter and fix all errors (`yarn lint`)
- [x] 11.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 11.3 Run type checker with zero errors (`yarn workspace @readion/worker typecheck`)
- [x] 11.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace @readion/worker test:coverage`)
