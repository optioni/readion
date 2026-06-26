## 0. Acceptance Test — Outer Loop RED

<!-- Adaptation: backend-only changes in this repo (quiz, sessions, weak-areas) use a full-app API-level `*.acceptance.spec.ts` (Supertest through the booted Nest app on Testcontainers) as the outer acceptance test — there are no Playwright e2e specs because the review UI belongs to the downstream `web-progress`/`web-session-view` changes. Task 0 follows that established convention. -->

- [x] 0.1 Build a review acceptance harness (authenticated user with an active enrollment + answered quizzes seeding the queue), mirroring `sessions/test/sessions-acceptance-harness.ts`; mock the Vercel AI SDK at the `ProviderAdapter` boundary, keep Postgres/Redis real (see design.md Test Boundaries)
- [x] 0.2 Write failing acceptance spec `apps/api/src/review/review.acceptance.spec.ts`: a user with due review items starts a 5-minute review, answers them, sees due count drop; and a user with nothing due gets the "all caught up" state offering a normal session (covers spec scenarios "Review session pulls only due items" + "Nothing due returns the all-caught-up state")
- [x] 0.3 Confirm it fails for the right reason (no `ReviewModule`/endpoints yet), not a harness/setup error

## 1. ReviewItem entity + migration (deepest data layer)

- [x] 1.1 RED: Write integration test (Supertest + Testcontainers) asserting the migration creates a `review_item` table with the `UserCertification` FK, anchor `ContentChunk` FK, `box`, `dueAt`, `lastReviewedAt`, and `state` enum (`active`/`mastered`/`suppressed`) — covers "Migration creates the ReviewItem table"
- [x] 1.2 GREEN: Add the `ReviewItem` MikroORM entity in `packages/db` and create the migration (`yarn workspace @readion/db migration:create`)
- [x] 1.3 REFACTOR: Align entity conventions (base entity, indexes on `userCertification` + `dueAt` + `state`) with sibling entities

## 2. Leitner scheduler (pure logic)

- [x] 2.1 RED: Write unit tests for the scheduler: promote-on-confident-correct, reset-on-wrong, hold-on-correct-but-unsure, master-past-top-box, and config-driven intervals — covers all Leitner-schedule scenarios
- [x] 2.2 GREEN: Implement the pure `LeitnerScheduler` taking `(box, state, answer)` + injected interval config and returning the next `{ box, dueAt, state }`
- [x] 2.3 REFACTOR: Extract interval config into a Zod-validated `@nestjs/config` value with default `1/3/7/16/35` days; ensure no interval is hardcoded in logic

## 3. Accrual on quiz answer

- [x] 3.1 RED: Write integration tests: incorrect answer enqueues, correct-but-unsure (1–2) enqueues, confident-correct (≥3) does not, and accrual on an existing active item reschedules without duplicating — covers all "Concept accrual" scenarios
- [x] 3.2 GREEN: Implement the accrual entry point in `ReviewModule` invoked on `QuizResponse` submission (idempotent per concept; new items start box 1, `state: active`, `dueAt` at the box-1 interval); confirm review answers remain ordinary `QuizResponse`s feeding `WeakAreasModule`
- [x] 3.3 REFACTOR: Keep `QuizModule` unaware of SRS — accrual subscribes at the module boundary, not inside quiz scoring

## 4. Due-queue read model + repository ownership scoping

- [x] 4.1 RED: Write integration tests for `GET /api/v1/user-certifications/:id/review`: due count/list reflect only `active` + `dueAt <= now`; suppressed/mastered excluded; another user's enrollment returns 404 — covers all "Due-queue read model" scenarios
- [x] 4.2 GREEN: Implement the review queue controller + service + repository query, scoping on `userId` at the repository layer; wrap responses in the `{ data[], meta }` envelope
- [x] 4.3 REFACTOR: Reuse the shared due-items provider here and (later) for the planner; keep one query path

## 5. Mark-as-mastered / suppress

- [x] 5.1 RED: Write integration tests: suppress a single concept, suppress an entire domain (by anchor chunk `primaryDomain`), and suppressing another user's item returns 404 — covers all "Mark-as-mastered and suppress" scenarios
- [x] 5.2 GREEN: Implement `POST /api/v1/review-items/:id/master` and the domain-level suppress action, setting `state: suppressed` and excluding from queue + new-material selection
- [x] 5.3 REFACTOR: Return affected-count metadata for the domain action; share suppression-exclusion logic with the planner's new-material selection

## 6. Re-anchoring on chunk supersession

- [x] 6.1 RED: Write integration tests: re-anchor via `supersededById` lineage; retrieve a replacement chunk via semantic search when no lineage; hold (no delete, eligible for `fetchMoreMaterial`) when nothing clears the threshold — covers all "Re-anchoring on chunk supersession" scenarios
- [x] 6.2 GREEN: Implement lazy re-anchoring at due-generation: lineage → semantic retrieval (pgvector, configurable threshold) → hold
- [x] 6.3 REFACTOR: Centralize the resolve-anchor step so both standalone review and front-loading use it

## 7. Standalone 5-minute review session (via SessionsModule)

- [x] 7.1 RED: Write integration tests: starting a review with due items creates a `review`-kind `StudySession` (quiz-only, capped 5–7, no reading blocks, fresh question per anchor); nothing due returns the all-caught-up state without creating a session; existing active session is resumed instead of a second created — covers all "Standalone five-minute review session" scenarios
- [x] 7.2 GREEN: Implement the start-review action that builds the due-item plan and delegates session creation to `SessionsModule` (reusing the one-active-per-enrollment invariant); generate fresh questions via `QuizModule` with varied format/difficulty
- [x] 7.3 REFACTOR: Make the question cap config-driven; ensure no review-specific scoring path (answers go through normal `QuizResponse`)

## 8. SessionPlanner front-loading (MODIFIED study-sessions)

- [x] 8.1 RED: Write integration tests against `SessionPlanner`: `learningStyle: "spaced-repetition"` with due items front-loads them before new material; with nothing due the plan is new material only — covers the two MODIFIED study-sessions scenarios
- [x] 8.2 GREEN: Expose `ReviewModule`'s due-items provider and have `SessionPlanner` consult it only when `learningStyle === spaced-repetition`, placing due review items at the start of the plan
- [x] 8.3 REFACTOR: Keep the dependency direction sessions→review intact (planner pulls from the provider; review never imports session internals)

## 9. Acceptance Test — Outer Loop GREEN

- [x] 9.1 Confirm the Playwright acceptance test passes end-to-end
- [x] 9.2 Verify affected apps start in the local environment (smoke test) — boot `apps/api` and `apps/web`, confirm no startup/config errors; run `yarn codegen` and commit the regenerated Orval client
- [x] 9.3 REFACTOR: Clean up test setup, fixtures, and the AI SDK mock

## 10. Change Review — Subagent Verification

- [x] 10.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 10.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 11. Polish

- [x] 11.1 Run linter and fix all errors (`yarn lint`)
- [x] 11.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 11.3 Run type checker with zero errors (`yarn workspace apps/api typecheck`)
- [x] 11.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
