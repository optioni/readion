## Why

A submitted mock exam shows a nonsensical hero score of `0%` or `1%` for every attempt, contradicting the Accuracy card and per-domain rows right beside it. The backend `MockExam.score` is a **0..1 fraction** (`correct / total` — `apps/api/src/mock-exam/mock-exam-scorer.ts:19`, persisted verbatim by `mock-exam.service.ts`). The results scene renders it with `Math.round(props.exam.score ?? 0)` (`apps/web/app/components/MockExamResultsScene.vue:21`), so a 70% exam becomes `Math.round(0.7) = 1` → "1% overall score / FAIL". This is a 🔴 HIGH correctness bug: the primary number a learner sees after a timed exam is wrong for 100% of attempts, and it disagrees with the domain breakdown on the same screen.

The bug is currently masked in tests because the e2e fixture seeds `score: 73` (a 0-100 value — `apps/web/e2e/support/mock-exam-seed.ts:218`), which is the wrong scale for the real API. `Math.round(73) = 73` happens to look right, so the green e2e hides a defect that only appears against a real backend.

Separately, the ExamResults hero and domain table have drifted from the `MockExam.html` design: the hero is missing the passing-score reference, the correct/incorrect/unanswered counts, and the domain table is missing the per-domain passing-threshold marker + "below passing threshold" note. The certification data needed for these (its `passingScore` and per-domain `weight`) is already reachable from the attempt via `userCertificationId` — the e2e seed even mocks that certification read — so these are real, sourced values, not fabricated ones. A minor in-progress copy nit (compact `Q N / T` counter) is folded in.

Backend scoring is correct; this change is **UI-only**.

## What Changes

- Render the overall score as `round(score × 100)%` (score is a 0..1 fraction), replacing the raw `Math.round(score)`. A 0.7 attempt MUST read "70%", not "1%".
- Fix the e2e / component fixtures to carry `score` on the real 0..1 fraction scale so tests exercise the true contract instead of a 0-100 value that masks the bug.
- Add to the results hero (per `MockExam.html`): a "Passing score: N%" reference sourced from the attempt's certification (`passingScore`, via `userCertificationId`), and a "X correct · Y incorrect · Z unanswered" line derived from `domainBreakdown` (correct/total) and `questions[].userAnswer` (unanswered).
- Add to the per-domain table (per `MockExam.html`): a passing-threshold marker drawn at the certification passing score on each domain bar, a "Below passing threshold" note for domains under it, and the per-domain Weight column sourced from the certification's domain weights.
- Stop presenting the full allowed exam window (`deadline − startedAt`) as if it were elapsed/completed time. Elapsed time is not carried by the terminal `MockExamResponse`, so it MUST be omitted rather than mislabeled.
- Minor in-progress copy: the question counter adopts the design's compact `Q N / T` form.

## Capabilities

### Modified Capabilities
- `web-mock-exam`: correct the results-scene score rendering to `round(score × 100)%`, and raise ExamResults / in-progress design fidelity (passing-score reference, correct/incorrect/unanswered counts, per-domain threshold markers + weight, compact question counter) — all sourced from real contract/certification data, none fabricated.

## Impact

- **UI-only.** No API, DB, or shared-contract change — the backend `MockExam.score` fraction is already correct.
- **`apps/web`:** `app/components/MockExamResultsScene.vue` (score×100, counts, passing-score line, time-label fix), `app/components/MockExamDomainBreakdown.vue` (threshold marker, weight column, below-threshold note), the active scene's question counter component; the results scene now joins the attempt's certification (via `userCertificationId`) to read `passingScore` and per-domain `weight` through the already-committed certifications client.
- **Tests:** `apps/web/e2e/support/mock-exam-seed.ts` (`score: 73` → `0.73` fraction; enable the certification read) and `apps/web/e2e/mock-exam.e2e.ts` (assert "73%" from the fraction, passing-score line, counts, threshold marker). New co-located unit spec `MockExamResultsScene.spec.ts`.
- **Descope note — flagged-question legend:** the design's in-progress nav legend reads "Answered / Flagged", but `MockExamQuestion` carries no flag state and no flag capability exists. This change keeps the "Current" legend and does **not** invent a flag feature; adding one would be a separate contract change.
