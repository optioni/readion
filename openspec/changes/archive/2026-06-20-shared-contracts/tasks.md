## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Add `zod` to `packages/shared` and confirm Vitest runs co-located `*.spec.ts` (no new external mocks needed — pure package)
- [x] 0.2 RED: Write `packages/shared/src/contracts.acceptance.spec.ts` that imports only from the package root (`./index`) and asserts the full contract surface: envelope wrapping (single + collection), relationships optional/include, `PAGE_SIZE_DEFAULT === 25` / `PAGE_SIZE_MAX === 100`, `ProblemDetails` + field error, `ERROR_TYPES.VALIDATION === '/errors/validation-error'`, and env helpers parsing valid/invalid input — using `expectTypeOf` for type-level scenarios
- [x] 0.3 Confirm the acceptance test fails because the symbols are not exported yet (not due to a setup/import error)

## 1. Response envelope

- [x] 1.1 RED: Unit-test the relationships type — `href` required, `data` optional/nullable, single-reference and array forms (`expectTypeOf`)
- [x] 1.2 GREEN: Define `SingleResourceEnvelope<T>`, the relationships record `{ href: string; data?: R | R[] | null }`, and `CollectionEnvelope<T>` with `meta` (`total`, `page`, `limit`) in `src/envelope/`
- [x] 1.3 REFACTOR: Factor shared reference/meta types; ensure no `any`

## 2. Pagination contract

- [x] 2.1 RED: Unit-test `PAGE_SIZE_DEFAULT === 25`, `PAGE_SIZE_MAX === 100`, and the `page`/`limit` query-params type
- [x] 2.2 GREEN: Define the pagination constants and query-params type in `src/pagination/`
- [x] 2.3 REFACTOR: Clean up if needed

## 3. Problem Details

- [x] 3.1 RED: Unit-test `ProblemDetails` (minimal + with `errors`), the validation error item, and `ERROR_TYPES` const-asserted slugs (literal types, `VALIDATION === '/errors/validation-error'`)
- [x] 3.2 GREEN: Define `ProblemDetails`, the field-level validation error item, and the `ERROR_TYPES` registry in `src/problem-details/`
- [x] 3.3 REFACTOR: Ensure slug values are literal-typed via `as const`

## 4. Env-schema helpers

- [x] 4.1 RED: Unit-test the Zod helpers — required URL accepts valid / rejects malformed, coerced number from `'9090'`, coerced boolean; composing DB+Redis fragments parses a valid object; missing-required names the var; both offenders reported on multi-failure
- [x] 4.2 GREEN: Implement the pure Zod helper primitives and the shared DB/Redis URL fragments in `src/env/`
- [x] 4.3 REFACTOR: De-duplicate helper construction; confirm helpers perform no I/O and do not read `process.env`

## 5. Acceptance Test — Outer Loop GREEN

- [x] 5.1 Re-export all new types, constants, and helpers from `src/index.ts` (keep existing `APP_NAME`/`APP_VERSION`)
- [x] 5.2 Confirm the acceptance test from 0.2 passes end-to-end against the package root
- [x] 5.3 REFACTOR: Clean up test setup and shared test fixtures if needed

## 6. Change Review — Subagent Verification

- [x] 6.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit)
- [x] 6.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per acceptance), note SUGGESTIONs; re-run affected tests

## 7. Polish

- [x] 7.1 Run lint — zero errors
- [x] 7.2 Run formatter — zero errors
- [x] 7.3 Run type checker — zero errors
- [x] 7.4 Run coverage report — meets ≥80% threshold on lines, branches, functions
