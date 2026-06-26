## 0. Acceptance Test — Outer Loop RED

<!-- Adaptation: backend-only change (like quiz, weak-areas, sessions, mock-exam) — the outer acceptance test is a full-app API-level `*.acceptance.spec.ts` (Supertest through the booted Nest app on Testcontainers), not Playwright e2e; the dashboard/progress UI that renders the score belongs to web-dashboard/web-progress. See design.md Test Boundaries. -->

- [x] 0.1 Build a readiness acceptance harness (authenticated user with an active enrollment in a `live` certification with weighted domains, able to record graded answers across domains and optionally finalize a mock), reusing the weak-areas/quiz answer-recording harness; keep Postgres/Redis real (SPEC → Exam Readiness Score)
- [x] 0.2 Write failing acceptance spec `apps/api/src/readiness/readiness.acceptance.spec.ts`: a fresh enrollment reads `GET /api/v1/user-certifications/:id/readiness` as not-yet-calibrated; after recording ≥ `READINESS_CALIBRATION_MIN_ANSWERS` graded answers it returns a numeric 0–100 score; the same `UserCertification` single resource then exposes a numeric `readinessScore` (covers "Owner-scoped readiness read endpoint", "Calibration gate", "Readiness exposed on the UserCertification resource")
- [x] 0.3 Write a second failing acceptance path: another user requesting that enrollment's readiness gets `404` (covers "Another user cannot read the enrollment's readiness")
- [x] 0.4 Confirm both fail for the right reason (no `ReadinessModule`/endpoint/attribute yet), not a harness/setup error

## 1. Readiness config

- [x] 1.1 RED: Write a config-validation test asserting `READINESS_CALIBRATION_MIN_ANSWERS` is read from env, Zod-validated as a positive integer, and defaults to 10 (SPEC → Configuration "readiness calibration threshold"; SPEC → Exam Readiness Score)
- [x] 1.2 GREEN: Add the readiness config to the api Zod env schema + `@nestjs/config` namespace, and `.env.example`
- [x] 1.3 REFACTOR: Expose it via a typed config accessor consumed by the calibration gate; never hardcode the threshold

## 2. ReadinessCalculator (pure logic — deepest layer)

- [x] 2.1 RED: Write unit tests for `ReadinessCalculator`: domain-weighting (a stronger heavily-weighted domain raises the score more than an equal margin in a lightly-weighted domain), boundedness + purity (same inputs → same 0–100 value), recency weighting (recent improvement weighs ≥ equivalent older improvement), and mock-weighting (a strong mock result shifts the score at least as much as equivalent session-quiz performance, and the calculator returns a score with zero mocks) — covers "Domain-weighted readiness computation", "Recent improvement is reflected quickly", "Mock exam results weighted higher than session quizzes"
- [x] 2.2 GREEN: Implement the pure `ReadinessCalculator` taking `(perDomainScores, domainWeights, mockResults, now)` and returning a 0–100 number, no I/O; coefficients as in-code constants (tunable per SPEC "formula left flexible")
- [x] 2.3 REFACTOR: Keep domain weights and the mock-vs-quiz weight as inputs/constants (never per-call magic numbers leaking from callers); ensure graceful behavior with empty mocks and missing domains

## 3. Calibration gate (pure logic)

- [x] 3.1 RED: Write unit tests for the calibration predicate: not-yet-calibrated below `READINESS_CALIBRATION_MIN_ANSWERS` with no diagnostic; calibrated at/above the threshold; calibrated when a submitted diagnostic exists even below the answer threshold — covers "Calibration gate and not-yet-calibrated state"
- [x] 3.2 GREEN: Implement the pure `isCalibrated({ gradedAnswerCount, hasCompletedDiagnostic, threshold })` predicate
- [x] 3.3 REFACTOR: Express the readiness result as a discriminated type (`{ calibrated: true, score } | { calibrated: false, score: null }`) used everywhere downstream

## 4. Trajectory (pure logic)

- [x] 4.1 RED: Write unit tests for the trajectory estimator: returns null without enough history; returns an estimated weeks-to-ready once a positive trend over enough history exists; never depends on an exam date — covers "Passive readiness trajectory"
- [x] 4.2 GREEN: Implement the pure trajectory estimator from time-windowed readiness values (input: ordered `{ at, score }[]`) returning `{ weeksToReady } | null`
- [x] 4.3 REFACTOR: Make the history-sufficiency rule and target threshold explicit inputs/constants; ensure no reminder/date surface is introduced

## 5. ReadinessService.compute (read-through orchestration)

- [x] 5.1 RED: Write integration tests (Supertest + Testcontainers): `compute(userCertificationId)` returns not-yet-calibrated for a cold enrollment, a numeric score after enough graded answers, reflects newly recorded answers on a subsequent call, and computes with no migration/table of its own — covers "Readiness recompute entry point for downstream features", "Readiness is a derived value with no entity or migration"
- [x] 5.2 GREEN: Implement `ReadinessService.compute` reading `WeakArea` scores + summed `responseCount`, `Certification` domain weights, and submitted/expired `MockExam` results (including diagnostic detection), then applying the calibration gate and `ReadinessCalculator`; build the trajectory from point-in-time readiness over the response/mock timeline
- [x] 5.3 REFACTOR: Ensure all reads are scoped on the enrollment; memoize loaded `WeakArea` rows for the trajectory windows; add no readiness migration (assert in test)

## 6. Read endpoint + ownership scoping

- [x] 6.1 RED: Write integration tests for `GET /api/v1/user-certifications/:id/readiness`: `200` with `data.score`/`data.calibrated`/trajectory for the owner when calibrated, the not-yet-calibrated state when not, and `404` for a non-owner — covers "Owner-scoped readiness read endpoint"
- [x] 6.2 GREEN: Implement the controller + DTO wrapped in the `{ data }` envelope; scope the enrollment lookup on `userId` at the repository layer (cross-user → `404`)
- [x] 6.3 REFACTOR: Confirm the response DTO uses the discriminated calibration type and never leaks a fabricated score when uncalibrated

## 7. readinessScore on the UserCertification resource

- [x] 7.1 RED: Write integration tests asserting the `UserCertification` single-resource representation exposes a numeric `readinessScore` for a calibrated enrollment and `null` for an uncalibrated one, computed read-through — covers "Readiness exposed on the UserCertification resource"
- [x] 7.2 GREEN: Extend the `UserCertification` representation to populate `readinessScore` via `ReadinessService.compute` (number when calibrated, else `null`)
- [x] 7.3 REFACTOR: Avoid N+1 on list responses (batch readiness computation across the listed enrollments)

## 8. Wire-up, client, and verification

- [x] 8.1 Register `ReadinessModule` in the api app module; confirm the `ReadinessService.compute` entry point is exported for downstream consumers (sessions/summary/agent/digest/diagnostic)
- [x] 8.2 Run `yarn codegen` (api running) to regenerate the Orval client for the new endpoint + `readinessScore` attribute, and commit `apps/web/src/api/`
- [x] 8.3 Make the acceptance specs (group 0) pass; run `yarn lint`, `yarn format`, `yarn test`, and confirm ≥ 80% coverage and a green build

## 9. Change Review

- [x] 9.1 Review the completed change against proposal.md, design.md, and specs/exam-readiness/spec.md (outside-in-tdd-reviewer): confirm no entity/migration/cron/metric was added, the calibration threshold comes from config, mock is a soft input, ownership scoping returns `404`, and every spec scenario maps to a test
