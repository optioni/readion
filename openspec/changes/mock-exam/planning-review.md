## Reviewed Artifacts

- proposal.md
- specs/mock-exam/spec.md
- design.md
- tasks.md

Cross-checked against `SPEC.md` (MockExamModule, Mock Exam Lifecycle, MockExam entity, provenance/chunk-lifecycle snapshot rules), `openspec/IMPLEMENTATION-ORDER.md` (scope, capabilities, entity ownership, cross-cutting crons), and the archived dependency specs `openspec/specs/quiz-scoring`, `openspec/specs/weak-areas`, and `openspec/specs/grounding-verification`.

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | design.md (Decision #3) + proposal.md + specs | Original design fed weak areas "from the attempt's per-domain breakdown, not `QuizResponse` rows." But `openspec/specs/weak-areas` `recompute` aggregates **`QuizResponse`s** (attributed by the chunk `primaryDomain` in their provenance snapshot) and its spec explicitly anticipates "downstream session/review/**mock** features when they record responses." The breakdown-only path would never update `WeakArea` and would also starve readiness, which reads `QuizResponse`s. | Reworked the persistence decision: the `MockExam` JSONB array stays the timed-attempt source of truth (for stream-in/resume/review/chunk-lifecycle snapshot), and at finalize the shared routine emits one enrollment-scoped `QuizResponse` per question (snapshot-embedding, unanswered=incorrect) then calls `WeakAreasService.recompute`. `quiz-scoring` confirms `QuizResponse` is enrollment-scoped and does NOT reference `SessionItem`, so mock can emit them without a session. | design.md Decisions (#3 + weak-areas decision) & Test Boundaries; proposal.md What Changes (submit) + Impact (depends-on); specs "Mock completion records responses and updates weak areas"; tasks 8.1–8.3, 9.1 |
| WARNING | design.md / specs | Mock-emitted `QuizResponse`s need a confidence value, but a timed exam captures no per-question self-rating while `weak-areas`/`quiz-scoring` model confidence as a required 1–5 input (`WeakArea.meanConfidence` non-nullable; confidence sharpens the score). Unspecified would block the migration/aggregation. | Decided a neutral confidence of `3` (midpoint — contributes accuracy without spuriously sharpening), configurable. Recorded as a decision and reflected in the spec requirement and tasks 8.1/8.3. | design.md Decisions (confidence); specs requirement text; tasks 8.1/8.3 |

## No Remaining Implementation-Blocking Gaps

All capabilities in proposal.md map to a spec file (`mock-exam`), with no Modified capabilities (mock feeds weak-areas through `recompute`, which the archived `weak-areas` spec already designed for — so no requirement change there). Every spec scenario has corresponding acceptance/integration work in tasks.md, in outside-in order (acceptance RED → entity → pure scorer → generation → worker job → endpoints → finalize/cron → GREEN → review → polish). The owned entity (`MockExam`) and its migration, the worker generation job and auto-submit cron (the cross-cutting deliverable for this change), the Orval client regeneration, and the verification/polish steps are all present. No implementation-blocking gaps remain.

## Deferred Non-Blocking Notes

- **chunk-lifecycle forward reference.** The archived `chunk-lifecycle` cleanup cron hard-deletes superseded chunks that no longer back any retained `SessionItem`/`MockExam`. The `MockExam` table only exists after this change lands; verifying that cleanup query actually accounts for `MockExam` snapshots is tracked against `chunk-lifecycle` (already archived) and is out of scope here. Mock's own review path is unaffected because it resolves citations from the on-attempt snapshot, not live chunks (tested in task 6.3).
- **Open questions carried into implementation** (documented in design.md Open Questions, none blocking): exact auto-submit grace default (lean 2 min, config-driven); behavior when a domain lacks enough verified content to fill its slots (lean: generate to achievable count + record shortfall, expected not to occur on a `live` cert per `cert-go-live` coverage bar); confirming the in-progress GET never leaks correct answers (gated by terminal status).
