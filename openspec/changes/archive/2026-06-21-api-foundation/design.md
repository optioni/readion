## Context

`apps/api` exists only as the scaffold's "hello world" NestJS app (`AppModule` + `AppController` + `main.ts`). `packages/shared` already exports the contract types this change consumes — `SingleResourceEnvelope`, `CollectionEnvelope`, `ProblemDetails`/`ValidationErrorItem`, `ERROR_TYPES`, `PAGE_SIZE_DEFAULT`/`PAGE_SIZE_MAX`, and the Zod env helpers — and `packages/db` exposes a global `DbModule` over a Testcontainers-backed Postgres+pgvector. This change wires the NestJS runtime that turns those contracts into enforced HTTP behaviour and exposes the OpenAPI surface the frontend's Orval client generates against.

This is the first change to introduce a Redis dependency in `apps/api`: both the throttler store and the `/health` Redis check need a single shared `ioredis` connection. Per the roadmap, `api-foundation` owns no entity and no migration; the Postgres health check reuses `DbModule`'s connection rather than opening its own.

## Goals / Non-Goals

**Goals:**
- A bootable `apps/api` where controllers return plain objects and the global `ResponseInterceptor` + `ExceptionFilter` enforce the JSON:API envelope and RFC 7807 errors from `@readion/shared`.
- Fail-fast `@nestjs/config` + Zod env validation establishing the base `apps/api` schema (DB, Redis, CORS, throttler, port/env), extensible by downstream changes.
- Global `helmet`, CORS, and Redis-backed `@nestjs/throttler` with the three SPEC tiers and per-route overrides.
- `@nestjs/terminus` `GET /health` (Postgres + Redis + disk) usable as k8s probes.
- `@nestjs/swagger` OpenAPI doc, dev-only `/api-json`, and a committed Orval `yarn codegen` pipeline producing `apps/web/src/api/`.

**Non-Goals:**
- Prometheus `/metrics`, OpenTelemetry, Pino logging, and Sentry — owned by `observability`.
- Any domain entity, migration, or business module (auth, certs, etc.).
- Attaching the strict `auth`/`agent` throttler tiers to real routes — owned by `auth`/`agent`; this change ships the tiers + override decorator and proves them against test handlers.
- The Nuxt-side vue-query plugin wiring that consumes the generated client — owned by `web-foundation`.
- JWT/AI/email/Sentry config groups — their owning changes extend the Zod schema additively.

## Test Boundaries

Per CLAUDE.md, integration tests hit real Postgres and Redis via Testcontainers — never mock the database. Redis is a real dependency here (throttler store + health check), so it is a real Testcontainers container in the acceptance test. The acceptance layer boots the Nest app with `@nestjs/testing` and fires HTTP via Supertest.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (via `DbModule`) | real (Testcontainers `pgvector/pgvector:pg17`, reusing `@readion/db` harness) | not used (pure logic only) |
| Redis (throttler store + health check) | real (Testcontainers `redis`) | not used |
| HTTP layer (Supertest) | real (in-process Nest app over `@nestjs/testing`) | n/a |
| `ResponseInterceptor` / `ExceptionFilter` shaping | real (asserted on live responses) | real (pure transform unit tests on sample values) |
| Zod env schema | real (parse sample env objects) | real (parse valid/invalid env objects — no process boot) |
| Orval codegen | not exercised at runtime (config presence + script wiring asserted) | n/a |

## Decisions

- **Reuse `@readion/shared` contracts verbatim.** The interceptor and filter import `SingleResourceEnvelope`/`CollectionEnvelope`/`ProblemDetails`/`ERROR_TYPES` rather than redefining shapes. *Alternative:* local DTOs in `apps/api`. *Why:* the shared package is the single source of truth and the same types feed Orval; duplicating them invites drift.
- **Envelope detection via a top-level `data` key + a collection marker.** The interceptor passes through any value already containing `data` (avoids double-wrapping), wraps bare arrays/paginated results into `{ data, meta }`, and wraps everything else into `{ data }`. A small `CollectionResult` carrier (items + `{ total, page, limit }`) lets controllers signal "this is a collection" explicitly. *Alternative:* a `@Collection()` decorator + reflection. *Why:* an explicit carrier is simpler to unit-test as a pure transform and avoids metadata plumbing for the foundation.
- **Single shared `ioredis` connection provider.** One `REDIS_CLIENT` provider in a `RedisModule` is injected by both the throttler storage adapter and the terminus Redis health indicator. *Alternative:* separate connections per consumer. *Why:* one connection is cheaper and the health check then reflects the exact connection the throttler relies on.
- **Throttler tiers as named throttlers from config.** Configure `@nestjs/throttler` with three named throttlers (`auth`, `agent`, `general`) sourced from validated env with SPEC defaults (10/15min, 30/min, 300/min); register the guard globally so `general` is the default; expose a thin `@Throttle`-based override (e.g. `AuthThrottle()`/`AgentThrottle()`) for downstream routes. *Alternative:* a single default + ad-hoc decorators later. *Why:* pre-naming the tiers keeps auth/agent changes from inventing inconsistent limits, mirroring the roadmap's pre-naming discipline.
- **Throttler 429 + helmet/CORS flow through the same `ExceptionFilter`.** The 429 is rendered as RFC 7807 with a `Retry-After` header so error shape is uniform. *Why:* one error contract across the whole API.
- **Dev-gated OpenAPI.** `@nestjs/swagger` document is built unconditionally (so it's testable without HTTP), but `/api-json` + Swagger UI are mounted only when `NODE_ENV !== production`. *Why:* SPEC requires `/api-json` dev-only; building the doc in-process keeps the OpenAPI test fast and server-free.
- **Health endpoint outside the version prefix and unauthenticated.** `setGlobalPrefix('api/v1')` excludes `health` and `api-json`. *Why:* k8s probes target a stable `/health`, and the auth guard doesn't exist yet — but even once it does, `/health` stays public.

## Risks / Trade-offs

- **Two Testcontainers (Postgres + Redis) per acceptance run slow boot.** → Reuse the `@readion/db` harness for Postgres and start one shared Redis container per suite; keep Redis-touching assertions in a single acceptance spec.
- **Throttler counters in Redis can make rate-limit tests flaky/order-dependent.** → Use isolated key prefixes (or `flushdb` between cases) and assert tier behaviour with deterministic request counts rather than timing.
- **Orval needs a running API to read `/api-json`.** → Keep `yarn codegen` a developer-run step (per SPEC, not in CI); tests assert config + script wiring, not a live generation, so the suite stays hermetic.
- **CSP too strict could block SSE or frontend assets later.** → Derive `connect-src`/`default-src` from the configured origins (self + frontend) so the agent SSE channel and Nuxt assets are explicitly allowed.

## Open Questions

- Redis client library: `ioredis` is assumed (it's also what BullMQ/`worker-foundation` will use); confirm a single shared client vs. a throttler-specific store package at implementation time.
- Disk-storage threshold value and path for the terminus disk check — pick a sensible default (e.g. 90% of the app volume) and expose it as config if it proves environment-specific.
