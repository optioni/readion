## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up e2e harness: Testcontainers Postgres + Redis, API under `@nestjs/testing`, and a seeded population spanning active vs inactive users (active = ≥2 completed sessions/14d), completed vs abandoned sessions, sessions with and without an agent interaction, graded `QuizResponse` rows across a 28-day window, at least one `MockExam`, and a couple of recorded `exam_outcome_response` values, plus an admin and a non-admin user (PRD §3; Testing Strategy)
- [x] 0.2 Write failing Playwright/e2e: an `admin` GETs `/api/v1/admin/analytics/overview` and the response (a) contains every metric section — active-user count, north-star median readiness gain, sessions/week, W2/W4 retention, completion rate, agent engagement, LLM-cost-per-active-user, lagging pass-rate breakdown — each with its configured target where one exists, and (b) the figures reflect the seeded population; a `user`-role caller gets `403`; an anonymous caller gets `401`
- [x] 0.3 Confirm it fails for the right reason (module/route absent, not a harness error)

## 1. Shared contracts & config

- [x] 1.1 RED: Unit-test the product-analytics config defaults/validation in `packages/shared` (`ANALYTICS_ACTIVE_WINDOW_DAYS`=14, `ANALYTICS_ACTIVE_MIN_SESSIONS`=2, `ANALYTICS_NORTHSTAR_WINDOW_DAYS`=28, cost coefficients numeric, targets numeric incl. `ANALYTICS_TARGET_NORTHSTAR_GAIN`=15 / `ANALYTICS_TARGET_W4_RETENTION`=0.40 / `ANALYTICS_TARGET_COMPLETION_RATE`=0.75 / `ANALYTICS_TARGET_AGENT_ENGAGEMENT`=0.50; malformed window names the offending var)
- [x] 1.2 GREEN: Add the analytics overview read-model DTO/types (metric+target pairs, retention-cohort shape, pass-rate breakdown reusing the `lifecycle-email` exam-outcome response set) and the new `apps/api` env-schema keys to `packages/shared`; add every key to `apps/api/.env.example` (PRD §3; SPEC → Configuration)
- [x] 1.3 REFACTOR: Single-source the metric-key/target mapping so the service and DTO reference one definition

## 2. Active-user population & session-derived metrics (`apps/api`)

- [x] 2.1 RED: Unit-test the pure stats helpers with injected values — median, completion rate (reached-summary ÷ started), agent-engagement fraction, sessions-per-week — and the active-user predicate (≥`MIN_SESSIONS` completed, `endedAt` in trailing `WINDOW_DAYS`, abandoned excluded) with an injected clock at the window boundary (PRD §3 → Definitions)
- [x] 2.2 GREEN: Implement the active-user population query and the session-derived read models (sessions/week, completion rate, agent engagement) over `StudySession` and `StudySession ⟕ AgentConversation/AgentMessage`
- [x] 2.3 RED: Integration test (Testcontainers) against a seeded population — active-user count, completion rate, and agent-engagement match the seeded data; abandoned sessions and conversations with no user message are excluded
- [x] 2.4 GREEN: Wire the queries to the repository layer; confirm against the seeded DB
- [x] 2.5 REFACTOR: Extract the window/clock handling into one injectable helper reused by every metric

## 3. North-star readiness gain (`apps/api`)

- [x] 3.1 RED: Unit-test the north-star assembly with mocked readiness — per-user gain = now − window-start, uncalibrated boundary excluded from the median (not zero), median computed over the active population, target paired (SPEC → Exam Readiness Score; PRD §3)
- [x] 3.2 GREEN: Implement north-star assembly. Resolve the as-of question: prefer `ReadinessService.compute`; if it cannot evaluate as-of without expanding its contract, compute window-start readiness inside the analytics service from timestamped `QuizResponse`/`MockExam` rows (no new entity, no readiness-service contract change — see design.md Open Questions)
- [x] 3.3 RED: Integration test — a seeded user whose readiness improved across the 28-day window contributes the expected gain; an uncalibrated-at-start user is excluded
- [x] 3.4 GREEN: Implement the as-of recomputation path against the real DB and `ReadinessService`
- [x] 3.5 REFACTOR: Keep the as-of derivation isolated so a future snapshot entity could replace it without touching callers

## 4. Retention cohorts (`apps/api`)

- [x] 4.1 RED: Unit-test registration-week cohorting and W2/W4 active-fraction math with injected timestamps and the active-user predicate; cohort size reported alongside (PRD §3)
- [x] 4.2 GREEN: Implement the retention read model over `User.createdAt` and the active-user definition
- [x] 4.3 RED: Integration test — a seeded cohort with a known active subset in weeks 2 and 4 yields the expected fractions and size
- [x] 4.4 GREEN: Wire the cohort query to the repository layer

## 5. LLM-cost-per-active-user guardrail proxy (`apps/api`)

- [x] 5.1 RED: Unit-test the coefficient-weighted cost proxy — Σ(artifact counts × `ANALYTICS_COST_*`) ÷ active-user count, paired with `ANALYTICS_LLM_COST_BUDGET`, labelled an estimate (PRD §3 → Guardrail; design.md: no per-user token cost is persisted)
- [x] 5.2 GREEN: Implement the proxy over `QuizResponse`, `MockExam` question counts, session-item generations, and assistant/tool `AgentMessage` rows for the active population; do NOT re-derive the agent/SSE-error-rate or ingestion-success ops guardrails (they stay in Prometheus)
- [x] 5.3 RED: Integration test — seeded artifact counts produce the expected per-active-user estimate against config coefficients
- [x] 5.4 GREEN: Wire the counts to the repository layer

## 6. Lagging pass-rate breakdown (`apps/api`)

- [x] 6.1 RED: Integration test — seeded `exam_outcome_response` values produce the expected `passed/did_not_pass/not_yet/dismissed` breakdown; with no responses the breakdown is all zeros and the request still succeeds; recording outcomes never alters readiness (PRD §3 → lagging outcome)
- [x] 6.2 GREEN: Implement the breakdown read model over `user_certifications.exam_outcome_response` (columns owned by `email-lifecycle`); degrade gracefully when absent — see proposal soft-dependency flag

## 7. Admin overview endpoint (`apps/api`)

- [x] 7.1 RED: Integration test `GET /api/v1/admin/analytics/overview` — admin token `200` with every metric section + targets; `user` token `403`; anonymous `401` (reuse the `admin` `JwtAuthGuard` + `@Roles('admin')` pattern)
- [x] 7.2 GREEN: Implement `AnalyticsModule` — `analytics.controller.ts` (admin-guarded route) and `analytics.service.ts` assembling all read models into the `{ data }` overview envelope (optionally short-TTL Redis-cached; no new entity)
- [x] 7.3 REFACTOR: Ensure the controller wraps nothing manually (global `ResponseInterceptor`), uses absolute-path imports, and reports each metric's population/cohort size for significance

## 8. Acceptance Test — Outer Loop GREEN

- [x] 8.1 Confirm the Playwright/e2e passes end-to-end (admin overview with all metrics+targets; role gating)
- [x] 8.2 Verify api boots locally with the new env keys (smoke test) — no startup/config errors
- [x] 8.3 Regenerate the Orval client (`yarn codegen`) for the new admin endpoint and commit it
- [x] 8.4 (Optional, opportunistic) emit a Prometheus gauge (e.g. active-user count / north-star gain) against the existing `observability` infra when the overview is computed; no new metric is otherwise attributed to this change
- [x] 8.5 REFACTOR: Clean up test setup, fixtures, and seed helpers

## 9. Change Review — Subagent Verification

- [x] 9.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md plus the diff and this task list (reviewer reports findings only, does not edit code)
- [x] 9.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 10. Polish

- [x] 10.1 Run linter and fix all errors (`yarn lint`)
- [x] 10.2 Run formatter and apply fixes (`yarn format`)
- [x] 10.3 Run type checker with zero errors (`yarn typecheck`)
- [x] 10.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
