## Reviewed Artifacts

- proposal.md
- specs/spaced-repetition/spec.md
- specs/study-sessions/spec.md (MODIFIED delta)
- design.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | Task 9.2 smoke test did not include regenerating/committing the Orval client, although the proposal states the API changes require `yarn codegen`. | Folded `yarn codegen` + commit into the Outer-Loop-GREEN smoke task. | tasks.md § 9.2 |
| SUGGESTION | specs/study-sessions/spec.md | MODIFIED requirement risked losing detail if only the new clause were shown. | Copied the entire original requirement block (all four prior scenarios) and appended the two front-loading scenarios, per MODIFIED workflow. | specs/study-sessions/spec.md |

(The two rows above reflect adjustments already baked into the artifacts during authoring; no further artifact edits were required at review time.)

## No Remaining Implementation-Blocking Gaps

Confirmed. Verified as one contract:

- **Capability coverage** — proposal names `spaced-repetition` (new) and `study-sessions` (modified); both have spec files. The new capability's behavior is in `## ADDED Requirements`; the front-loading change is in `## MODIFIED Requirements` against the existing `study-sessions` spec name. No capability lives only in design/tasks.
- **Scenario coverage** — every spec scenario maps to a tasks.md RED task: entity/migration → §1, Leitner → §2, accrual → §3, due-queue → §4, suppress → §5, re-anchoring → §6, standalone review → §7, front-loading (MODIFIED) → §8. The representative end-to-end path (standalone review + all-caught-up empty state) is the outer-loop acceptance test (§0); remaining scenarios are covered by layer-level integration/unit tests, consistent with outside-in TDD.
- **Design completeness** — module boundaries (`ReviewModule` owns `ReviewItem`; reuses `SessionsModule`/`QuizModule`/`WeakAreasModule`), migration shape, accrual rule, config-driven Leitner intervals, lazy re-anchoring strategy, and the one-active-session invariant reuse are all resolved before coding.
- **Test boundaries** — design.md names every collaborator (Postgres/Redis real via Testcontainers; AI SDK mocked at its boundary; quiz/sessions/weak-areas as real modules; Leitner scheduler pure). No task invents a mock boundary design.md does not name.
- **Entity ownership** — only `ReviewItem` is owned (table + migration). `StudySession.kind: review` is exercised, not migrated, matching the roadmap entity-ownership table. No worker cron or new metric is claimed, matching the cross-cutting tables.
- **No contradictions** — endpoints, domain resolution (`ContentChunk.primaryDomain`), the `active`/`mastered`/`suppressed` state machine, the spaced-repetition front-loading dependency direction (sessions → review), and the deferral of diagnostic-miss seeding / "Drill my misses" are consistent across all four artifacts.

## Deferred Non-Blocking Notes

- The exact 5-minute-review question cap (5/6/7) and whether domain-level suppress synthesizes rows for not-yet-queued concepts are intentionally deferred — both are recorded in design.md § Open Questions and resolved as config-driven defaults during implementation (tasks §7.3, §5.3).
