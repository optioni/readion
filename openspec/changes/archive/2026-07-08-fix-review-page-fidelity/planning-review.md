## Reviewed Artifacts

- proposal.md
- specs/spaced-repetition/spec.md
- design.md
- tasks.md

Reviewed as one contract against the gap checklist (capability coverage, scenario coverage, design completeness, test boundaries, task alignment, contradictions/stale assumptions).

## Gaps Found and Fixed

| Severity | Source artifact | Gap | Fix made | Updated artifact / section |
|---|---|---|---|---|
| WARNING | tasks.md | Spec scenario "Zero due count still shows the all-caught-up state" (spec Requirement 2) had no matching acceptance-test task — the other scenarios did, but the zero-due preservation path was only referenced in a REFACTOR "keep unchanged" line, not verified. | Added a regression-guard task asserting the zero-due path still renders the `review-all-caught-up` empty state (not the entry card/secondary action/overdue note), extending the existing `mockReviewAllCaughtUp` e2e coverage; renumbered the section-2 REFACTOR to 2.4. | tasks.md § 2 (new 2.3, refactor → 2.4) |
| SUGGESTION | design.md | The Visual Design mapping table listed the queue-entry screens but omitted the zero-due `review-all-caught-up` empty state, which the spec preserves and which has no `QuickReview.html` artboard — leaving an implicit UI state unmapped. | Added a table row noting the `review-all-caught-up` state is app-only (no design counterpart) and preserved unchanged, rendering instead of the entry card when `dueCount === 0`. | design.md § Visual Design |

## No Remaining Implementation-Blocking Gaps

All checklist dimensions pass:

- **Capability coverage** — proposal.md names `spaced-repetition` (Modified Capabilities); a matching `specs/spaced-repetition/spec.md` exists; its requirements sit under `## ADDED Requirements` (adding requirements to an existing capability spec, consistent with "Modified Capability"); no capability appears only in tasks.md or design.md.
- **Scenario coverage** — all three spec scenarios (header renders; secondary action + overdue note render; zero-due all-caught-up) are concrete WHEN/THEN and now each have corresponding acceptance-test work in tasks.md (§0.1, §1.1, §2.1, §2.3).
- **Design completeness** — design.md resolves the implementation-critical choices: new `ReviewHeader.vue` component boundary, client-side overdue-day derivation (no API change), the "Review all N" wiring default, the presentational-timer decision, and the UI states (due, overdue, zero-due). No migration, generated-client, or async-job concerns apply (UI-only).
- **Test boundaries** — design.md Test Boundaries names the mocked review-queue API (Playwright route-fulfil + `quick-review-seed`), Postgres/NestJS not run, and component prop fixtures; no task invents an unnamed boundary.
- **Task alignment** — tasks.md is outside-in (acceptance RED → components → GREEN → toggle reconciliation → acceptance GREEN → change review → polish) and covers every requirement, scenario, the visual-design/toggle reconciliation, and verification/polish steps.
- **Contradictions & stale assumptions** — the four artifacts agree on scope. Critically, all of them scope this as **fidelity-only**: proposal.md Impact ("Not a bug fix… No API/DB change is in scope", citing `review.service.ts:66-67` + `review.acceptance.spec.ts:110-128`), design.md Context + Non-Goals (queue read model / API contract out of scope), the spec delta (ADDED-only; does **not** re-modify "Due-queue read model per enrollment"), and tasks.md (no task touches `ReviewService`, the controller, DTOs, entities, or migrations; the overdue note is derived client-side from `dueAt`). The correct queue contract is explicitly out of scope and is not accidentally re-modified.

## Deferred Non-Blocking Notes

- The exact target of the secondary "Review all N" action, the timer semantics (presentational vs. eventual soft-nudge), and the overdue-note threshold/copy are recorded as Open Questions in design.md, each with a stated default the implementer can proceed on. None block implementation.
