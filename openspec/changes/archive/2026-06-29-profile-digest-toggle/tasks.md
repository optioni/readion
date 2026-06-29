## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Add a NestJS integration test (Supertest + Testcontainers) covering `GET`/`PATCH /api/v1/users/me` with `digestOptOut`.
- [x] 0.2 Write failing scenarios: GET returns `digestOptOut`; PATCH true then false round-trips; non-boolean → `422`; weekly-digest eligibility reflects the value; tokenized unsubscribe still converges on the same field.
- [x] 0.3 Confirm failure is "field not present / not accepted", not a harness error.

## 1. Shared contract

- [x] 1.1 RED: unit test that `userProfileResponseSchema` includes `digestOptOut` and `UpdateUserProfileRequest` accepts optional `digestOptOut`.
- [x] 1.2 GREEN: add the field to both schemas/types in `@readion/shared`.
- [x] 1.3 REFACTOR: ensure no duplicate profile-shape definition drifts.

## 2. Profile read/update + swagger DTOs

- [x] 2.1 RED: integration test — `GET /users/me` includes `digestOptOut`; `PATCH` persists true/false; `422` on non-boolean; existing fields unaffected.
- [x] 2.2 GREEN: add `digestOptOut` to the profile response + update handler; add swagger DTOs to the profile controller so Orval emits typed methods.
- [x] 2.3 REFACTOR: collapse any manual envelope shape now covered by the DTO.

## 3. Digest eligibility unchanged

- [x] 3.1 RED: integration test asserting the weekly-digest selection skips a user after authenticated opt-out and includes them after authenticated opt-in (reusing the lifecycle-email selection path).
- [x] 3.2 GREEN: confirm no change needed (field already honored); add the test as a regression guard.

## 4. Codegen + client

- [x] 4.1 Run `yarn codegen` and commit the regenerated client (profile methods now typed; `digestOptOut` present).

## 5. web-settings Notifications tab

- [x] 5.1 RED: unit test — Notifications tab renders a switch seeded from the profile `digestOptOut`; toggling calls `usersControllerUpdateMe { digestOptOut }` and invalidates the profile query; reflects persisted state.
- [x] 5.2 GREEN: implement the two-way switch; optionally retype against the now-typed client.
- [x] 5.3 REFACTOR: remove the old informational-only copy; keep a pointer to the email unsubscribe link.

## 6. e2e + close the outer loop

- [x] 6.1 Update the Settings Playwright e2e to drive the digest toggle against a mocked `PATCH /users/me`.
- [x] 6.2 Make the Section 0 acceptance test green.

## 7. Verification gates

- [x] 7.1 `yarn lint`, `yarn typecheck`, `yarn test` (≥80% coverage), `yarn build` green; generated client committed.
