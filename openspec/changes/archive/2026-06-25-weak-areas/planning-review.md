## Reviewed Artifacts

- proposal.md
- specs/weak-areas/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | design.md / specs / tasks.md | The acceptance test (task 0.2) requires `WeakArea` rows to exist immediately after quiz answering, but `recompute` was only exposed for downstream `sessions`/`review-srs`/`mock-exam` — none of which exist yet — so nothing would trigger aggregation today and the e2e could not pass. | Added a "Read-through recompute until lifecycle triggers exist" decision: the read endpoint recomputes before returning, kept correct by `recompute` being idempotent/full-rebuild. Added the read-through requirement text and a new scenario; updated tasks 4.1/4.2 to build and test it. | design.md → Decisions; spec → "Ranked weak-area read endpoint" requirement + new scenario; tasks.md §4 |
| SUGGESTION | specs/weak-areas/spec.md | "Persisted inputs match the computed score" is an integration concern but lived under the pure-scoring requirement. | Left as-is — it is genuinely a property of recompute persistence and is covered by the recompute integration tests (task 3.1); no change needed. | — |

## No Remaining Implementation-Blocking Gaps

All capabilities in proposal.md (`weak-areas`) have a matching spec file; every requirement is in the `ADDED Requirements` section; every scenario is concrete (named inputs, observable outputs) and has corresponding acceptance/integration task work. Design.md resolves the implementation-critical choices: `WeakArea` entity/migration shape and ownership boundary (reads `QuizResponse`/`UserCertification`/`ContentChunk`, owns none), domain attribution via source-chunk `primaryDomain`, the score-blend boundary (pure unit), full-rebuild idempotent recompute, read-through trigger, ranking/tie-break, and repository-layer ownership scoping. Test Boundaries (real Testcontainers Postgres; no Redis/LLM) match the harness set up in task 0.1, and no task invents a mock the design does not name. Tasks follow outside-in order (e2e → entity → pure scoring → recompute → endpoint → include expansion → codegen → review → polish) and include the Orval client regeneration, subagent review, and the four polish gates. No worker cron or Prometheus metric is in scope, consistent with the roadmap.

## Deferred Non-Blocking Notes

- Diagnostic seeding of the initial `WeakArea` map, recency/decay weighting, and firing `recompute` from real session/review/mock lifecycles are intentionally deferred to their owning downstream changes (`diagnostic`, `readiness`, `sessions`, `review-srs`, `mock-exam`) — recorded in design.md → Non-Goals. The read-through recompute keeps the read path correct in the interim.
