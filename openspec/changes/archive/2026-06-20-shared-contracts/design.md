## Context

`packages/shared` currently holds only two placeholder constants (`APP_NAME`, `APP_VERSION`). Three downstream platform changes — `api-foundation`, `worker-foundation`, `web-foundation` — all need agreed-upon wire contracts before they can be built: the JSON:API-inspired response envelope, the RFC 7807 error shape, pagination rules, and the Zod env-validation primitives each app's `@nestjs/config` schema composes from. `api-foundation` will additionally feed these generic DTOs into `@nestjs/swagger` → Orval so the committed frontend client derives from the same wrappers.

This change defines those contracts as pure types, DTOs, Zod schemas, and constants — no runtime services, HTTP, or DB. The shapes must survive being turned into a stable OpenAPI spec by Orval, and must be importable by both NestJS and plain TypeScript consumers.

## Goals / Non-Goals

**Goals:**
- One canonical definition of the single-resource envelope, paginated-collection envelope, relationships block, and pagination meta.
- One canonical RFC 7807 Problem Details type plus a named, const-asserted registry of error `type` slugs.
- Pure Zod env-validation helpers and shared env var fragments that `apps/api` and `apps/worker` compose into their own schemas.
- Everything re-exported from `packages/shared/src/index.ts`, strict-mode clean, no `any`, ≥80% coverage.

**Non-Goals:**
- The `ResponseInterceptor` and `ExceptionFilter` that *enforce* these contracts — those live in `api-foundation`.
- The full per-app env schemas — this change ships the building blocks; each app assembles its own.
- Sparse fieldsets (explicitly YAGNI in SPEC for v1).
- Concrete resource DTOs (Certification, Session, etc.) — owned by feature changes.

## Test Boundaries

This is a pure library package: there are no external collaborators to mock. The "acceptance test" is the package's public API exercised through its single entrypoint (`src/index.ts`); unit tests target each module directly. Type-level guarantees are asserted with `expectTypeOf` / `assertType` from Vitest.

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| `src/index.ts` public exports | real (import from package root) | n/a (units import modules directly) |
| Zod | real (no mock) | real (no mock) |
| Type relationships | `expectTypeOf` assertions | `expectTypeOf` assertions |
| Filesystem / network / DB | none — package performs no I/O | none |
| `process.env` | not read — helpers receive plain objects passed by the caller | not read |

The env helpers are pure parsers: tests pass plain objects to `.parse()`/`.safeParse()` rather than mutating `process.env`, keeping tests isolated and side-effect-free.

## Decisions

**Generic types vs. NestJS class DTOs.** Swagger needs decorated classes; plain consumers want structural types. Decision: express envelopes as generic TypeScript types in `packages/shared`; let `api-foundation` provide thin `@ApiProperty`-decorated wrappers referencing them. Keeps `packages/shared` free of a hard `@nestjs/swagger` dependency. Alternative — decorated classes here — rejected: couples shared to NestJS and drags Swagger into worker/web.

**Single envelope type per resource for `?include=`.** Per SPEC, each relationship's `data` is independently optional/nullable so one schema covers all `2ⁿ` include combinations. Decision: model `relationships` as `Record<string, { href: string; data?: T | T[] | null }>`. Alternative — distinct type per include combination — rejected as combinatorially unscalable (called out explicitly in SPEC).

**Zod for env, exported as composable fragments.** Decision: ship small Zod helpers (required URL, coerced number/port, coerced boolean) plus shared var fragments (DB URL, Redis URL) rather than one monolithic schema. Each app does `z.object({ ...sharedDb, ...sharedRedis, ...appSpecific })`. Zod is already the project standard for config.

**Error type slugs as a const registry.** Decision: a `const`-asserted `ERROR_TYPES` object so `type` values are referenced by name with literal types and autocomplete. Misspellings fail to type-check.

**Pagination constants.** `PAGE_SIZE_DEFAULT = 25`, `PAGE_SIZE_MAX = 100` as named exports, consumed by request validation in `api-foundation`.

## Risks / Trade-offs

- Orval/Swagger can't infer generics directly → `api-foundation` owns decorated concrete wrappers mirroring these generic types; small manual sync cost accepted to avoid coupling shared to Swagger.
- Adding `zod` as a runtime dependency of `packages/shared` → acceptable; Zod is already a core dependency and the helpers are inert until called.
- Contract drift if a feature change quietly reshapes an envelope → mitigated by these being the single imported source; any change forces an explicit edit here and re-review.

## Open Questions

None blocking. The set of shared env var fragments will grow as later changes add config groups; this change seeds the common ones (DB, Redis) and the helper primitives.
