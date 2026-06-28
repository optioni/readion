## Context

PRD §3 fixes the bar for "is the product working": a north-star (readiness-gain-per-active-user), supporting engagement/retention/completion metrics, and cost/quality guardrails — each with a falsifiable v1 target. The SPEC's `observability` change already emits the *operational* side (latency, verifier rates, queue depth, active-session gauge, agent SSE error rate, ingestion counts) as aggregate Prometheus series. What is missing is the *product* side: per-user, cohorted, target-compared figures that Prometheus cannot carry (per-user label cardinality) and that no other change computes.

All the underlying data already exists in tables other changes own and that are all archived: `StudySession` (status `active`/`completed`/partial/`abandoned`, `kind`, `startedAt`, `endedAt`, FK to `UserCertification`→`User`), `QuizResponse` (correctness/confidence/`createdAt`, FK to `UserCertification`), `MockExam` (`type`, `status`, `score`, `startedAt`), `AgentConversation`/`AgentMessage` (session link, `role`), `User` (`createdAt`), `UserCertification`, and the `exam_outcome_response` columns added to `user_certifications` by `email-lifecycle`. Readiness is reachable via `ReadinessService.compute(userCertificationId)`.

The roadmap is explicit that this change introduces **no new entity** ("derived read models over existing tables"). That constraint drives the two hard design decisions below.

## Goals / Non-Goals

**Goals:**
- An admin-only `GET /api/v1/admin/analytics/overview` returning the full product dashboard read model over a configurable reporting window, each metric paired with its configured v1 target.
- Honest implementations of the PRD §3 metrics: active-user population, north-star median readiness gain, median sessions/week, W2/W4 retention, completion rate, agent-engagement rate, LLM-cost-per-active-user guardrail, lagging self-reported pass rate.
- Validated config for windows, cost coefficients, and targets; fail-fast on missing/malformed values.
- Zero new entities and zero migrations.

**Non-Goals:**
- Any frontend/UI — the admin product dashboard is built later in `web-admin`; this change only exposes the endpoint.
- Re-deriving operational guardrails already emitted by `observability`/`agent` (agent/SSE error rate, ingestion success rate). They are referenced as existing ops series, not recomputed.
- Persisting a readiness time-series or any per-user LLM-cost ledger (would be a new entity — forbidden here).
- Modifying `study-sessions`, `agent-chat`, `exam-readiness`, `quiz-scoring`, `mock-exam`, or `lifecycle-email` requirements — all consumed read-only.
- A worker cron / scheduled materialization — the roadmap assigns none and v1 computes on demand.

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Postgres (`study_session`, `quiz_response`, `mock_exam`, `agent_*`, `user`, `user_certification`) | real (Testcontainers), seeded with a population spanning active/inactive, completed/abandoned, with/without agent use | real (Testcontainers) for repository aggregations; n/a for pure stats |
| `ReadinessService` | real service against the seeded DB | mocked at the service interface for north-star assembly logic |
| As-of readiness recomputation | exercised against seeded timestamped `QuizResponse`/`MockExam` rows | pure window/median/gain math unit-tested with injected values |
| Admin auth (`JwtAuthGuard` + `RolesGuard`) | real guards — admin token passes, user token `403`, anonymous `401` | n/a |
| Clock / window boundaries (14d/28d, registration cohorts, week buckets) | seeded timestamps + injected fixed clock | injected fixed clock; table-driven across window edges |
| LLM-cost proxy | real counts from seeded rows × config coefficients | pure coefficient math unit-tested |
| Prometheus gauge (opportunistic) | assert a gauge is observed when overview is computed (if implemented) | n/a |
| Playwright e2e | admin requests `/admin/analytics/overview`, asserts every metric+target field is present and reflects the seeded population; non-admin gets `403` | n/a |

## Decisions

- **One admin overview endpoint, computed on demand.** A single `GET /api/v1/admin/analytics/overview?windowDays=…` returns the whole dashboard read model (every metric section plus its target). Admin-gated via the established `@Roles('admin')` + global `JwtAuthGuard` pattern from `admin`. v1 computes synchronously per request; the active-user population is small (same reasoning `email-lifecycle` used for digest fan-out). An optional short-TTL Redis cache can absorb repeat loads without a new entity.
  - *Alternative rejected — a scheduled materialization cron + snapshot table:* would introduce a new entity/migration, which the roadmap forbids for this change, and the roadmap assigns no worker cron here.
  - *Alternative rejected — many granular endpoints:* the dashboard renders all metrics together; one envelope keeps the Orval surface and the `web-admin` consumer simple.

- **Active-user population is the shared denominator.** Active user = a user with ≥ `ANALYTICS_ACTIVE_MIN_SESSIONS` (default 2) `StudySession`s that reached a terminal completed state with `endedAt` inside the trailing `ANALYTICS_ACTIVE_WINDOW_DAYS` (default 14), per PRD §3. Computed once and reused as the population for north-star, sessions/week, and LLM-cost-per-active-user. `abandoned` sessions never count; both `study` and `review` kinds count as study sessions.

- **North-star readiness gain via as-of recomputation, not a snapshot table — the central tension.** The north-star is median (over active users) of `readiness_now − readiness_at_window_start`. Readiness is a *read-through* value with **no history table** (the `exam-readiness` spec forbids a readiness entity), so there is nothing to diff against. To honor "no new entity," the window-start readiness is recomputed *as-of* the window boundary from the immutable, timestamped rows that already drive readiness — `QuizResponse.createdAt` and `MockExam.startedAt`/submission — i.e. readiness computed over only the answers/mocks that existed at `windowStart`. This is a derived read model over existing tables, not a new persisted snapshot.
  - *Alternative rejected — a periodic readiness-snapshot entity:* cleanest numerically but creates the forbidden new entity/migration and a second source of readiness truth.
  - *Alternative considered — reuse `email-lifecycle`'s `last_digest_readiness`:* rejected as the primary source because it is sparse (weekly), opt-out-sensitive, and only set for users who received a digest — not a reliable per-active-user series. It MAY be used as a fast-path hint where present.
  - *Consequence:* as-of recomputation requires the readiness computation to accept a point-in-time answer/mock filter. If `ReadinessService.compute` cannot be invoked as-of without expanding its contract, the analytics service computes readiness-at-T from the same raw inputs directly (weak-area aggregation over `QuizResponse` up to T, combined by `Certification` domain weights) rather than mutating the readiness service. Flagged in Open Questions.

- **LLM-cost-per-active-user is an explicit proxy.** No per-user token/cost is persisted anywhere — the LLM gateway emits token usage only as aggregate Prometheus series labelled by model/use-case. Exact per-user billing is therefore impossible without a new ledger (forbidden). The guardrail is computed as Σ(countable LLM-driven artifacts per active user × configured per-task cost coefficient) ÷ active-user count, over the window: `QuizResponse` rows, `MockExam` question counts, session-item generations, and assistant/tool `AgentMessage` rows, each weighted by `ANALYTICS_COST_*`. The result is a budget-tracking estimate, labelled as such, compared to `ANALYTICS_LLM_COST_BUDGET`.

- **Operational guardrails are referenced, not re-derived.** PRD §3 lists agent/SSE error rate and content-ingestion success rate as guardrails, but both are already emitted as Prometheus ops series (`agent`: "Agent SSE error rate is observable"; `observability`/`content-pipeline`: ingestion counts). The roadmap Scope limits this change to "metrics the SPEC's ops metrics don't cover," so the overview surfaces them by reference (or omits them, pointing to Prometheus) and only the LLM-cost-per-active-user guardrail is newly derived here.

- **Lagging pass rate is display-only and reads `email-lifecycle`'s columns.** The overview includes a self-reported pass-rate breakdown from `exam_outcome_response` (`passed`/`did_not_pass`/`not_yet`/`dismissed`) on `user_certifications`. It is reported but never fed into any other metric (PRD §3: tracked, not optimized in v1). These columns are owned by `email-lifecycle`, which the roadmap does not list as a dependency (see Open Questions / proposal soft-dependency flag); the metric degrades to zeros if the data is absent.

- **No worker, no migration.** The roadmap's Cross-cutting deliverables table assigns no cron to this change and the Entity ownership note assigns no entity. Both constraints are honored: pure read-side feature module in `apps/api`.

## Risks / Trade-offs

- **As-of readiness recomputation cost.** Recomputing readiness at a window boundary for every active user re-runs weak-area aggregation over historical `QuizResponse` rows. v1 mitigates with the small active population and an optional Redis-cached overview; if it grows, a snapshot entity (a future roadmap change, not this one) becomes the right answer. Flagged so it isn't silently shipped as a hot path.
- **LLM-cost proxy accuracy.** The coefficient model can drift from real provider cost; it is explicitly a guardrail estimate, not billing. Coefficients are config so they can be tuned against the aggregate Prometheus token series. A future change could add a real per-user usage ledger (new entity) if exactness is required.
- **Small-sample noise in medians/cohorts.** Early on, median north-star gain and W2/W4 retention will be noisy with few users; the dashboard reports the population/cohort size alongside each figure so an admin can judge significance. PRD §3 already frames the targets as tunable starting bars.
- **Reading another change's columns (`exam_outcome_response`).** Coupling to `email-lifecycle` without a declared roadmap edge. Mitigated by graceful degradation and the explicit flag to add the edge.
- **Active-user definition edge cases.** "Completed" must exclude `abandoned` (cron-marked) and must decide partial-completion sessions. Decision: a session counts toward active-user/completion once it has reached the end-of-session summary (ended via `/end`, status `completed` or partial), never if `abandoned`. Unit-tested at the boundary.

## Open Questions

- **As-of readiness entry point.** Does `ReadinessService.compute` already accept (or can it cheaply accept) an as-of timestamp, or must the analytics service recompute readiness-at-T from raw `QuizResponse`/`MockExam` rows itself? Default: do **not** expand the readiness service contract; compute as-of readiness inside the analytics service from the same raw inputs. Resolve by reading `ReadinessService` during task 3.
- **Undeclared dependency on `email-lifecycle`.** The lagging pass-rate read model reads `exam_outcome_response`, but the roadmap dependency graph has no `email-lifecycle --> product-analytics` edge (declared Depends on: `sessions`, `agent`, `readiness`). `email-lifecycle` is archived so the data exists, but the roadmap should gain the edge — flagged for a roadmap update rather than silently relied upon. If rejected, the lagging metric degrades to "no data."
- **North-star window length.** PRD's table says "per 2-week window"; the v1 *target* is "over the first 4 weeks of active use ≥ +15." Default `ANALYTICS_NORTHSTAR_WINDOW_DAYS = 28` to match the target the dashboard compares against, with the window configurable. Confirm with product which window the dashboard headlines.
- **Should the overview surface the ops guardrails (agent/SSE error rate, ingestion success) inline by querying Prometheus, or just link out?** Default: omit/link-out — they live in Prometheus and re-deriving them is out of this change's Scope.
