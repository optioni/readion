## Reviewed Artifacts

- `proposal.md`
- `design.md`
- `specs/exam-readiness/spec.md`
- `tasks.md`
- Cross-checked against: SPEC → Exam Readiness Score (incl. trajectory) + Configuration ("readiness calibration threshold"); PRD §3 (north star), FR3, FR19; IMPLEMENTATION-ORDER.md (`readiness` row, Entity ownership, Cross-cutting deliverables, dependency graph); archived `weak-areas`, `mock-exam`, `quiz` (`quiz-scoring`), `user-certifications`, `database-foundation` specs.

## Gaps Found and Fixed

| Severity | Where | Gap | Resolution |
|---|---|---|---|
| HIGH | entity boundary | Entity-ownership table assigns readiness no entity, but `user-certifications` design said readiness would "add columns" to `UserCertification`. Ambiguous whether to migrate a column. | Resolved to **no entity / no migration**, read-through derivation (mirrors how `weak-areas` actually resolved its endpoint). `readinessScore` is a computed attribute. Added an explicit spec requirement + scenario asserting no table is created/altered, and a tasks assertion (5.3). |
| HIGH | mock weighting vs. `QuizResponse` | `QuizResponse` (owned by `quiz`) carries no mock-vs-quiz origin discriminator, so mock results cannot be up-weighted in-place without extending another change's entity. | Readiness reads `MockExam` rows directly as the higher-weighted signal and treats mock as a **soft, optional** input; calculator returns a score with zero mocks. Documented as a decision with the rejected alternative (origin column on `QuizResponse`). |
| MEDIUM | calibration source | Need a graded-answer count for the calibration gate without a parallel count path. | Use the sum of `WeakArea.responseCount` (already aggregated by `weak-areas`) plus submitted-diagnostic detection. |
| MEDIUM | trajectory data | SPEC trajectory needs "recent rate of readiness gain" but there is no readiness-snapshot store. | Compute point-in-time readiness over windows of the response/mock timeline (`BaseEntity.createdAt`); hide until enough history; informational only. Marked formula as tunable/open. |
| LOW | test harness type | Backend-only change; an outer Playwright e2e would have no UI. | Outer acceptance test is an API-level `*.acceptance.spec.ts` (same adaptation as `quiz`/`weak-areas`/`mock-exam`), noted in design Test Boundaries and tasks group 0. |

## No Remaining Implementation-Blocking Gaps

- Dependencies satisfied: `weak-areas` archived (hard dep); `mock-exam` archived (soft input). No missing dependency.
- Capability name `exam-readiness` matches the roadmap Capabilities column exactly.
- No cron and no Prometheus metric are attributed to `readiness` in the cross-cutting tables; none invented. (North-star readiness-gain instrumentation is owned by `product-analytics`.)
- Config threshold (`READINESS_CALIBRATION_MIN_ANSWERS`, default 10) is the SPEC default, read from config not hardcoded.

## Deferred Non-Blocking Notes

- Exact readiness coefficients (domain blend, mock weight, recency half-life) and the trajectory formula are deferred to implementation/tuning per SPEC ("formula left flexible"); specs assert behavioral properties, not constants. Validate score movement against mock outcomes (PRD risk "Readiness-score credibility").
- Downstream consumers (`diagnostic` low-weight seeding, `end-of-session-summary` readiness-change line, `agent` `getUserProgress`, `web-dashboard`/`web-progress`, `email-lifecycle` digest, `product-analytics`) consume `ReadinessService.compute` / the endpoint / the `readinessScore` attribute; they are out of scope here.
