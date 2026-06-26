## Reviewed Artifacts

- proposal.md
- specs/diagnostic-exam/spec.md (new capability)
- specs/exam-readiness/spec.md (modified delta)
- specs/mock-exam/spec.md (modified delta)
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | Task 1.1/1.2 implied a possibly-distinct generation queue and a new job payload, contradicting design.md's decision to branch the *shared* generation path by `type` (reusing `MOCK_EXAM_GENERATION_QUEUE` and the existing `{ attemptId }` payload). | Rewrote 1.1/1.2 to drop the new queue/payload and explicitly reuse the existing queue + payload, keeping only the offer enum, diagnostic-create response, and the nullable `passed` change. | tasks.md §1 |
| SUGGESTION | specs/diagnostic-exam/spec.md ↔ tasks.md | The "Answering a diagnostic uses the shared answer endpoint" scenario has no dedicated component task (it reuses the mock-exam answer endpoint). | Verified it is exercised by the acceptance path (task 0.2 answers questions) and by the reuse note in task 9.3; no new task required since no new endpoint is built. | none (coverage confirmed) |

## No Remaining Implementation-Blocking Gaps

All three capabilities named in proposal.md (`diagnostic-exam` new; `exam-readiness`, `mock-exam` modified) have matching spec files; the two modified deltas reproduce the full existing requirement text from `openspec/specs/<capability>/spec.md` under `## MODIFIED Requirements`. Every spec scenario maps to acceptance and/or unit/integration work in tasks.md, and the outside-in ordering (shared contracts → migration → config → pure planner → generation → shared derivations → finalize → readiness exclusion → create → offer → re-take → outer GREEN → review → polish) is intact. design.md Test Boundaries names every collaborator the tasks rely on (ProviderAdapter-mocked LLM; real Postgres/Redis, `QuizModule`, `WeakAreasModule`, `spaced-repetition` event listener, `ReadinessService`); no task invents an unnamed mock boundary. The single migration (nullable `UserCertification.diagnosticRePromptedAt` column extension — not a new entity) and the Orval client regeneration both have tasks. Dependencies `mock-exam`, `weak-areas`, `readiness`, `review-srs` are all archived. No implementation-blocking gaps remain.

## Deferred Non-Blocking Notes

- **"Abandonment = skip" emerges from the null-deadline design rather than a new cron.** The diagnostic carries a null `deadline`, so the existing `mock-exam` auto-submit cron (which queries `deadline < cutoff`) never matches it. There is therefore no diagnostic-specific cron task; the behavior is asserted at the acceptance level (task 0.3) and follows directly from the deadline-null branch in task group 5. This matches the cross-cutting deliverables table, which assigns no cron to `diagnostic`.
- **Two intentional cross-capability modifications were required by SPEC and are recorded as MODIFIED deltas, not new scope.** (1) `exam-readiness` currently folds `type: diagnostic` `MockExam`s into the higher-weight mock blend; SPEC requires the diagnostic to enter readiness at *low* weight, so the delta excludes diagnostics from that blend (they still contribute via the recency-decayed `WeakArea` path and still trip the calibration gate). (2) `mock-exam`'s `deriveGeneration` keyed `ready` off a non-null `deadline`, which would strand an optional-timer diagnostic in `preparing`; the delta re-keys it off set completion (`startedAt`). Both are behavior-equivalent for real mocks. These are the substance of "low-weight seeding" and "lenient/optional timer" in the roadmap scope, contained to this change.
