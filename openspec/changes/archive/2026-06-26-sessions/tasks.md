## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the e2e harness (Playwright in `apps/web/e2e/` + integration harness with Testcontainers Postgres/Redis), seed an enrolled `UserCertification` with `active` `WeakArea` rows and `active` `content_chunks`, and mock the LLM provider at the Vercel AI SDK boundary (deterministic reading-block Markdown + verified quiz output) per design.md Test Boundaries
- [x] 0.2 Write failing acceptance test for the core loop: create a 30-min study session → assert `201`, `status: active`, first 3 `SessionItem`s present, reading↔quiz alternation → complete items advancing `lastItemIndex` → resume returns last incomplete index → `POST /sessions/:id/end` returns `completed` with `endedAt`/duration
- [x] 0.3 Confirm it fails for the right reason (endpoints/module absent, not a harness/setup error)

## 1. Entities & migration (`packages/db`)

- [x] 1.1 RED: Write integration test for `StudySession` (user, certification, enrollment, config, `kind` study/review, status, `startedAt`/`endedAt`, `lastItemIndex`) and `SessionItem` (`type` reading/quiz/video, content, `completed`, `sourceChunkIds`/`supportingSpans` snapshot) persisting and round-tripping against the test DB
- [x] 1.2 GREEN: Add MikroORM entities + the migration creating both tables, including the partial unique constraint `UNIQUE (user_certification_id) WHERE status = 'active'`
- [x] 1.3 REFACTOR: Align with base-entity conventions; confirm migration runs clean up/down

## 2. Session planner (pure logic)

- [x] 2.1 RED: Unit-test duration→item-count derivation, the reading↔quiz sequence builder, deterministic quiz `format` selection (mc/true-false/scenario) from chunk + difficulty, and weak-area weighting of target domains (collaborators mocked)
- [x] 2.2 GREEN: Implement the planner producing an ordered item plan with target domains and per-item fixed `format`
- [x] 2.3 REFACTOR: Extract per-content-mix ratios as named constants

## 3. Content selection & reading-block composition

- [x] 3.1 RED: Unit-test semantic retrieval gating at cosine ≥ 0.75 (configurable), 1–3 chunk composition into Markdown + TL;DR, provenance snapshot capture, and video-mix silent degradation to reading block when no video chunks clear the threshold (retrieval + LLM mocked)
- [x] 3.2 GREEN: Implement the reading-block composer (LLM gateway) and the "Go deeper" on-demand expansion path; persist `sourceChunkIds`/`supportingSpans`
- [x] 3.3 REFACTOR: Centralize the verbatim-text cap and threshold env config

## 4. Item pre-generation (blocking + background)

- [x] 4.1 RED: Integration-test that create produces the first 3 items synchronously, that quiz items come back verified via `QuizModule` (failing-verifier questions regenerated/substituted), and that remaining items are filled by the background worker job
- [x] 4.2 GREEN: Implement synchronous first-3 generation in create, enqueue the high-priority background fill job, and wire quiz generation through `QuizModule`
- [x] 4.3 REFACTOR: Ensure background generation preserves sequence order

## 5. Sessions service & one-active invariant

- [x] 5.1 RED: Integration-test create (config + saved-defaults fallback), the atomic one-active-per-enrollment behavior (concurrent double-start resumes, single `active` row), per-enrollment independence, item completion advancing `lastItemIndex`, resume, and end (idempotent, partial vs. complete status)
- [x] 5.2 GREEN: Implement `SessionsService` with transactional find-active-or-create, completion/resume, and end recording duration/completion status
- [x] 5.3 REFACTOR: Consolidate config resolution (request → user defaults)

## 6. Controller, ownership scoping & history

- [x] 6.1 RED: Integration-test the REST surface (create, get, complete item, go-deeper, end, history list with cert/status filters + pagination) and that cross-user access returns `404` via repository-layer `userId` scoping
- [x] 6.2 GREEN: Implement the controller + `userId`-scoped repository methods; return `{ data, relationships }` / `{ data[], meta }` envelopes via the global interceptor
- [x] 6.3 REFACTOR: Tidy DTOs/validation and `?include=` handling

## 7. Worker abandonment cron & metric

- [x] 7.1 RED: Integration-test the cron handler marks `active` sessions older than 24h as `abandoned` while leaving recent ones untouched; assert the active-session Prometheus gauge reflects active-row count
- [x] 7.2 GREEN: Implement the `@nestjs/schedule` cron in `apps/worker` and register the active-session gauge
- [x] 7.3 REFACTOR: Make the threshold/grace configurable via env

## 8. API client regeneration

- [x] 8.1 GREEN: Run `yarn codegen` against the running API and commit the regenerated Orval client for the new session endpoints

## 9. Acceptance Test — Outer Loop GREEN

- [x] 9.1 Confirm the acceptance test passes end-to-end
- [x] 9.2 Verify all affected apps start in the local environment (smoke test) — boot `apps/api` and `apps/worker` and confirm no startup/config errors
- [x] 9.3 REFACTOR: Clean up test setup and mocks if needed

## 10. Change Review — Subagent Verification

- [x] 10.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 10.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 11. Polish

- [x] 11.1 Run linter and fix all errors (`yarn lint`)
- [x] 11.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 11.3 Run type checker with zero errors (`apps/api`, `apps/worker`, `packages/db`)
- [x] 11.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
