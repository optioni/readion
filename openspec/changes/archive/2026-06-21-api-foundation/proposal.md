## Why

The scaffold left `apps/api` as a bare NestJS "hello world" — no global response envelope, no RFC 7807 error formatting, no validated config, no security middleware, no rate limiting, no health probe, and no OpenAPI/Orval pipeline. Every downstream module change (auth, certifications, sessions, agent…) assumes these cross-cutting platform primitives already exist: that a controller can return a plain object and the envelope is applied for it, that a thrown `HttpException` becomes a Problem Details body, that the app fails fast on bad config, and that the web app can generate a typed client. This change stands up that API runtime once so every later change builds on it instead of reinventing it.

## What Changes

- **Bootstrap the API runtime**: global `/api/v1` versioning prefix, a global `ResponseInterceptor` that wraps controller return values in the shared single-resource (`{ data, relationships }`) and collection (`{ data[], meta }`) envelopes, and a global RFC 7807 `ExceptionFilter` that formats every thrown `HttpException` (and unhandled error) into a `ProblemDetails` body using the shared `ERROR_TYPES`. Wire the global `ValidationPipe` (`class-validator` / `class-transformer`, whitelist + transform).
- **Validated configuration**: `@nestjs/config` loaded with a Zod schema for `apps/api` that fails fast at boot on missing/malformed env. This change establishes the base schema with the groups it actually consumes (database URL, Redis URL, CORS origins, rate-limit overrides, app port/environment); downstream changes (auth, mail, llm…) extend this schema with their own groups.
- **Security middleware**: `helmet` applied globally (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy), with CSP configured to permit SSE from the API origin and assets from the Nuxt frontend. CORS restricted to the configured frontend origin (`http://localhost:3000` in dev), credentials enabled for the httpOnly-cookie auth that follows.
- **Rate limiting**: `@nestjs/throttler` backed by the existing Redis instance, applied as a global guard with named tiers and per-route override decorators — strict auth tier (10 req / 15 min per IP), agent-SSE tier (30 req / min per user), and general tier (300 req / min per user). This change wires the guard + tiers; the auth/agent changes attach the strict tiers to their routes.
- **Health checks**: `@nestjs/terminus` exposing `GET /health` with PostgreSQL connectivity (via `DbModule` from `db-foundation`), Redis connectivity, and a disk-storage threshold check — consumable as k8s liveness/readiness probes.
- **OpenAPI + Orval pipeline**: `@nestjs/swagger` generating the OpenAPI document, served as raw JSON at `/api-json` in development only (Swagger and `/api-json` disabled in production). An Orval config + `yarn codegen` script that reads `/api-json` and generates the typed `@tanstack/vue-query` client into `apps/web/src/api/`, committed to the repo (CI consumes the committed output, never regenerates).

No domain entity and no migration are introduced (per the roadmap entity-ownership table, `api-foundation` owns no entity). No Prometheus `/metrics`, OTEL, Pino, or Sentry wiring — those belong to the `observability` change; this change's only observability surface is the terminus `/health` probe.

## Capabilities

### New Capabilities
- `api-runtime`: NestJS bootstrap — global `/api/v1` prefix, global `ResponseInterceptor` (single + collection envelopes), global RFC 7807 `ExceptionFilter`, global `ValidationPipe`, and `@nestjs/config` + Zod env validation with fail-fast boot.
- `security-middleware`: `helmet` security headers (CSP/HSTS/X-Frame-Options/X-Content-Type-Options/Referrer-Policy) and CORS restricted to the configured frontend origin with credentials.
- `rate-limiting`: `@nestjs/throttler` with Redis storage, applied globally with named tiers (auth / agent-SSE / general) and per-route override decorators.
- `health-checks`: `@nestjs/terminus` `GET /health` with Postgres, Redis, and disk-storage checks for k8s probes.
- `openapi-client`: `@nestjs/swagger` OpenAPI generation with dev-only `/api-json`, and the committed Orval typed-client pipeline (`yarn codegen`).

### Modified Capabilities
<!-- None — this change introduces foundation capabilities only. -->

## Impact

- **Code**: `apps/api/src` — new `main.ts` bootstrap wiring, `app.module.ts` global providers, `src/config/` (Zod env schema + config module), `src/common/interceptors/response.interceptor.ts`, `src/common/filters/problem-details.filter.ts`, `src/common/middleware`/helmet+CORS bootstrap, `src/throttler/` tier definitions + override decorators, `src/health/` terminus module + controller, `src/redis/` connection provider (shared by throttler + health). New root `orval.config.ts` + `yarn codegen` script; generated client committed under `apps/web/src/api/`.
- **Dependencies (apps/api)**: `@nestjs/config`, `zod`, `@nestjs/throttler` + Redis storage adapter, `ioredis`, `helmet`, `@nestjs/terminus`, `@nestjs/swagger`, `class-validator`, `class-transformer`. Root dev dep: `orval`. Consumes existing `@readion/shared` (envelopes, problem-details, env helpers) and `@readion/db` (`DbModule`).
- **Database**: none — no entity, no migration. The Postgres health check uses the existing `DbModule` connection.
- **Entities owned**: none (per the roadmap entity-ownership table).
- **Cross-cutting**: no worker cron and no feature-emitted metrics attributed to this change. Prometheus/OTEL/Pino/Sentry infrastructure is owned by `observability`.
- **Out of scope (owned elsewhere)**: per-route strict throttler attachment for auth/agent (`auth`, `agent`); the boot-time embedding-dimension-vs-column check (`llm-foundation`/`content-pipeline`); JWT/AI/email/Sentry config groups (their owning changes extend the Zod schema); the Nuxt-side vue-query plugin wiring that consumes the generated client (`web-foundation`).
- **Depends on**: `shared-contracts` (archived) and `db-foundation` (archived).
- **Unblocks**: `observability`, `web-foundation`, `mail`, `auth`, `certifications`, `llm-foundation`, and transitively the rest of the API surface.
