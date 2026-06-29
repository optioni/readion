## 0. Pre-flight + Acceptance Test — Outer Loop RED

- [ ] 0.0 Inspect `apps/api/src/grounding/quarantine.service.ts` + `grounding.metrics.ts`: confirm whether quarantine is persisted or metric-only. Record the answer; if a durable store already exists, adjust the entity task to a read-model.
- [ ] 0.1 Add a NestJS integration test (Supertest + Testcontainers) for the admin quarantine endpoints as the outer loop (real Postgres + Redis; admin + non-admin actors).
- [ ] 0.2 Write failing scenarios: quarantining writes a `pending` row; admin list paginates/filters; non-admin → `403`; approve re-instates + audits + `approved`; reject discards + audits + `rejected`.
- [ ] 0.3 Confirm failure is "no entity / no routes", not a harness error.

## 1. QuarantinedItem entity + migration

- [ ] 1.1 RED: integration test that the migration creates the table and a `QuarantinedItem` can be persisted/queried with status + verdict + provenance.
- [ ] 1.2 GREEN: add the `QuarantinedItem` entity + first migration in `packages/db` (owner per IMPLEMENTATION-ORDER entity table).
- [ ] 1.3 REFACTOR: align columns/indexes (by certification, by status).

## 2. Persist at the quarantine point

- [ ] 2.1 RED: integration test that quarantining an item writes a `pending` row AND still evicts from cache + increments the metric.
- [ ] 2.2 GREEN: add the write in `QuarantineService` (additive; do not change eviction/metric/budget).
- [ ] 2.3 REFACTOR: keep the quarantine path cohesive.

## 3. Admin list endpoint

- [ ] 3.1 RED: integration test — `GET /admin/quarantine` admin-only, paginated (25/100), filter by certification/status; non-admin → `403`.
- [ ] 3.2 GREEN: implement the controller/service + list DTO under `RolesGuard(admin)`; swagger DTOs for Orval.
- [ ] 3.3 REFACTOR: reuse the standard collection envelope + pagination.

## 4. Approve / Reject + audit

- [ ] 4.1 RED: integration test — approve re-instates via the grounding reinstatement path + `AuditLog` + `approved`; reject discards + `AuditLog` + `rejected`; double-resolve → idempotent or `409`; both admin-only.
- [ ] 4.2 GREEN: implement both actions, reusing the `AuditLog` writer and the grounding reinstatement path. Add the two new `AuditAction` values (`quarantine.approved`, `quarantine.rejected`) to `packages/shared/src/admin` + its spec, since only `content.quarantined` exists today.
- [ ] 4.3 REFACTOR: share the resolve/transition guard.

## 5. Codegen + client

- [ ] 5.1 Run `yarn codegen` and commit the regenerated client (admin quarantine methods).

## 6. web-admin Review queue

- [ ] 6.1 RED: unit test — Review queue renders the real list (verdict/reason/provenance) and Approve/Reject call the endpoints, removing the item on success; admin-gated.
- [ ] 6.2 GREEN: replace the placeholder with the real list + actions.
- [ ] 6.3 REFACTOR: clean up loading/empty/error states.

## 7. e2e + close the outer loop

- [ ] 7.1 Add/extend admin Playwright e2e listing + resolving a quarantined item (endpoints mocked).
- [ ] 7.2 Make the Section 0 acceptance test green.

## 8. Verification gates

- [ ] 8.1 `yarn lint`, `yarn typecheck`, `yarn test` (≥80% coverage), `yarn build` green; migration applies cleanly; generated client committed.
