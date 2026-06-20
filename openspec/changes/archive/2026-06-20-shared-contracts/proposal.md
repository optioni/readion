## Why

Every NestJS module (`apps/api`, `apps/worker`) and the Nuxt frontend (`apps/web`) need to agree on the same wire contracts — the response envelope, the error format, pagination, and the shape of validated environment config — before any feature can be built. Defining these once in `packages/shared` prevents each module from inventing its own envelope or error shape and gives Orval a single, stable set of generic DTOs to generate the typed client from. This is the first platform primitive on the critical path: `api-foundation` and `worker-foundation` both depend on it.

## What Changes

- Add **response envelope** generic types/DTOs to `packages/shared`: single-resource `{ data, relationships }`, paginated collection `{ data[], meta }`, the `relationships` block (each relation an `{ href, data? }` with an independently optional/nullable `data`), and the `meta` pagination shape (`total`, `page`, `limit`).
- Add **RFC 7807 Problem Details** types: `{ type, title, status, detail, errors[] }`, including the per-field validation `errors` item shape, plus a small registry of error `type` slugs (e.g. `/errors/validation-error`) so codes stay consistent across modules.
- Add **pagination contract** constants and a query-params type: default page size `25`, max `100`, used to validate `?limit=` / `?page=` consistently.
- Add **env-schema helpers**: Zod-based building blocks for the per-app config schemas (`apps/api`, `apps/worker`) plus shared env var definitions, so each app composes its validated config from the same primitives and fails fast at boot.
- Add **shared constants** that are part of the cross-app contract (pagination limits, error-type slugs) and export everything from a single package entrypoint.

These are pure types, DTOs, Zod schemas, and constants — no runtime services, no HTTP, no DB. The interceptor/filter that *enforce* these contracts live in `api-foundation`; this change only defines the shapes they conform to.

## Capabilities

### New Capabilities
- `response-envelope`: The JSON:API-inspired response contract — single-resource and paginated-collection envelopes, the `relationships` block with optional `?include=` expansion, the pagination `meta` shape, and pagination defaults/limits — as shared generic types/DTOs.
- `problem-details`: The RFC 7807 error contract — the Problem Details object, the per-field validation error item, and the registry of error `type` slugs — as shared types/constants.
- `env-schema`: Reusable Zod env-validation helpers and shared env var definitions that each app's `@nestjs/config` schema composes from, enforcing fail-fast validation at startup.

### Modified Capabilities

(none — no existing spec's requirements change)

## Impact

- **`packages/shared`** — new modules for envelope DTOs, problem-details types, pagination constants, and env-schema helpers, all re-exported from `src/index.ts`. Adds a `zod` dependency.
- **Downstream consumers** — `api-foundation` (`ResponseInterceptor`, `ExceptionFilter`, Zod config), `worker-foundation` (Zod config), and `web-foundation` (Orval-generated client) all import these contracts. None exist yet; this change unblocks them.
- **Tooling** — Orval will generate the typed client against an OpenAPI spec whose generic wrappers derive from these DTOs; keeping them in one place keeps the generated client stable.
- No API endpoints, no database, no migrations.
