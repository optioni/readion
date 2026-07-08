## Reviewed Artifacts

- proposal.md
- specs/web-session-view/spec.md
- design.md
- tasks.md
- design/Session.html, design/Summary.html (imported visual source)

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| CRITICAL | design.md | Missing the schema-required **Test Boundaries** table (the input the acceptance test setup depends on), plus **Goals / Non-Goals** and **Open Questions** sections | Added Test Boundaries (sessions/summary API HTTP-stubbed, streak signal real, clock faked; Postgres/Redis/LLM not involved), Goals/Non-Goals, and Open Questions | design.md → Test Boundaries, Goals / Non-Goals, Open Questions |
| WARNING | design.md | UI change had no imported visual source and no **Visual Design** section (schema requires importing owned views and mapping them) | Imported `design/Session.html` + `design/Summary.html` into the change; added Visual Design table (artboard → component) and a **Design ↔ contract reconciliation** subsection | design.md → Visual Design; new `design/*.html` |
| WARNING | design.md / specs | Summary design shows fields absent from `SessionSummaryResponse` (per-domain counts, weak-area before/after, miss count, next-focus rationale, question chosen/correct/time, "sessions in a row" streak) risking fabrication during implementation | Recorded each divergence and its resolution (render only contract-backed data; reuse `useActivityStats.currentStreakDays` as a day streak; omit the rest) — consistent with the spec's non-fabrication clause and the ADDED Streak requirement | design.md → Design ↔ contract reconciliation; spec MODIFIED "End-of-session summary" / ADDED Streak |
| WARNING | tasks.md | Acceptance task 0.1 said "seed/stub" — inconsistent with design Test Boundaries (HTTP-stub at the route boundary) and did not assert the end endpoint stays uncalled | Rewrote 0.1 to HTTP-stub `GET /sessions/:id` per Test Boundaries, pin the 49h-start / 20m-duration repro, and assert `POST /sessions/:id/end` is never called | tasks.md → §0.1 |
| WARNING | tasks.md | UI task groups did not point at the imported design assets (schema requires view-building tasks to reference `design/<view>.html`) | Referenced `design/Session.html` (§3, §5) and `design/Summary.html` + reconciliation (§7) in the group headings | tasks.md → §3, §5, §7 headings |
| SUGGESTION | tasks.md | The MODIFIED "Quiz cards…" requirement carries over the submit/confidence/colouring scenarios (unchanged behaviour) with no regression task | Added a regression task confirming existing quiz submission + option colouring still pass alongside the new "Q n of m" label | tasks.md → §5.3 |
| SUGGESTION | tasks.md | Streak task named an abstract "streak signal" rather than the concrete existing source | Tied §7.3 to `useActivityStats.currentStreakDays` per the design reconciliation | tasks.md → §7.3 |

## No Remaining Implementation-Blocking Gaps

All four artifacts now agree as one contract. Capability coverage is complete (`web-session-view` is the only modified capability and has its delta spec). Every spec scenario maps to acceptance-test or unit work in tasks.md: ended-session runner/frozen-timer (§0.1, §1, §2, incl. the "2910:42" repro in §2.2), human citation labels + domain label (§0.2, §3, §4), quiz "Q n of m" (§5), summary zero-state (§0.3, §6), page header + readiness strip + streak (§7). Test Boundaries name every collaborator the tests touch, and no task invents a boundary design.md does not name. The spec's non-fabrication clause and the Design ↔ contract reconciliation are consistent (streak is sourced, not fabricated; counts/absolutes/miss-count/rationale are dropped). No backend/API contract changes; `session-summary/spec.md` is untouched. Implementation may proceed.

## Deferred Non-Blocking Notes

- Ended-session presentation (hard redirect to summary vs in-place read-only completed state) is left open by both the spec and design.md → Open Questions; redirect is the recommended default and the acceptance test asserts the outcome (no active runner/free-running timer/controls), not the mechanism. Resolved at implementation.
- Final streak stat copy (day-streak wording vs the design's "sessions in a row") is deferred to implementation per design.md → Open Questions; the data source (`currentStreakDays`) is fixed.
