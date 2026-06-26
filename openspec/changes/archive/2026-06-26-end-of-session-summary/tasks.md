## 0. Acceptance Test — Outer Loop RED

<!-- Adaptation: backend-only change (like quiz, sessions, mock-exam, readiness, diagnostic) — the outer acceptance test is a full-app API-level `*.acceptance.spec.ts` (Supertest through the booted Nest app on Testcontainers), not Playwright e2e; the summary UI belongs to the downstream `web-session-view` change. See design.md → Test Boundaries. -->

- [x] 0.1 Build a session-summary acceptance harness (authenticated user enrolled in a `live` certification with content across multiple domains), reusing the `sessions`/`mock-exam` harness patterns; keep Postgres/Redis real, mock the Vercel AI SDK at the `ProviderAdapter` boundary (only the drill path generates), and provide deterministic ways to run a study session (answer some correct, some wrong, some flagged-unsure) and to submit a mock attempt
- [x] 0.2 Write failing acceptance spec `apps/api/src/session-summary/session-summary.acceptance.spec.ts` (study path): a user completes a session answering 4/6 correctly across two domains, ends it, then `GET /api/v1/sessions/:id/summary` returns questions answered + accuracy, per-domain accuracy, weak-area deltas, readiness before→after, strongest/weakest question, and a next-focus domain (covers session-summary "Summary reports questions answered and accuracy", "Summary breaks accuracy down per domain", "Summary reports per-domain weak-area deltas", "Summary reports the readiness change", "Summary identifies the strongest and weakest question", "Summary suggests a next-session focus")
- [x] 0.3 Write a failing acceptance path (drill): the same user posts `POST /api/v1/sessions/:id/drill` and receives a new active study session targeting the missed/flagged-unsure concepts (capped); a fully-correct session's drill creates nothing (covers "Drilling misses starts a targeted session", "Drilling with no misses creates nothing")
- [x] 0.4 Write a failing acceptance path (mock): a submitted mock attempt's `GET /api/v1/mock-exams/:id/summary` returns the summary shape and `POST /api/v1/mock-exams/:id/drill` starts a targeted session from the wrong answers (covers "Mock summary derives accuracy and per-domain breakdown from the attempt", "Mock summary reports weak-area and readiness deltas", "Drilling mock misses starts a targeted session")
- [x] 0.5 Confirm all paths fail for the right reason (no `SessionSummaryModule`/endpoints yet), not a harness/setup error

## 1. Shared contracts (`packages/shared`)

- [x] 1.1 RED: Write a type/schema test asserting the summary + drill DTOs exist — `SessionSummaryResponse` (questionsAnswered, accuracy, domains[{domain, accuracy}], weakAreaDeltas[{domain, delta}], readiness{before, after, delta} with nullable after/delta, strongestQuestion/weakestQuestion{responseId, question}, nextFocus{domain}|null) and a drill result DTO (started session vs. `no_misses`/`all_caught_up` status)
- [x] 1.2 GREEN: Add the summary + drill DTOs and the `SUMMARY_DRILL_MAX_QUESTIONS` / `SUMMARY_UNSURE_CONFIDENCE_THRESHOLD` default constants to `packages/shared`; export from the package index
- [x] 1.3 REFACTOR: Reuse existing `MockExam*` / `Session*` shared types where shapes overlap rather than duplicating fields

## 2. Config (`apps/api`)

- [x] 2.1 RED: Write a unit test for the env schema asserting `SUMMARY_DRILL_MAX_QUESTIONS` (default mirrors the review session cap) and `SUMMARY_UNSURE_CONFIDENCE_THRESHOLD` (default 2) are Zod-validated with defaults and rejected when malformed
- [x] 2.2 GREEN: Add both keys to the api env schema with Zod validation and defaults
- [x] 2.3 REFACTOR: Document the keys in `apps/api/.env.example`

## 3. Summary calculators — accuracy & per-domain rollups (pure logic)

- [x] 3.1 RED: Write unit tests for a pure `summarizeResponses(responses)` helper: total answered, overall accuracy (rounded to four decimals), and per-domain accuracy from a set of graded responses with domain attribution; empty set yields zero answered and no domains
- [x] 3.2 GREEN: Implement the pure accuracy/per-domain rollup, reusing the chunk→`primaryDomain` attribution rule shared with `WeakAreasService.recompute`
- [x] 3.3 REFACTOR: Factor the response-set → domain-inputs mapping into a shared pure helper so the summary and the existing recompute do not drift

## 4. Summary calculators — before→after deltas (pure logic)

- [x] 4.1 RED: Write unit tests for the delta computation: given a "before" response set and an "after" (all) response set plus domain weights, it returns per-domain `WeakArea` score deltas (via `computeDomainScore`) and a readiness before/after/delta (via `computeReadiness` + calibration), with `after`/`delta` null when the enrollment is not yet calibrated (covers "Readiness change is null when not yet calibrated", "Before baseline excludes the source activity")
- [x] 4.2 GREEN: Implement the pure delta calculator composing the existing `computeDomainScore`, `computeReadiness`, and `isCalibrated`; surface readiness on the 0–100 scale
- [x] 4.3 REFACTOR: Keep the calculator pure and free of I/O; no mutation of stored state

## 5. Summary calculators — strongest/weakest & next-focus (pure logic)

- [x] 5.1 RED: Write unit tests for strongest/weakest selection (weakest = first incorrect, tie-break lowest confidence then earliest; strongest = correct with highest confidence, tie-break fastest time) and for next-focus = lowest-scoring weak-area domain (null when none), with explicit tie-break cases (covers "Summary identifies the strongest and weakest question", "Summary suggests a next-session focus")
- [x] 5.2 GREEN: Implement the pure selectors returning the response identity (responseId + question text) and the next-focus domain
- [x] 5.3 REFACTOR: Keep selectors pure and deterministic

## 6. Drill target selection (pure logic)

- [x] 6.1 RED: Write unit tests for `selectDrillTargets`: qualifies a response/question when wrong OR confidence ≤ threshold (sessions) / wrong-or-unanswered (mocks), maps to `ReviewTarget { domain, anchorChunkId }`, dedupes by anchor chunk, caps at `SUMMARY_DRILL_MAX_QUESTIONS`, and returns empty when nothing qualifies (covers "Drilling with no misses creates nothing", "Drilling a fully-correct attempt creates nothing")
- [x] 6.2 GREEN: Implement the pure target selector mirroring the `review-accrual` qualification rule
- [x] 6.3 REFACTOR: Share the qualification predicate with the accrual rule notion so they stay consistent

## 7. Summary service — study-session & mock readers (`apps/api`)

- [x] 7.1 RED: Write integration tests (Supertest + Testcontainers): study-session summary scopes responses by the session `[startedAt, endedAt]` window and excludes them for the "before" baseline; mock summary derives from the `MockExam` entity and excludes the attempt's contribution for "before"; requesting a summary mutates no stored `WeakArea`/readiness (idempotent), and an `active` session / `in_progress` attempt return `409` (covers "Deltas are computed without mutating stored state", "Summary for an active session is rejected", "Summary for an in-progress attempt is rejected")
- [x] 7.2 GREEN: Implement `SessionSummaryService` composing the pure calculators with reads of `StudySession`/`SessionItem`, `MockExam`, `QuizResponse`, `ContentChunk`, `WeakAreasService`, and `ReadinessService`; enforce the ended/finalized precondition
- [x] 7.3 REFACTOR: Keep the service read-only; centralize the response-window and attempt-exclusion logic

## 8. Drill service path (`apps/api`)

- [x] 8.1 RED: Write integration tests: drilling a session/mock with misses calls `SessionsService.createReviewSession` with the selected targets and returns the new session; drilling with no misses returns the `no_misses`/`all_caught_up` status and creates nothing; drilling while a session is already `active` returns the existing one (covers "Drilling misses starts a targeted session", "Drill respects the one-active-session invariant", "Drilling a fully-correct attempt creates nothing")
- [x] 8.2 GREEN: Implement the drill methods delegating to `SessionsService.createReviewSession`
- [x] 8.3 REFACTOR: Reuse the same target selector for both session and mock drill; keep the controller thin

## 9. Controller + module wiring (`apps/api`)

- [x] 9.1 RED: Write integration tests for the four endpoints under the `{ data }` envelope with repository-layer ownership scoping (cross-user → `404` for summary and drill on both session and mock) (covers "Summary for another user's session returns 404", "Mock summary for another user's attempt returns 404", "Drilling another user's session returns 404", "Drilling another user's attempt returns 404")
- [x] 9.2 GREEN: Implement the `SessionSummaryModule` + controller exposing `GET /sessions/:id/summary`, `GET /mock-exams/:id/summary`, `POST /sessions/:id/drill`, `POST /mock-exams/:id/drill`; wire it into the app module
- [x] 9.3 REFACTOR: Confirm envelope shape and ownership scoping are consistent with sibling modules

## 10. Acceptance Test — Outer Loop GREEN

- [x] 10.1 Confirm all acceptance paths pass end-to-end
- [x] 10.2 Verify all affected apps start in the local environment (smoke test) — boot `apps/api` and confirm no startup/config errors; regenerate and commit the Orval client (`yarn codegen`) for the new endpoints
- [x] 10.3 REFACTOR: Clean up test setup and mocks if needed

## 11. Change Review — Subagent Verification

- [x] 11.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [x] 11.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 12. Polish

- [x] 12.1 Run linter and fix all errors (`yarn lint`)
- [x] 12.2 Run formatter and apply fixes (`yarn format:fix`)
- [x] 12.3 Run type checker with zero errors (`yarn workspace apps/api typecheck`)
- [x] 12.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
