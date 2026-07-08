## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Fix the fixture scale first (it currently masks the bug): in `apps/web/e2e/support/mock-exam-seed.ts` change the terminal attempt `score: 73` (line ~218) to the real **0..1 fraction** `0.73`, matching `MockExam.score` (`correct/total`). Keep `passed: true`.
- [ ] 0.2 RED: In `apps/web/e2e/mock-exam.e2e.ts` assert the submitted results hero shows **"73%"** (from `score: 0.73`) via `exam-score-value`. Confirm this now FAILS because `Math.round(0.73) = 1` renders "1%" — reproducing the real bug the old fixture hid.
- [ ] 0.3 RED: Extend the same e2e to assert the design-parity hero additions: a passing-score reference (`Passing score: 72%`) and a "X correct · Y incorrect · Z unanswered" line whose numbers match the seed's `domainBreakdown` + unanswered `questions[].userAnswer`. The passing score comes from the **two-hop certification chain**, so the seed must mock BOTH: **add** `GET /api/v1/user-certifications/:enrollmentId` returning `{ certificationId }` (currently absent — hop 1), and enable the already-defined `GET /api/v1/certifications/:certificationId` read (hop 2, `mock-exam-seed.ts:317-332`). Confirm these fail (elements absent).
- [ ] 0.4 RED: Assert the per-domain table shows a passing-threshold marker and a "Below passing threshold" note on any domain whose accuracy is under the passing score, plus a Weight column. Confirm they fail.
- [ ] 0.5 Confirm every new assertion fails for the RIGHT reason (wrong score scale / missing design elements), not a harness/route-mock error.

## 1. Overall score renders as round(score × 100)% (the HIGH bug)

- [ ] 1.1 RED: Add co-located unit spec `apps/web/app/components/MockExamResultsScene.spec.ts` asserting that with `exam.score = 0.7` the `exam-score-value` renders `70%` (and `0.735 → 74%`, `1 → 100%`, `0 → 0%`). Fails against the current `Math.round(props.exam.score ?? 0)`.
- [ ] 1.2 GREEN: Change `scorePercent` in `MockExamResultsScene.vue:21` to `Math.round((props.exam.score ?? 0) * 100)`.
- [ ] 1.3 RED: Regression-cover the badge scenarios preserved in the MODIFIED requirement — `passed: true` → PASS, `passed: false` → FAIL (poor colour), `passed: null` (diagnostic) → no badge rendered — so the score-scale change does not disturb them.
- [ ] 1.4 REFACTOR: Confirm the pass/fail colour and badge (already driven by `exam.passed`) still read correctly with the corrected number; no duplicate scale conversion anywhere in the scene.

## 2. Passing-score reference + correct/incorrect/unanswered counts in the hero

- [ ] 2.1 RED: Unit-test that the hero renders "Passing score: N%" from the certification `passingScore` resolved via the two-hop chain (`userCertificationsControllerDetail(userCertificationId).certificationId` → `certificationsControllerDetail(certificationId)`), normalised to a percentage, and omits the line when either hop is unavailable. Fails (not rendered).
- [ ] 2.2 RED: Unit-test the derived counts line — correct = Σ `domainBreakdown[*].correct`, unanswered = count of `questions[]` with `userAnswer == null`, incorrect = total − correct − unanswered — rendering "46 correct · 15 incorrect · 4 unanswered" for the fixture. Fails.
- [ ] 2.3 GREEN: In `MockExamResultsScene.vue` resolve the certification via the two-hop chain — reuse the `apps/web/app/composables/useCertDetail.ts` pattern (or the composable itself) with `props.exam.userCertificationId`, both operations already committed in the Orval client (no codegen) — and render the passing-score reference; compute and render the counts line from `domainBreakdown` + `questions`.
- [ ] 2.4 REFACTOR: Extract count derivation into a small pure helper so it is unit-testable without the component; guard against a missing/empty `domainBreakdown`.

## 3. Per-domain passing-threshold marker + weight column

- [ ] 3.1 RED: Unit-test `MockExamDomainBreakdown.vue` (or its spec) that each domain bar renders a threshold marker positioned at the certification passing score, a "Below passing threshold" note when the domain accuracy is under it, and a Weight cell from the certification's per-domain `weight`. Fails.
- [ ] 3.2 GREEN: Pass the passing score and the per-domain `weight` (from the resolved certification's `domains[]`, matched by domain name) into `MockExamDomainBreakdown.vue`; render the marker, note, and Weight column per `openspec/design/MockExam.html` (ExamResults domain table). Reuse `statusColorForScore` for bar colour.
- [ ] 3.3 REFACTOR: Keep weight/threshold optional so the component still renders when the certification join is absent (marker/weight simply omitted); no fabricated defaults.

## 4. Do not present the allowed window as elapsed time

- [ ] 4.1 RED: Unit-test that `timeLabel` is NOT the full `deadline − startedAt` window mislabeled as elapsed — with no real elapsed source the results scene passes `null`/omits the time card rather than showing the whole allowed window as time spent. Fails against current `deadline − startedAt` computation.
- [ ] 4.2 GREEN: Remove the `deadline − startedAt`-as-elapsed computation feeding `SessionSummaryBody`; omit the time label when elapsed is unavailable in the terminal `MockExamResponse`.
- [ ] 4.3 REFACTOR: If a real allowed-window reference is shown ("of Hh Mm allowed"), keep it clearly labelled as the allowed limit, distinct from elapsed.

## 5. In-progress question counter copy (minor)

- [ ] 5.1 RED: Unit-test the active scene's `exam-question-counter` renders the compact `Q 1 / 65` form (per `MockExam.html`) instead of "Question 1 of 65". Update the corresponding assertion in `mock-exam.e2e.ts`. Fails.
- [ ] 5.2 GREEN: Update the question-counter copy in the active scene component to the `Q N / T` form.
- [ ] 5.3 REFACTOR: Confirm no other scene/snapshot relies on the old "Question N of T" string.

## 6. Acceptance Test — Outer Loop GREEN

- [ ] 6.1 Run `yarn workspace apps/web test:e2e` — the full mock-exam loop passes: hero shows "73%" + PASS + "Passing score: 72%" + counts, the domain table shows the threshold marker/weight, and review still works.
- [ ] 6.2 Sanity-check the corrected score across scales (0, a low fraction like 0.01 → "1%", 1 → "100%") reads sensibly and matches the Accuracy card.

## 7. Change Review — Subagent Verification

- [ ] 7.1 Dispatch a subagent to review the change against `proposal.md`, the spec scenarios, and the diff (reviewer reports findings only, does not edit code). Confirm nothing is fabricated — every displayed value traces to `MockExamResponse` or the joined certification.
- [ ] 7.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests.

## 8. Polish

- [ ] 8.1 Run linter and fix all errors (`yarn lint`).
- [ ] 8.2 Run formatter and apply fixes (`yarn format`).
- [ ] 8.3 Run the web type checker with zero errors.
- [ ] 8.4 Run coverage and confirm ≥80% lines/branches/functions for the touched components.
