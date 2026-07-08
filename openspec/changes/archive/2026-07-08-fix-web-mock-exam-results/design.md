## Context

The mock-exam results scene (`apps/web/app/components/MockExamResultsScene.vue`) renders the overall hero score with `Math.round(props.exam.score ?? 0)`. But `MockExam.score` is a **0..1 fraction** (`correct / total`), computed by `apps/api/src/mock-exam/mock-exam-scorer.ts` and persisted verbatim. So every submitted attempt shows `0%` or `1%` in the hero, contradicting the Accuracy card and the per-domain rows on the same screen (which use fraction-aware fields correctly). This is a 🔴 HIGH correctness bug affecting 100% of attempts.

The defect is invisible in the current test suite because the e2e fixture seeds `score: 73` (a 0-100 value — `apps/web/e2e/support/mock-exam-seed.ts:218`), the wrong scale for the real contract. `Math.round(73) = 73` looks correct, so the green e2e masks the bug.

Separately, the ExamResults hero and domain table have drifted from `openspec/design/MockExam.html`: the hero omits the passing-score reference and the correct/incorrect/unanswered counts; the domain table omits the per-domain passing-threshold marker, the "below passing threshold" note, and the Weight column. The certification data those elements need (`passingScore`, per-domain `weight`) is reachable from the attempt via `userCertificationId` — the e2e seed already mocks that certification read (`mock-exam-seed.ts:316-332`, `passingScore: 72`, domain weights) — so these are real, sourced values, not fabricated ones.

## Goals / Non-Goals

**Goals:**
- Render the overall score as `round(score × 100)%` so a 0..1 fraction reads as a correct percentage.
- Correct the test fixtures to carry `score` on the real 0..1 scale so tests exercise the true contract.
- Raise ExamResults fidelity to `MockExam.html`: passing-score reference + correct/incorrect/unanswered counts in the hero; per-domain threshold marker, below-threshold note, and Weight column — all sourced from the certification join.
- Stop mislabeling the full allowed window (`deadline − startedAt`) as elapsed time.
- Minor: adopt the design's compact `Q N / T` in-progress question counter.

**Non-Goals:**
- Changing backend scoring. `MockExam.score` as a 0..1 fraction is correct and stays as-is; this is a UI-only rendering fix.
- Any API, DB, or shared-contract change. No new fields are added to `MockExamResponse`.
- Adding a question-flag feature. The design's in-progress "Flagged" legend implies flag state that `MockExamQuestion` does not carry — explicitly out of scope.
- Reworking the reused `SessionSummaryBody` (readiness / weak-area / drill), which renders correctly.

## Visual Design

Visual source of truth: the in-repo design mockups at `openspec/design/*.html` (no DesignSync needed — designs are already committed).

| Artboard / screen (in `openspec/design/MockExam.html`) | Maps to |
|---|---|
| `ExamResults` — score hero (overall %, PASS/FAIL, "Passing score: N%", "X correct · Y incorrect · Z unanswered") | `apps/web/app/components/MockExamResultsScene.vue` hero |
| `ExamResults` — domain table (Weight + Score columns, per-domain bar, threshold marker, "Below passing threshold" note) | `apps/web/app/components/MockExamDomainBreakdown.vue` |
| `ExamResults` — actions (Review all answers / Return to dashboard) | `MockExamResultsScene.vue` actions (unchanged) + reused `SessionSummaryBody.vue` |
| `ExamActive` — compact `Q N / T` question counter | active-scene counter in `apps/web/app/components/MockExamActiveScene.vue` |

**Layout to implement:** no new layout — the full-screen agent-free mock shell already exists; this change adjusts the hero, the domain-table rows, and the counter copy within it.

### Design ↔ contract reconciliation

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Hero "Passing score: 72%" + per-domain threshold marker + Weight column | Not on `MockExamResponse`; existing spec said "MUST NOT fabricate" | Source from the attempt's certification (`passingScore`, per-domain `weight`) joined via `userCertificationId`; omit — not default — when the certification is unavailable |
| Hero "46 correct · 15 incorrect · 4 unanswered" | No count fields on the response | Derive: correct = Σ `domainBreakdown[*].correct`; unanswered = `questions[]` with `userAnswer == null`; incorrect = total − correct − unanswered |
| Hero "Completed in 1h 47m of 2h 10m allowed" (elapsed) | Elapsed time is not in the terminal response | Do not present `deadline − startedAt` as elapsed; omit the time card when no real elapsed value exists |
| In-progress legend "Answered / Flagged" | No flag state on `MockExamQuestion`; no flag feature | Keep "Current"; do not invent a flag capability (descoped) |

## Test Boundaries

Following `web-mock-exam` (and `web-session-view`), the acceptance e2e drives the real `apps/web` against a **fully mocked HTTP API** via Playwright `route` fulfil — no running NestJS API, no Postgres. The fixture lives at `apps/web/e2e/support/mock-exam-seed.ts`.

| Dependency | In acceptance test (Playwright e2e) | In unit/component tests |
|---|---|---|
| Mock-exam API (`GET/PUT/POST /api/v1/mock-exams/:id[...]`, `/summary`, `/drill`) | HTTP-mocked via Playwright `route` fulfil, from `apps/web/e2e/support/mock-exam-seed.ts` | props/fixtures passed directly to the component; no HTTP |
| User-certification detail (`GET /api/v1/user-certifications/:id`) — **hop 1**, resolves `certificationId` from the attempt's `userCertificationId` | HTTP-mocked; **the seed must add this route** (currently absent — it mocks only `/certifications/:id`), returning `{ certificationId }` for `enrollmentId` | supplied as a prop / injected fixture (`certificationId` known) |
| Certification detail (`GET /api/v1/certifications/:id`) — **hop 2**, passing-score + per-domain weight | HTTP-mocked (seed already defines it at `mock-exam-seed.ts:317-332`; enable it for these assertions) | supplied as a prop / injected fixture |
| Test input — terminal attempt `score` scale | **corrected fixture: `score: 73` → `0.73`** (real 0..1 fraction); this correction is the test-input boundary that unmasks the bug | component specs assert `0.7 → "70%"`, `0 → "0%"`, `1 → "100%"` directly |
| Postgres / Testcontainers | not used (API is mocked at HTTP) | not used |
| LLM (Vercel AI SDK) | not used (no generation in the results path) | not used |
| `SessionSummaryBody` (reused from `web-session-view`) | real component, fed by the mocked `/summary` envelope | real component or shallow-stubbed as needed |

## Decisions

- **Render `round(score × 100)`.** `score` is a 0..1 fraction end-to-end; the single correct conversion point is the results hero. Alternative — normalize on the backend to 0-100 — rejected: the contract and scorer are correct and other consumers (Accuracy card, domain accuracy) already treat values as fractions; changing the backend would ripple and is out of scope.
- **Fix the fixture scale first.** The bug is masked by `score: 73`. Correcting the fixture to `0.73` is done as task 0.1 so the acceptance assertion ("73%") fails for the right reason and the corrected component makes it pass — otherwise a `round(score × 100)` fix would turn the masked fixture into "7300%".
- **Source passing-score / weight / threshold from the certification join, omit-not-fabricate.** The attempt carries only `userCertificationId`, not `certificationId`, so the certification is reached via a **two-hop resolution chain** — exactly the committed pattern in `apps/web/app/composables/useCertDetail.ts`:
  1. `userCertificationsControllerDetail(userCertificationId)` → `.certificationId`
  2. `certificationsControllerDetail(certificationId)` → `CertificationResponseDto` with `passingScore: number` and `domains: { name, weight }[]`.

  Both operations are already committed in the Orval client (`apps/web/src/api/user-certifications/user-certifications.ts`, `apps/web/src/api/certifications/certifications.ts`) — **no `yarn codegen` needed**. The results scene should reuse the `useCertDetail`-style resolution (or the composable directly) rather than re-implement it. When either hop is unavailable, the passing-score reference, threshold markers, and Weight column are omitted rather than shown with placeholder values — this preserves the existing spec's "no fabrication" intent while achieving design parity. Per-domain "threshold" is the single certification passing score drawn on each bar (matching the design, where all domains share one threshold line).
- **Derive counts from the terminal attempt.** Correct/incorrect/unanswered are computable from `domainBreakdown` (correct/total) and `questions[].userAnswer`; no new contract field is needed. Extract the derivation into a pure helper for unit-testability.
- **Do not present the allowed window as elapsed.** The current `timeLabel` computes `deadline − startedAt` (the full allowed window) and feeds it to the summary body's time card as if it were time spent. Since elapsed time is not in the terminal response, omit the time card rather than mislabel it.
- **Compact question counter.** `Q N / T` per the design; a copy-only change to the active-scene counter, with the existing e2e assertion updated in lockstep.

## Risks / Trade-offs

- **The fixture correction touches a shared seed used by the existing green e2e** → apply the scale fix and update every dependent assertion (e.g. `exam-score-value` expecting "73") in the same task so the suite stays coherent.
- **The certification join adds a second request to the results path** → it is read-only, cacheable via vue-query, and the scene degrades gracefully (omit-not-fabricate) if it fails, so it never blocks the score/badge/counts.
- **Certification `passingScore` scale ambiguity** — the scorer comment notes `Certification.passingScore` is a 0-1000 scale normalised by /1000, while the web certification model / seed uses `72` (a percentage) → normalise to a percentage at the display boundary and cover it with a unit test rather than hardcoding a divisor.
- **Design shows a Weight column but the team-lead ask centred on the threshold marker** → Weight is included because it is genuinely sourceable from the certification domains; it is optional and omitted when the join is unavailable, so it adds no fabrication risk.

## Open Questions

- Exact normalisation of certification `passingScore` to a percentage (÷1000 vs already-percentage) — resolve by inspecting the actual certifications client/DTO the web consumes during GREEN; the display helper must handle whichever scale the real endpoint returns.
- Whether an allowed-window reference ("of Hh Mm allowed") should still be shown once elapsed is removed, or the time line dropped entirely from the mock results — defaulting to dropping the mislabeled elapsed value; a labelled allowed-limit line is optional if a real source exists.
