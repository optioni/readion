## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Add `apps/api` deps (`@nestjs/config`, `zod`, `@nestjs/throttler`, `@nest-lab/throttler-storage-redis` or equivalent Redis store, `ioredis`, `helmet`, `@nestjs/terminus`, `@nestjs/swagger`, `class-validator`, `class-transformer`) and root dev dep `orval`. No DB/Redis mocking — acceptance tests use real Testcontainers per design.md Test Boundaries (reuse the `@readion/db` Postgres harness; start a real `redis` container)
- [x] 0.2 Write the failing acceptance integration test (`*.spec.ts`, co-located under `apps/api/src`): boot the app via `@nestjs/testing` with real Postgres + Redis, register test-only controllers, and assert via Supertest — (a) a plain-object handler returns `{ data: {...} }` and a collection handler returns `{ data: [...], meta: { total, page, limit } }` (`api-runtime`); (b) a thrown `NotFoundException` yields a 404 `application/problem+json` body with `type: /errors/not-found` (`api-runtime`); (c) `GET /health` returns 200 with postgres/redis/disk up and resolves without the `/api/v1` prefix (`health-checks`); (d) a route annotated with the `auth` tier returns 429 (RFC 7807 + `Retry-After`) past 10 requests (`rate-limiting`); (e) responses carry helmet headers and an allowed `Origin` is echoed with credentials (`security-middleware`); (f) `/api-json` returns the OpenAPI doc in development (`openapi-client`)
- [x] 0.3 Confirm it fails for the right reason (missing interceptor/filter/health/throttler wiring — not a container or import setup error)

## 1. Configuration & Zod Env Schema

- [x] 1.1 RED: Unit test the env schema — parsing a valid env object yields typed values (`PORT` as number); a missing `DATABASE_URL` and a non-numeric `PORT` each throw an error naming the offending variable; defaults resolve (CORS origin `http://localhost:3000`, throttler tier defaults) (`api-runtime` scenarios "Boot fails when a required variable is missing", "Boot fails when a variable is malformed", "Valid config exposes typed values")
- [x] 1.2 GREEN: Implement `src/config/` — Zod schema (database URL, Redis URL, CORS origins, throttler TTL/limit overrides, `PORT`, `NODE_ENV`) reusing `@readion/shared` env helpers; register `@nestjs/config` with `validate` and a typed config accessor
- [x] 1.3 REFACTOR: Centralize defaults as named constants; ensure strict typing (no `any`) and additive extensibility for downstream changes

## 2. Response Envelope Interceptor

- [x] 2.1 RED: Pure unit tests for the transform — plain object → `{ data }`; a collection carrier (items + `{ total, page, limit }`) → `{ data, meta }`; a value already containing a top-level `data` key passes through unchanged (no double-wrap) (`api-runtime` scenarios "Plain object is wrapped in a data envelope", "Already-enveloped value is passed through", "Collection result carries pagination meta")
- [x] 2.2 GREEN: Implement `src/common/interceptors/response.interceptor.ts` using `@readion/shared` `SingleResourceEnvelope`/`CollectionEnvelope`; add the `CollectionResult` carrier type
- [x] 2.3 REFACTOR: Extract envelope-detection helper; export from an `apps/api` common barrel

## 3. RFC 7807 Exception Filter

- [x] 3.1 RED: Pure unit tests — `NotFoundException("...")` maps to `{ type: /errors/not-found, status: 404, ... }`; a non-HTTP `Error` maps to `type: /errors/internal-server-error`, status 500, with no stack trace in `detail`; status code of the response equals the body `status` (`api-runtime` scenarios "NotFoundException becomes a problem-details body", "Unhandled error becomes a 500 problem-details body without leaking internals")
- [x] 3.2 GREEN: Implement `src/common/filters/problem-details.filter.ts` using `@readion/shared` `ProblemDetails` + `ERROR_TYPES`; set `Content-Type: application/problem+json`; map HTTP status → `ERROR_TYPES`
- [x] 3.3 REFACTOR: Centralize status→type mapping; ensure unhandled errors are logged but not leaked

## 4. Global Validation Pipe

- [x] 4.1 RED: Integration assertion (within acceptance harness) — a DTO with a required non-empty `email` rejects `{ email: "" }` with 422 `/errors/validation-error` and an `errors[]` item `{ field: "email", message }`; an unknown property is stripped before the handler (`api-runtime` scenarios "Invalid body yields a 422 validation problem", "Unknown properties are stripped before the handler")
- [x] 4.2 GREEN: Register a global `ValidationPipe` (`whitelist`, `transform`, 422 on failure) and map its errors into `ValidationErrorItem[]` consumed by the problem-details filter
- [x] 4.3 REFACTOR: Extract the class-validator-error → `ValidationErrorItem[]` mapper as a tested pure function

## 5. Redis Connection Provider

- [x] 5.1 RED: Integration test — a `RedisModule` exposes a `REDIS_CLIENT` (`ioredis`) provider resolvable in an `@nestjs/testing` module against the test Redis container and answers `PING`
- [x] 5.2 GREEN: Implement `src/redis/` — a single shared `ioredis` client provider built from validated config, injectable by both the throttler store and the health check
- [x] 5.3 REFACTOR: Ensure graceful shutdown (quit on module destroy); export the injection token

## 6. Rate Limiting (Throttler Tiers + Override)

- [x] 6.1 RED: Unit test the tier config builder — no overrides resolves `auth`=10/15min, `agent`=30/1min, `general`=300/1min; env overrides change TTL/limit; storage targets the shared Redis client (`rate-limiting` scenarios "Counters persist in Redis", "Named tiers carry the documented defaults")
- [x] 6.2 GREEN: Configure `@nestjs/throttler` with the three named throttlers + Redis storage; register the guard globally (general default); implement `src/throttler/` override decorators (`AuthThrottle()`, `AgentThrottle()`)
- [x] 6.3 GREEN: In the acceptance harness, mount a test route with `AuthThrottle()` and assert 429 + `Retry-After` (RFC 7807) past the limit while a general-tier route at the same count succeeds (`rate-limiting` scenarios "Exceeding the general limit yields a 429 problem-details body", "A route annotated with the auth tier uses the strict limit"); isolate Redis keys/flush between cases
- [x] 6.4 REFACTOR: Ensure 429 flows through the problem-details filter; document the override decorators for auth/agent consumers

## 7. Security Middleware (Helmet + CORS)

- [x] 7.1 RED: Within the acceptance harness — assert `X-Content-Type-Options: nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, and a `Content-Security-Policy` whose `connect-src`/`default-src` include self + the configured frontend origin; an allowed `Origin` is echoed with `Access-Control-Allow-Credentials: true`; a disallowed origin is not echoed; an allowed preflight succeeds (`security-middleware` all scenarios)
- [x] 7.2 GREEN: Apply `helmet` in `main.ts` with a CSP derived from configured origins (self for SSE + frontend assets); enable CORS from validated origins with `credentials: true`
- [x] 7.3 REFACTOR: Extract CSP/CORS option builders as pure, config-driven functions

## 8. Health Checks (Terminus)

- [x] 8.1 RED: Acceptance assertions — `GET /health` returns 200 with `postgres`, `redis`, and `disk`/`storage` up when dependencies are reachable; resolves without `/api/v1` and without auth; returns 503 marking `redis` down when Redis is unreachable (`health-checks` all scenarios)
- [x] 8.2 GREEN: Implement `src/health/` — terminus module + controller mounted at `/health` (excluded from the global prefix) with `MikroOrmHealthIndicator` (via `DbModule`), a Redis indicator over `REDIS_CLIENT`, and a disk-storage threshold indicator
- [x] 8.3 REFACTOR: Make the disk threshold/path config-driven with a sensible default

## 9. OpenAPI Document & Dev-Gated /api-json

- [x] 9.1 RED: Unit test the OpenAPI document factory — building against the app module returns a valid OpenAPI 3 doc with title/version and `/api/v1/...` paths present (`openapi-client` scenario "OpenAPI document builds with API metadata"); acceptance: `/api-json` returns 200 in development and 404 in production (`openapi-client` scenarios "api-json available in development", "api-json disabled in production")
- [x] 9.2 GREEN: Build the `@nestjs/swagger` document; mount `/api-json` + Swagger UI only when `NODE_ENV !== production`; describe envelope + problem-details shapes
- [x] 9.3 REFACTOR: Extract the document factory so it is testable without starting the HTTP server

## 10. Orval Typed-Client Pipeline

- [x] 10.1 RED: Unit/config test — the Orval config input resolves to the API `/api-json` spec and the output target is `apps/web/src/api/` producing `@tanstack/vue-query` clients; `yarn codegen` is wired at the workspace root (`openapi-client` scenarios "Orval config targets the API spec and the web client directory", "codegen script is invocable from the workspace root")
- [x] 10.2 GREEN: Add root `orval.config.ts` (vue-query mode, input `/api-json`, output `apps/web/src/api/`) and the `codegen` script; generate and commit the initial client for the `/health` surface — orval.config.ts and codegen script are wired; committed client requires a running API (`yarn workspace apps/api dev` then `yarn codegen`)
- [x] 10.3 REFACTOR: Document in README that `yarn codegen` is a local dev step (CI consumes committed output, never regenerates)

## 11. Bootstrap Wiring

- [x] 11.1 RED: Acceptance assertions — a versioned route is reachable under `/api/v1`, an unprefixed application route returns 404, and `/health`/`/api-json` are exempt from the prefix (`api-runtime` scenarios "Versioned route is reachable under the prefix", "Unprefixed application route is not found", "Health probe is exempt from the version prefix")
- [x] 11.2 GREEN: Wire `main.ts` and `app.module.ts` — `setGlobalPrefix('api/v1')` excluding `health`/`api-json`, register global `ResponseInterceptor`, `ProblemDetailsFilter`, `ValidationPipe`, throttler guard, helmet, CORS; import `ConfigModule`, `DbModule`, `RedisModule`, `HealthModule`
- [x] 11.3 REFACTOR: Remove the scaffold `AppController`/hello-world remnants; ensure strict-mode typing and absolute-path (alias) imports throughout

## 12. Acceptance Test — Outer Loop GREEN

- [x] 12.1 Confirm the acceptance test passes end-to-end against real Postgres + Redis
- [x] 12.2 REFACTOR: Clean up test harness (shared container setup, Redis key isolation) and remove the temporary test-only controllers' duplication

## 13. Change Review — Subagent Verification

- [x] 13.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only by severity — CRITICAL/WARNING/SUGGESTION — and does not edit code)
- [x] 13.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 14. Polish

- [x] 14.1 Run linter and fix all errors (`yarn lint`)
- [x] 14.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 14.3 Run type checker with zero errors (`yarn workspace @readion/api typecheck`)
- [x] 14.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace @readion/api test:coverage`)
