## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the e2e harness so the API can boot with `SIGNUPS_ENABLED=false` and at least one existing user (see design.md Test Boundaries: real Postgres/Redis via Testcontainers, `MailService` mocked)
- [x] 0.2 Write failing Playwright e2e (`apps/web/e2e/`): with signups disabled and a user already present, submitting the signup form shows a "Registration is currently closed" message and creates no account
- [x] 0.3 Confirm it fails for the right reason (the closed-state copy is absent / signup currently succeeds), not a harness/setup error

## 1. Env config — `SIGNUPS_ENABLED`

- [x] 1.1 RED: Write unit test for `env.schema.ts` asserting `SIGNUPS_ENABLED` coerces `"false"`→`false`, `"true"`→`true`, defaults to `true` when unset, and rejects malformed values at boot
- [x] 1.2 GREEN: Add `SIGNUPS_ENABLED` boolean field (default `true`, fail-open) to `apps/api/src/config/env.schema.ts` and expose it via the typed config; add `SIGNUPS_ENABLED=true` with an explanatory comment to `apps/api/.env.example`
- [x] 1.3 REFACTOR: Reuse the shared Zod boolean/env helper if one exists so coercion matches other boolean env fields

## 2. Signup gate in `AuthService.register()`

- [x] 2.1 RED: Write unit test for the gate decision — enabled → allow; disabled + existing user → reject with `signups-disabled`; disabled + zero non-deleted users → allow (bootstrap bypass), covering the ordering against the existing "email taken" `409` check
- [x] 2.2 RED: Write NestJS integration test (Supertest) for `POST /api/v1/auth/register`: enabled → `201`; disabled + existing user → `403` RFC 7807 with `type: signups-disabled`, no `User` created, `MailService` not called; disabled + empty user table → `201` with `role=admin` and verification email sent; unset flag → `201`
- [x] 2.3 GREEN: Implement the gate in `register()` — evaluate the flag against the already-computed `userCount`, throw a `signups-disabled` `403` (dedicated exception or `ForbiddenException` mapped to `type: signups-disabled`) before creating the user/sending email; ensure the global `ExceptionFilter` renders the correct Problem Details `type`
- [x] 2.4 REFACTOR: Keep the gate adjacent to the `userCount === 0` bootstrap rule so bypass and gate read together; remove any duplication

## 3. Web signup closed state <!-- parallel-after: 0 -->

- [x] 3.1 RED: Write a component/page test for the signup form asserting that a `403` with `type: signups-disabled` renders the "Registration is currently closed" message (reusing the existing error-banner styling) instead of the generic error
- [x] 3.2 GREEN: Handle the `signups-disabled` response in the signup page/form (`apps/web`) to show the closed-state copy
- [x] 3.3 REFACTOR: Ensure other registration errors still surface via the generic banner unchanged

## 4. Acceptance Test — Outer Loop GREEN

- [x] 4.1 Confirm the Playwright acceptance test passes end-to-end
- [x] 4.2 Verify affected apps start in the local environment (smoke test) — boot `apps/api` and `apps/web` with `SIGNUPS_ENABLED` set and unset, confirming no startup/config errors
- [x] 4.3 REFACTOR: Clean up test setup, mocks, and fixtures if needed

## 5. Change Review — Subagent Verification

- [x] 5.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 5.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests
  - Reviewer confirmed completeness + correctness (independently re-ran API/web suites). No CRITICAL/SUGGESTION.
  - 2 WARNINGs (format of auth.service.ts:13 import + e2e:32 assertion) were false positives — they assumed lineWidth 80, but biome.json sets lineWidth 100 and both lines fit. `biome check` returns clean; ran `biome format --write` anyway (no material change).

## 6. Polish

- [x] 6.1 Run linter and fix all errors (`yarn lint`) — `biome check` clean on all changed files
- [x] 6.2 Run formatter and apply fixes (`yarn format`) — `biome format` clean (lineWidth 100)
- [x] 6.3 Run type checker with zero errors (`yarn typecheck`) — shared, api, web all pass
- [x] 6.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`) — new code fully exercised by added env-schema/gate/integration/filter/composable/e2e tests; CI enforces the repo-wide gate
