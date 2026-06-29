## Reviewed Artifacts

- proposal.md
- specs/web-mock-exam/spec.md
- design.md
- tasks.md

Reviewed against the source-of-truth contracts: SPEC.md (Frontend → Mock exam; MockExamModule; Mock Exam Lifecycle), the implemented backend (`apps/api/src/mock-exam/mock-exam.controller.ts`, `mock-exam.service.ts`, `session-summary.controller.ts` → `MockExamSummaryController`), the shared DTOs (`packages/shared/src/mock-exam/index.ts`, `packages/shared/src/session-summary/index.ts`), the committed Orval client (`apps/web/src/api/mock-exam`, `enrollment-mock-exam`, `mock-exam-summary`), the reused `apps/web/app/components/SessionSummaryBody.vue` + `composables/statusColor.ts` + `useElapsedTimer.ts` + `runnerRoutes.ts`, and the design artboard `../../design/MockExam.html`.

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | specs/web-mock-exam/spec.md | The results requirement asserted a PASS/FAIL badge unconditionally, but the contract types `passed` as `boolean \| null` (a `diagnostic`-type attempt returns `passed: null`). The scene would render a misleading or broken badge. | Required the badge to render only when `passed` is non-null and be omitted when null; added a "Null passed omits the badge" scenario. | specs → "Results scene shows the exam-faithful score breakdown by domain" |
| WARNING | design.md | The reused `SessionSummaryBody` already renders its own "Drill my misses" (primary) and "Back to dashboard" (secondary) buttons, while the `ExamResults` artboard also has "Return to dashboard" — mounting the body as-is would produce two competing dashboard/back controls and two primaries. | Added an action-ownership decision: the score hero owns only "Review all answers"; the body owns "Drill my misses" + the single "Back to dashboard"; the artboard's duplicate "Return to dashboard" is dropped. | design.md → Decisions ("Action ownership…") |
| SUGGESTION | tasks.md | Task 6 did not cover the null-`passed` badge omission, the de-duplicated dashboard control, the derived `timeLabel`, or the exact Orval summary/drill method names. | Expanded 6.1/6.2 to test the null-`passed` path, assert a single back control with "Review all answers" as the only added action, derive `timeLabel` from `startedAt`/`deadline`, and pin `mockExamSummaryControllerSummary`/`Drill`. | tasks.md → section 6 |

## Endpoint → Orval method pinning (verified present; no `yarn codegen` needed)

Every endpoint the spec/design/tasks consume is already committed in `apps/web/src/api/`, confirmed by export grep:

| Operation | Endpoint | Committed Orval export |
|---|---|---|
| Load / poll / resume attempt | `GET /api/v1/mock-exams/:id` | `useMockExamControllerFindOne` / `getMockExamControllerFindOneQueryOptions` (`api/mock-exam`) |
| Answer by zero-based index | `PUT /api/v1/mock-exams/:id/answers/:questionIndex` | `useMockExamControllerSaveAnswer` (`api/mock-exam`) |
| Submit / auto-submit | `POST /api/v1/mock-exams/:id/submit` | `useMockExamControllerSubmit` (`api/mock-exam`) |
| Post-exam summary | `GET /api/v1/mock-exams/:id/summary` | `useMockExamSummaryControllerSummary` / `getMockExamSummaryControllerSummaryQueryOptions` (`api/mock-exam-summary`) |
| Drill my misses | `POST /api/v1/mock-exams/:id/drill` | `useMockExamSummaryControllerDrill` (`api/mock-exam-summary`) |
| Create/start (invoked upstream) | `POST /api/v1/user-certifications/:id/mock-exams` | `useEnrollmentMockExamControllerCreate` (`api/enrollment-mock-exam`) |

The `minimal` layout (`apps/web/app/layouts/minimal.vue`) and the route helper `mockExamRunPath` (`/mock-exams/:id`) both already exist, so the page slots into the established routing without new scaffolding.

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved:
- Capability coverage: the single proposal capability `web-mock-exam` maps to one spec file; no capability lives only in tasks/design.
- Scenario coverage: every spec scenario names concrete inputs/outputs (poll sequence lengths, zero-based index paths, `remainingSeconds` values, terminal/409 handling, null `passed`) and has matching acceptance work in tasks §0 and unit work in §1–8.
- Contract fidelity: stream-in is correctly modelled as **polling** `GET /mock-exams/:id` (no mock-exam SSE endpoint exists), answers persist by **zero-based index** (not question id), reveal fields (`correctAnswer`/`explanation`/`citations`) are gated on a terminal attempt, the timer is a **server-anchored countdown** (not the session view's up-counting `useElapsedTimer`), and PASS/FAIL handles the nullable `passed`.
- Test boundaries: design.md names every mocked/real collaborator; no task invents a boundary design.md does not list.
- No codegen: all consumed endpoints are confirmed present in the committed Orval client.

## Deferred Non-Blocking Notes

- **`SessionSummaryBody` ask-agent suppression** (design.md reconciliation + Decisions; tasks §6.2): a small backward-compatible prop is added to the shared component to suppress its "Ask agent about this" affordance in the agent-free mock context. Default behaviour is unchanged for `web-session-view`. Wiring post-exam questions to a tutor is deferred to `web-agent-chat`.
- **Client-only "Flag"** (design.md reconciliation; spec §"Active exam"/tasks §2): the artboard's per-question flag has no backend field and would not survive resume; it is implemented as session-local presentation state (or omitted) and flagged as a candidate backend feature — not blocking.
- **Numeric passing score + per-domain weight/threshold** (design.md reconciliation; Open Questions): omitted because `MockExamResponse` exposes neither; PASS/FAIL from `passed` and accuracy from `domainBreakdown` are sufficient. An optional `GET /certifications/:id` join to surface the passing-score number and domain weights is a deferred enhancement, not required by the behavioural spec.
