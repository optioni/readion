## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the e2e/integration harness per design.md Test Boundaries: real Testcontainers Postgres, real `quiz` + `user-certifications` + `weak-areas` modules wired into the Nest test app; no Redis/LLM mocks needed (not used by this change)
- [x] 0.2 Write failing Playwright e2e (`apps/web/e2e/`): an enrolled user answers quiz questions across two domains, then `GET /api/v1/user-certifications/:id/weak-areas` returns the ranked list weakest-first ("Weakest domain is returned first")
- [x] 0.3 Confirm it fails for the right reason — endpoint/module absent, not a harness/setup error

## 1. WeakArea entity + migration (deepest data layer)

- [x] 1.1 RED: Write integration test asserting the migration creates a `weak_area` table with the `UserCertification` FK, `domain`, `score`, `accuracy`, `mean_confidence`, `response_count` columns and a unique (`user_certification_id`, `domain`) constraint ("Migration creates the weak_area table", "A weak area belongs to exactly one enrollment and domain")
- [x] 1.2 GREEN: Add the `WeakArea` MikroORM entity in `packages/db` (scoped to `UserCertification`, unique on enrollment+domain, columns for score/accuracy/meanConfidence/responseCount) and generate its creation migration
- [x] 1.3 REFACTOR: Align entity with base-entity conventions and absolute-path imports

## 2. Scoring function (pure logic)

- [x] 2.1 RED: Write unit tests for the pure score function: all-correct confidence-5 > all-correct confidence-1; all-wrong confidence-5 < all-wrong confidence-1; output bounded 0–100 ("Score combines accuracy and confidence" scenarios)
- [x] 2.2 GREEN: Implement the pure `computeDomainScore(responses)` function (accuracy + confidence blend, no I/O), returning score plus the derived `accuracy`/`meanConfidence`/`responseCount` inputs
- [x] 2.3 REFACTOR: Extract constants for the blend coefficients; keep the function I/O-free

## 3. Recompute service (aggregation over the DB)

- [x] 3.1 RED: Write integration tests for `WeakAreasService.recompute(userCertificationId)`: one row per attributable domain; idempotent re-run; domain with no responses produces/removes no row; responses with an unresolvable source chunk are skipped; newly recorded answers move the row ("Per-domain aggregation", "Recompute trigger surface" scenarios)
- [x] 3.2 GREEN: Implement `recompute` — read the enrollment's `QuizResponse`s, attribute each to a domain via its source chunk `primaryDomain`, group, upsert one `WeakArea` per domain via the scoring function, delete rows for domains with no responses
- [x] 3.3 REFACTOR: Tidy chunk→domain resolution and the upsert/delete reconciliation; tolerate missing chunks

## 4. Read endpoint + ownership scoping

- [x] 4.1 RED: Write integration tests for `GET /api/v1/user-certifications/:id/weak-areas`: ranked weakest-first with tie-break (responseCount desc, then domain asc); empty list on cold start; reflects newly recorded answers via read-through recompute without an explicit recompute call; another user is denied via RFC 7807 ("Ranked weak-area read endpoint scoped to the owner" scenarios)
- [x] 4.2 GREEN: Implement `WeakAreasModule` controller (read-through: recompute then read) + repository-layer enrollment-ownership scoping, returning the collection envelope ranked weakest-first
- [x] 4.3 REFACTOR: Centralize the ranking comparator; ensure ownership scoping reuses the established `auth` pattern

## 5. UserCertification `?include=weakAreas` expansion

- [x] 5.1 RED: Write integration tests: `?include=weakAreas` embeds ranked records under `relationships.weakAreas.data` (each with `id`, `domain`, `score`); without the param only `relationships.weakAreas.href` is present ("Weak areas includable on the UserCertification resource" scenarios)
- [x] 5.2 GREEN: Wire the `weakAreas` relationship into the `UserCertification` resource serializer (href always; `data` only when included)
- [x] 5.3 REFACTOR: Keep a single composable `UserCertification` response schema with the optional/nullable `weakAreas.data`

## 6. API client generation

- [x] 6.1 GREEN: Run `yarn codegen` against the running API and commit the regenerated Orval client for the new endpoint and include shape

## 7. Acceptance Test — Outer Loop GREEN

- [x] 7.1 Confirm the Playwright acceptance test passes end-to-end
- [x] 7.2 Verify all affected apps start in the local environment (smoke test) — boot `apps/api` and `apps/web` and confirm no startup/config errors
- [x] 7.3 REFACTOR: Clean up test setup, fixtures, and shared seed helpers

## 8. Change Review — Subagent Verification

- [x] 8.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 8.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 9. Polish

- [x] 9.1 Run linter and fix all errors (`yarn lint`)
- [x] 9.2 Run formatter and apply fixes (`yarn format`)
- [x] 9.3 Run type checker with zero errors (`yarn workspace apps/api typecheck`)
- [x] 9.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
