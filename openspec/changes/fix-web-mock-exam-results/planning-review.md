## Reviewed Artifacts

- proposal.md
- specs/web-mock-exam/spec.md
- design.md
- tasks.md

Reviewed as one contract, cross-checked against the source-of-truth code: the scorer (`apps/api/src/mock-exam/mock-exam-scorer.ts` — `score = correct/total`, 0..1), the shared contract (`packages/shared/src/mock-exam/index.ts` — `score: number | null`, `passed: boolean | null`, `MockExamResponse.userCertificationId`, `domainBreakdown`, `questions[].userAnswer`), the current component (`apps/web/app/components/MockExamResultsScene.vue`), the committed Orval client (`apps/web/src/api/certifications`, `apps/web/src/api/user-certifications`, model DTOs), the existing composable `apps/web/app/composables/useCertDetail.ts`, the e2e fixture `apps/web/e2e/support/mock-exam-seed.ts`, the design artboard `openspec/design/MockExam.html` (ExamResults + ExamActive), and the archived `web-mock-exam` planning-review (which deferred exactly the passing-score/weight/threshold join this change now realizes).

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | design.md + tasks.md | The passing-score / threshold / weight sourcing said "join via `userCertificationId`", but the attempt carries only `userCertificationId`, **not** `certificationId`. Reaching `passingScore`/domain weights needs a two-hop chain (`userCertificationsControllerDetail(id).certificationId` → `certificationsControllerDetail(certificationId)`). Left as-is, the implementer would have no path from the attempt to the certification. | Documented the exact two-hop resolution chain, pinned both committed Orval operations (verified present — `CertificationResponseDto` carries `passingScore` + `domains[].weight`; **no codegen**), and pointed at the existing `useCertDetail.ts` pattern to reuse. Updated the GREEN tasks to resolve via that chain. | design.md → Decisions ("Source passing-score…two-hop resolution chain"); tasks.md → 2.1, 2.3, 3.2 |
| CRITICAL | design.md (Test Boundaries) + tasks.md | The acceptance test could not pass: the seed mocks only `GET /api/v1/certifications/:id` (hop 2), but hop 1 (`GET /api/v1/user-certifications/:enrollmentId` → `{ certificationId }`) is **not** mocked, so the certification is unreachable in the e2e. Test Boundaries named only the single certification read. | Added the user-certification detail read as a distinct HTTP-mocked boundary (hop 1) and stated the seed must add that route; updated task 0.3 to mock BOTH endpoints. | design.md → Test Boundaries (two rows); tasks.md → 0.3 |
| SUGGESTION | tasks.md | The MODIFIED results requirement preserves the "Fail renders a fail badge" and "Null passed omits the badge" scenarios, but no task exercised `passed: false` / `passed: null` — the score-scale edit could regress them silently. | Added a RED regression task covering PASS / FAIL / null-badge so every preserved scenario has owning task work. | tasks.md → 1.3 (new) |

## Endpoint → committed Orval method pinning (verified present; no `yarn codegen` needed)

| Operation | Endpoint | Committed Orval export | Carries |
|---|---|---|---|
| Load / poll / resume / terminal attempt | `GET /api/v1/mock-exams/:id` | `mockExamControllerFindOne` (`api/mock-exam`) | `score` (0..1), `passed`, `domainBreakdown`, `questions[].userAnswer`, `userCertificationId` |
| Post-exam summary (reused body) | `GET /api/v1/mock-exams/:id/summary` | `mockExamSummaryControllerSummary` (`api/mock-exam-summary`) | `SessionSummaryResponse` |
| Drill my misses | `POST /api/v1/mock-exams/:id/drill` | `mockExamSummaryControllerDrill` (`api/mock-exam-summary`) | `{ status, session? }` |
| Passing-score chain, hop 1 | `GET /api/v1/user-certifications/:id` | `userCertificationsControllerDetail` (`api/user-certifications`) | `certificationId` |
| Passing-score chain, hop 2 | `GET /api/v1/certifications/:id` | `certificationsControllerDetail` (`api/certifications`) | `passingScore: number`, `domains: { name, weight }[]` |

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved:
- **Capability coverage:** the single proposal capability `web-mock-exam` maps to one `specs/web-mock-exam/spec.md`; both changed requirements are under `## MODIFIED Requirements` with the exact existing headers; nothing lives only in tasks/design.
- **Scenario coverage:** every scenario has owning acceptance/unit work — fractional score → §0.2/1.1, passing-score + counts → §0.3/2.x, per-domain threshold/weight → §0.4/3.x, cert-unavailable omit-not-fabricate → §2.1/3.3, allowed-window-not-elapsed → §4.1, compact `Q N/T` counter → §5.1, and PASS/FAIL/null-badge → §1.3.
- **Design completeness:** the certification-resolution contract (two hops, pinned methods, no codegen), UI states (omit-not-fabricate), and the visual reconciliation table are all resolved before coding.
- **Test boundaries:** design.md now lists both certification reads as HTTP-mocked, plus the fixture score-scale correction (73 → 0.73) as the test-input boundary; no task invents an unlisted boundary; Postgres/Testcontainers and LLM are correctly out of this UI path.
- **Contradictions/stale assumptions:** the score×100 change corrects the pre-existing `score: 73 → 73%` scenario inside the MODIFY (now `0.73 → 73%`), consistent with the 0..1 backend; the passing-score realization is the enhancement the archived `web-mock-exam` review explicitly deferred, so there is no scope conflict.

## Deferred Non-Blocking Notes

- **`passingScore` scale** (design.md Risks + Open Questions): the scorer notes `Certification.passingScore` on a 0-1000 scale, while `CertificationResponseDto.passingScore` and the seed use `72` (a percentage). Resolved by normalising at the display boundary during GREEN (task 2.1 asserts "normalised to a percentage"); the display helper must handle whichever scale the real endpoint returns.
- **Elapsed "Completed in Hh Mm" time** (design.md reconciliation; tasks §4): not carried by the terminal `MockExamResponse`; intentionally omitted rather than fabricated — a labelled allowed-limit line remains optional.
- **In-progress "Flagged" legend** (proposal descope; design.md reconciliation): `MockExamQuestion` has no flag state; the "Current" legend is kept and no flag feature is invented — a candidate future contract change, not blocking.
