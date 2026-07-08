## Reviewed Artifacts

- proposal.md
- specs/web-dashboard/spec.md
- specs/web-cert-detail/spec.md
- specs/web-progress/spec.md
- design.md
- tasks.md

Reviewed as one contract against the outside-in-tdd gap checklist: capability coverage, scenario coverage, design completeness, test boundaries, task alignment, and contradictions/stale assumptions across the three learner surfaces. Cross-checked derived-value scenarios against the real shared contracts (`packages/shared/src/session-summary` — `nextFocus: { domain: string } | null`, `weakAreaDeltas`, `accuracy`, `readiness.after`; `SessionResponse.durationMinutes`, `startedAt`, `focusArea`) to confirm every rendered figure is derivable without a backend change.

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | specs/web-cert-detail | The suggested-next-focus requirement mandated the design's full rationale "Lowest domain score (45%). Last studied 2 days ago.", but no `lastStudied` field exists (`nextFocus` is only `{ domain: string }`), so the "last studied" clause is not directly derivable — an un-satisfiable acceptance criterion. | Made the score-based reason the required, always-derivable part of the rationale; specified the "Last studied N days ago" clause as a best-effort client-side derivation (newest session whose `focusArea` includes the domain) that MUST be omitted, never fabricated, when not derivable. Reworded the fallback scenario to assert the score-only rationale and added a scenario asserting the last-studied clause is omitted when not derivable. | specs/web-cert-detail — "Overview tab shows a suggested next focus" requirement + its scenarios |
| WARNING | design.md | Test Boundaries / reconciliation did not record how the "Last studied" rationale reconciles with the contract, leaving the derivation decision implicit. | Added a Design↔contract reconciliation row documenting the score-required / last-studied-best-effort-or-omit resolution. | design.md — "Design ↔ contract reconciliation" table |
| WARNING | tasks.md | Task 5.3 restated the un-derivable "Last studied 2 days ago" copy as a hard component-test expectation, mirroring the same gap at the task layer. | Rewrote 5.3 to test the required score-based rationale and the derive-or-omit behaviour of the last-studied clause, and to name `weakAreaDeltas` as the per-domain delta source. | tasks.md — §5.3 |
| SUGGESTION | tasks.md | The shared `PageHeader` and `DomainBadge` components (neither exists today) were only implied by the dashboard GREEN/REFACTOR tasks, with no explicit "create these first" step. | Made 4.6 GREEN explicitly create the two net-new shared components before the dashboard consumes them, and clarified 4.7 REFACTOR reuses them at their call sites. | tasks.md — §4.6, §4.7 |
| SUGGESTION | proposal.md | Impact listed PageHeader/DomainBadge usage but did not flag them as net-new files, understating the change surface. | Added an Impact bullet naming both as net-new shared components that do not exist today. | proposal.md — Impact |

## No Remaining Implementation-Blocking Gaps

All implementation-blocking planning gaps are resolved. Verified after the repairs:

- **Capability coverage** — proposal names three Modified capabilities (`web-dashboard`, `web-cert-detail`, `web-progress`); each has a matching delta spec using MODIFIED (and, for the dashboard diagnostic banner, ADDED) sections referencing the exact existing `### Requirement:` headers. No capability lives only in tasks.md or design.md.
- **Scenario coverage** — every new/changed scenario is concrete and maps to task work: pluralization (§0.2–0.3, §1–2, §3), QUESTIONS-0 accuracy suppression (§0.4, §2.3–2.4), and the per-surface fidelity scenarios (dashboard §4, cert-detail §5, progress §6). Carried-over scenarios describe already-implemented behaviour and need no new task. Every rendered value is confirmed derivable from data already loaded — no un-satisfiable acceptance criteria remain after the suggested-focus fix.
- **Test boundaries** — design.md Test Boundaries names every collaborator (readiness/sessions/summary/weak-areas APIs seeded via the running API for e2e; pure inputs for unit tests; real auth; unchanged backend computation). No task invents a mock boundary design.md does not name.
- **Task alignment** — outside-in order (outer-loop RED → per-surface RED/GREEN/REFACTOR → outer-loop GREEN → review → polish); the shared-`paceFormatter` consolidation (§1, §1.3 asserts both trajectory and streak consume one helper) and the QUESTIONS-0 suppression in `formatCertStatRow` (§2.3–2.4) are both present. No API change ⇒ no codegen task required.
- **Contradictions / stale assumptions** — the cert-detail stat-set change (Readiness / Sessions / Questions / Avg accuracy) is consistent across proposal, spec, design, and tasks, with the removed "Due reviews" stat surfaced on the dashboard review-due row instead; the dashboard review quick-start endpoints are carried unchanged from the existing spec. No disagreement on scope, endpoints, domain names, UI copy, or verification expectations.

`openspec validate fix-learner-surfaces-fidelity --strict` passes.

## Deferred Non-Blocking Notes

- Whether the shared `PageHeader` is additionally adopted by the cert-detail and progress pages (beyond the dashboard header and the cert-detail cert-header bar) is left as a design.md Open Question; it is a non-blocking scope choice for implementation, not a correctness gap.
