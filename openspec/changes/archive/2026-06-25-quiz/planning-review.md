## Reviewed Artifacts

- proposal.md
- specs/quiz-generation/spec.md
- specs/quiz-scoring/spec.md
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | design.md | The specs reference questions by `:id` (`/quiz/:id/answer`, `/explanation`, `/report`) and the quarantine path needs the item's cache key + provenance, but quiz owns no Question entity (only `QuizResponse`). Nothing defined what `:id` resolves to before a `QuizResponse` exists — implementation-blocking. | Added a "Question identity is the cache handle" decision: the generate response returns an opaque `id` encoding the `{ sourceChunkIds, difficulty, format, certification }` cache key; answer/explanation/report re-read the verified item (incl. `correctAnswer` + `Provenance`) from `llm-cache` by that handle; expired/quarantined handle returns "question no longer available". | design.md → Decisions |
| WARNING | specs/quiz-scoring/spec.md | "Server-side answer scoring" did not say how the verified question is located, nor the behavior when the cached item is gone. | Reworded the requirement to resolve the question from its `:id` cache handle and added a "Answering an expired or quarantined question handle" scenario returning an RFC 7807 error with no persisted response. | specs/quiz-scoring → Server-side answer scoring |
| WARNING | tasks.md | Tasks 4.2 and 5.x did not reflect the cache-handle resolution path, so the new design decision had no implementation coverage. | Updated 4.2 to return/resolve the opaque handle and route report through it, and 5.1/5.2 to test/implement handle resolution incl. the expired/quarantined case. | tasks.md → groups 4, 5 |

## No Remaining Implementation-Blocking Gaps

All capabilities named in proposal.md (`quiz-generation`, `quiz-scoring`) have matching spec files, every spec scenario is concrete and has corresponding acceptance/unit-test work in tasks.md, and the Test Boundaries in design.md cover each collaborator the tests rely on (no task invents an unnamed mock boundary). Entity ownership is consistent across artifacts — quiz owns `QuizResponse` only, with no `SessionItem` FK, deferring session linkage to the downstream `sessions` change. The grounding contract, verifier, orchestration, provenance type, quarantine path, and grounding metrics are consumed from the archived `grounding-verification` capability and are not re-specified here. No implementation-blocking planning gaps remain.

## Deferred Non-Blocking Notes

- design.md → Open Questions intentionally defers (a) whether standalone question generation is a public endpoint vs. an internal service method called by `sessions`/`mock-exam` — resolved provisionally as a thin generate endpoint for e2e coverage, revisited when `sessions` lands — and (b) the verified-question cache TTL, defaulting to the `llm-foundation` value unless a distinct one proves necessary. Neither blocks implementation of this change.
