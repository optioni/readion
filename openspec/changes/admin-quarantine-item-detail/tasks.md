## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 NestJS integration test (Supertest + Testcontainers) for `GET /api/v1/admin/quarantine/:id`: admin-only (non-admin → 403, anon → 401); returns verdict/reason/provenance/status + mapped `generatedContent` (question, options, answer key); unknown id → 404 RFC 7807.
- [x] 0.2 Confirm it fails because the route doesn't exist yet.

## 1. Shared item-detail contract

- [x] 1.1 RED: unit test for the `@readion/shared` quarantined-item-detail schema (typed question/options/answer-key + verdict/provenance/status) and its TS type.
- [ ] 1.2 GREEN: add the Zod schema + types; reuse existing quarantine list types where they overlap.
- [ ] 1.3 REFACTOR: single source for the shared quarantine shapes.

## 2. Service: generatedContent mapping

- [ ] 2.1 RED: unit test mapping a `quarantined_items.generatedContent` JSONB row to the typed detail shape (question stem, options[], answer key); tolerate/handle malformed content explicitly.
- [ ] 2.2 GREEN: implement the detail read + mapping in the quarantine-admin service.
- [ ] 2.3 REFACTOR: keep the list query lean (no generatedContent); share narrowing helpers.

## 3. Controller route + guard

- [ ] 3.1 RED: integration test — route is admin-guarded (`RolesGuard`), returns the resolved detail envelope, 404 for unknown id, no audit entry written (read-only).
- [ ] 3.2 GREEN: add `GET /admin/quarantine/:id` returning the mapped detail via the response envelope.
- [ ] 3.3 REFACTOR: align with the existing quarantine-admin controller conventions.

## 4. Codegen + client

- [ ] 4.1 Run `yarn codegen` (api running) and commit the regenerated Orval client containing the detail operation.

## 5. Verification gates

- [ ] 5.1 `yarn lint`, `yarn typecheck`, api integration/unit tests green; coverage ≥ 80%.
