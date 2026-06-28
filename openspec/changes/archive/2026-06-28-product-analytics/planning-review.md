## Reviewed Artifacts

- proposal.md
- specs/product-analytics/spec.md
- design.md
- tasks.md

Reviewed as a single contract for cross-artifact consistency, capability/scenario coverage, design completeness, test boundaries, task alignment, and contradictions/stale assumptions against the Spec ref (PRD §3) and the archived dependency specs (`sessions`, `agent`, `readiness`, plus `quiz`, `mock-exam`, `email-lifecycle`).

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | proposal / spec | The roadmap Scope lists "per-user LLM-cost attribution," but no per-user token/cost is persisted anywhere — the LLM gateway emits token usage only as aggregate Prometheus series labelled by model/use-case. Taken literally, the metric is uncomputable without a new entity (which the roadmap forbids for this change). | Reframed the metric as an explicit coefficient-based **proxy** over countable LLM-driven artifacts × configured cost coefficients ÷ active users, labelled an estimate; added the `ANALYTICS_COST_*` config and a dedicated spec requirement. | proposal → What Changes (LLM-cost); spec → "LLM-cost-per-active-user guardrail (derived proxy)"; design → Decisions |
| WARNING | proposal / spec | The roadmap Scope names agent/SSE error rate and content-ingestion success rate as guardrails, but both are already emitted as operational Prometheus series by `agent` and `observability`/`content-pipeline`. Re-deriving them here would duplicate ops telemetry and exceed the Scope ("metrics the SPEC's ops metrics don't cover"). | Scoped this change to the LLM-cost guardrail only; the other two guardrails are surfaced by reference, not re-derived, and the spec explicitly forbids re-deriving them. | proposal → Why / Modified Capabilities; spec → guardrail requirement; design → Decisions |
| WARNING | design / spec | North-star "readiness-gain over time" needs a readiness time-series, but readiness is read-through with **no history table** (the `exam-readiness` spec forbids a readiness entity) and this change owns no entity. Without a resolution the metric is unimplementable. | Resolved via as-of recomputation from the immutable timestamped `QuizResponse`/`MockExam` rows that already drive readiness — a derived read model, not a new snapshot entity. Documented as the central tension with a fallback path that avoids expanding the readiness-service contract. | design → Decisions / Open Questions; spec → north-star requirement; tasks 3.2 |

## Flagged for Roadmap Update (not silently relied upon)

- **Undeclared dependency on `email-lifecycle`.** The lagging self-reported pass-rate read model reads `exam_outcome_response` on `user_certifications`, a column **owned by `email-lifecycle`**. The roadmap dependency graph lists this change's Depends-on as only `sessions`, `agent`, `readiness` — there is **no `email-lifecycle --> product-analytics` edge**. Both are Phase 9 and `email-lifecycle` is already archived, so the data exists, but the roadmap should gain the edge. The lagging metric is designed to degrade gracefully (report zeros) if the data is absent, so this does not block implementation — but it is a real roadmap inconsistency to record. Recommend adding `emaillc --> analytics` to `IMPLEMENTATION-ORDER.md`.

## No Remaining Implementation-Blocking Gaps

After the fixes above, no implementation-blocking planning gaps remain. Verified:

- **Capability coverage** — The single new capability `product-analytics` named in proposal.md has a matching `specs/product-analytics/spec.md`; all behavior appears under ADDED Requirements (this change owns no entity and modifies no existing capability, consistent with the proposal's empty Modified Capabilities). No capability exists only in design.md or tasks.md. The capability name matches the roadmap Capabilities column exactly — no rename/merge.
- **Entity / migration boundary** — Consistent across all artifacts with the roadmap Entity-ownership note ("No new entities … derived read models over existing tables"): no entity owned, no migration, every input consumed read-only. A spec requirement asserts the absence of any schema change.
- **Scenario coverage** — Every spec requirement maps to outside-in task work: config (1.x), active-user + session-derived metrics (2.x), north-star (3.x), retention (4.x), LLM-cost proxy (5.x), lagging pass rate (6.x), admin overview endpoint + role gating (7.x). Each scenario is concrete enough to become an acceptance assertion and is reflected in the Outer Loop test (0.2).
- **Design completeness** — design.md resolves the implementation-critical choices: single admin overview endpoint computed on demand (no cron, matching the roadmap's no-cron assignment), the shared active-user population, as-of readiness recomputation without a snapshot entity, the explicit LLM-cost proxy, referencing rather than re-deriving the ops guardrails, and graceful degradation of the lagging metric. UI is an explicit Non-Goal (built later in `web-admin`), so no DESIGN.md reconciliation is owed here.
- **Test boundaries** — design.md's Test Boundaries table names each collaborator (Postgres via Testcontainers with a seeded population, real `ReadinessService` vs mocked for assembly logic, real admin guards, injected clock for window/cohort edges, pure stats helpers). No task invents a mock boundary the design does not name; integration tests use a real DB per the project's "never mock the database" rule.
- **Task alignment** — tasks.md follows outside-in order (acceptance test first at section 0, RED→GREEN→REFACTOR within each unit), covers `.env.example` (1.2), the Orval client regeneration (8.3), the optional opportunistic gauge (8.4), subagent review (9.x), and the polish/coverage gates (10.x).
- **Dependencies** — `sessions`, `agent`, `readiness` (declared) and `quiz`, `mock-exam`, `auth`, `user-certifications` (read transitively) are all archived under `openspec/changes/archive/`. The only dependency anomaly is the undeclared `email-lifecycle` edge, flagged above and made non-blocking by graceful degradation.

## Deferred Non-Blocking Notes

- **As-of readiness recompute cost** — design.md (Risks) intentionally defers any snapshot/materialization optimization; v1 recomputes as-of readiness over historical rows for the small active population, with an optional Redis-cached overview. A future readiness-snapshot entity (a separate roadmap change) is the right answer if volume grows — out of scope here.
- **LLM-cost proxy accuracy** — the coefficient model is explicitly a guardrail estimate, tunable via config against the aggregate Prometheus token series; a real per-user usage ledger (new entity) is a possible future change, not this one.
- **North-star window length** — defaulted to 28 days to match the v1 target ("first 4 weeks of active use ≥ +15") while PRD's table phrases it "per 2-week window"; configurable and carried as an Open Question to confirm with product. Non-blocking.
- **Read-optimizing indexes** — none added in v1; may be introduced later via this change's own non-owning migration if profiling warrants, without altering entity semantics.
