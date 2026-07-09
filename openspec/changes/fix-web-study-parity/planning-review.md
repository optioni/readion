## Reviewed Artifacts

- proposal.md
- design.md
- specs/web-session-view/spec.md
- specs/web-mock-exam/spec.md
- specs/web-progress/spec.md
- tasks.md

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| — | — | None. The behavioral reaffirmations and the descope are each guarded: item model + confidence-before-submit (§1.3), quiz-mode toggle (§5.2), and "do NOT fabricate the data-carried summary fields" (§3.3). | — | — |

## No Remaining Implementation-Blocking Gaps

Confirmed. `openspec validate fix-web-study-parity --strict` passes.

- **Capability coverage** — three Modified Capabilities (`web-session-view`, `web-mock-exam`, `web-progress`), each with a delta; every MODIFIED header matches an existing requirement title.
- **Scenario coverage** — app-shell session + reading/confidence fidelity (§1), cert pill + humanized defaults (§2), summary presentational polish (§3), single exam header + per-question flagging (§4), review hero + countdown + reaffirmed toggle (§5); re-verified at §6.1.
- **Design completeness** — reconciliation table separates the presentational fixes, the two layout corrections (session app-shell, mock single-header), the client-side per-question flag add, and the descoped session-summary data cluster; the descope is explicit and guarded (§3.3).
- **Test boundaries** — client-only in this change; the summary data-carried fields are not tested here because they are descoped, not stubbed.
- **Task alignment** — outside-in across §0–8, with the item-model/confidence/quiz-toggle guards.
- **Contradictions / stale assumptions** — none; the sequential item model, confidence-before-submit, day-streak metric, and quiz-mode toggle are consistent across proposal.md, design.md, and the deltas.

## Deferred Non-Blocking Notes

- **`web-progress` is also modified by `fix-web-learner-surfaces-parity`** — a disjoint requirement ("Five-minute review — queue entry" here vs the readiness/activity/mastered/trajectory/history requirements there). No overlap, no conflict; coordinate the two deltas at sync/archive.
- **Session-summary data-carried fields** (before/after weak areas, per-question metadata, domain correct/total, next-focus reason, miss-count preview) are descoped to `enrich-session-summary-contract` (`packages/shared` DTOs + API + worker); the presentational summary follow-ups depend on it.
- **The paired reading+quiz interaction** and a **"sessions in a row" streak** are separate product decisions, not planning gaps.
- **Carried-over unchanged summary scenarios** (drill-my-misses, zero-state, readiness strip) retain existing coverage and are not re-tasked.
