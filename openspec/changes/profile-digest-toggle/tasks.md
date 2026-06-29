## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Add a NestJS integration test (Supertest + Testcontainers) covering `GET`/`PATCH /api/v1/users/me` with `digestOptOut`.
- [ ] 0.2 Write failing scenarios: GET returns `digestOptOut`; PATCH true then false round-trips; non-boolean → `422`; weekly-digest eligibility reflects the value; tokenized unsubscribe still converges on the same field.
- [ ] 0.3 Confirm failure is "field not present / not accepted", not a harness error.

## 1. Shared contract

- [ ] 1.1 RED: unit test that `userProfileResponseSchema` includes `digestOptOut` and `UpdateUserProfileRequest` accepts optional `digestOptOut`.
- [ ] 1.2 GREEN: add the field to both schemas/types in `@readion/shared`.
- [ ] 1.3 REFACTOR: ensure no duplicate profile-shape definition drifts.

## 2. Profile read/update + swagger DTOs

- [ ] 2.1 RED: integration test — `GET /users/me` includes `digestOptOut`; `PATCH` persists true/false; `422` on non-boolean; existing fields unaffected.
- [ ] 2.2 GREEN: add `digestOptOut` to the profile response + update handler; add swagger DTOs to the profile controller so Orval emits typed methods.
- [ ] 2.3 REFACTOR: collapse any manual envelope shape now covered by the DTO.

## 3. Digest eligibility unchanged

- [ ] 3.1 RED: integration test asserting the weekly-digest selection skips a user after authenticated opt-out and includes them after authenticated opt-in (reusing the lifecycle-email selection path).
- [ ] 3.2 GREEN: confirm no change needed (field already honored); add the test as a regression guard.

## 4. Codegen + client

- [ ] 4.1 Run `yarn codegen` and commit the regenerated client (profile methods now typed; `digestOptOut` present).

## 5. web-settings Notifications tab

- [ ] 5.1 RED: unit test — Notifications tab renders a switch seeded from the profile `digestOptOut`; toggling calls `usersControllerUpdateMe { digestOptOut }` and invalidates the profile query; reflects persisted state.
- [ ] 5.2 GREEN: implement the two-way switch; optionally retype against the now-typed client.
- [ ] 5.3 REFACTOR: remove the old informational-only copy; keep a pointer to the email unsubscribe link.

## 6. e2e + close the outer loop

- [ ] 6.1 Update the Settings Playwright e2e to drive the digest toggle against a mocked `PATCH /users/me`.
- [ ] 6.2 Make the Section 0 acceptance test green.

## 7. Verification gates

- [ ] 7.1 `yarn lint`, `yarn typecheck`, `yarn test` (≥80% coverage), `yarn build` green; generated client committed.
