## 0. Acceptance Test — Outer Loop RED

- [ ] 0.1 Write a failing Playwright e2e (`apps/web/e2e`) that opens a **completed** session at `/sessions/:id`, HTTP-stubbing `GET /api/v1/sessions/:id?include=items` at the route boundary (per design.md → Test Boundaries) with `status: "completed"`, a `startedAt` ~49h before now, and an `endedAt` ~20 min after `startedAt`, and asserts: NO free-running/uncapped timer is shown (the header does not render an elapsed value that increases across two samples, and never a value like "2910:42"); NO "End session" and NO "Continue" control is present; instead the summary (or an explicit read-only completed state) is shown. Also assert `POST /sessions/:id/end` is never called.
- [ ] 0.2 Extend the e2e to assert the reading block renders a **human** citation label (no 8-4-4-4-12 UUID pattern in any citation chip) and shows the item's **domain** label beside the "Reading" pill.
- [ ] 0.3 Extend the e2e to open the summary of a session with **zero answered questions** and assert a "no questions answered this session" empty state is shown and no misleading "0% / +0% / ↑0%" accuracy/readiness/weak-area cards are rendered.
- [ ] 0.4 Confirm all new e2e assertions fail for the right reason (missing ended-branch / uncapped timer / UUID chip / no zero-state), not a harness/setup error.

## 1. Ended-session lifecycle branch (session runner)

- [ ] 1.1 RED: Component test for `sessions/[id]/index.vue` — given a loaded session with `status` `completed` (and `partial` / `abandoned`), it does NOT render the active runner (`QuizCard` / `ReadingBlock` with live controls) and does NOT render an "End session" control; it routes to the summary (or renders a read-only completed state).
- [ ] 1.2 GREEN: Add the ended-session branch keyed on `session.status`; redirect terminal-status sessions to `sessionSummaryPath(id)` (or render a read-only completed state) instead of the active runner.
- [ ] 1.3 REFACTOR: Factor an `isActive`/`isEnded` derivation from `session.status` for reuse by the header/timer.

## 2. Frozen elapsed time (`useElapsedTimer`)

- [ ] 2.1 RED: Unit-test `useElapsedTimer` — for an ended session (`endedAt` present) it returns a fixed `endedAt − startedAt` value that does NOT change across interval ticks, and it does not leave a running interval; for an active session (`endedAt` null) it still counts up from `startedAt`.
- [ ] 2.2 RED: Unit-test the "2910:42" repro — an ended session whose `startedAt` is ~49h before `now` but whose `endedAt` is 20 min after `startedAt` displays ~"20:34", never the `now − startedAt` runaway value.
- [ ] 2.3 GREEN: Have `useElapsedTimer` (or its caller) accept `endedAt`; when present, compute elapsed once as `endedAt − startedAt` and skip/clear the interval; only tick when `endedAt` is null.
- [ ] 2.4 REFACTOR: De-duplicate the elapsed computation shared with `summary.vue` `timeLabel`.

## 3. Human citation labels (`ReadingBlock` / `CitationChip`) — per `design/Session.html`

- [ ] 3.1 RED: Component test — a reading block whose `sourceChunkIds` contains a UUID renders a citation chip with a human label, and NO chip label matches the UUID pattern; `supportingSpans` human text still renders.
- [ ] 3.2 GREEN: Map `sourceChunkIds` to human source labels (with a generic "Source" fallback); stop concatenating raw ids into chip labels.
- [ ] 3.3 REFACTOR: Keep chip labelling in one place shared by reading blocks and agent explanation cards.

## 4. Reading-block domain label

- [ ] 4.1 RED: Component test — `sessions/[id]/index.vue` passes the item's domain to `<ReadingBlock>` so the domain label renders beside the "Reading" pill.
- [ ] 4.2 GREEN: Pass `:domain` from the current item to `ReadingBlock`.

## 5. Quiz "Q n of m" label — per `design/Session.html`

- [ ] 5.1 RED: Component test — the quiz card renders "Q 3 of 12" beside the "Question" pill for the 3rd of 12 items.
- [ ] 5.2 GREEN: Render the position label ("Q n of m") in `QuizCard` from the item index and total count.
- [ ] 5.3 Regression: confirm the existing quiz behaviour is unchanged — answer submitted with `{ answer, confidence, timeTakenMs }` and correct/incorrect option colouring still pass.

## 6. Summary zero-state

- [ ] 6.1 RED: Component test for `SessionSummaryBody` — when `questionsAnswered === 0`, an explicit "no questions answered this session" empty state renders and the accuracy / readiness-delta / weak-area / domains cards are suppressed (no "0% / +0% / ↑0%").
- [ ] 6.2 RED: Component test — when `questionsAnswered > 0`, the full data body renders as before (no regression).
- [ ] 6.3 GREEN: Add the zero-state branch gated on `questionsAnswered === 0`.

## 7. Summary structural fidelity (page header, readiness strip, streak) — per `design/Summary.html` + design.md Design ↔ contract reconciliation

- [ ] 7.1 RED: Component test — the summary renders the page header: a "Session complete" badge, a "Study Session · CODE" title, cert name · duration, and a completion timestamp.
- [ ] 7.2 RED: Component test — the summary renders a dedicated readiness-change strip showing `before% → after%` with the signed delta badge, sourced from `readiness.before/after/delta`; when readiness is uncalibrated (null) it shows the calibration message instead.
- [ ] 7.3 RED: Component test — the stat strip renders a Streak stat sourced from the existing streak signal (`useActivityStats.currentStreakDays`, per design.md reconciliation) when available, and OMITS it (never fabricates) when unavailable.
- [ ] 7.4 GREEN: Implement the page header, readiness-change strip, and streak stat cell.
- [ ] 7.5 REFACTOR: Ensure no fabricated fields (per-domain counts, weak-area absolute before/after, miss count) are introduced.

## 8. Acceptance Test — Outer Loop GREEN

- [ ] 8.1 Confirm the Playwright e2e from section 0 passes end-to-end (completed session: no free-running timer, no End/Continue controls, summary/read-only shown; human citation + domain label; summary zero-state).
- [ ] 8.2 Verify `apps/web` boots and both an active and an ended session render correctly in the running app.

## 9. Change Review — Subagent Verification

- [ ] 9.1 Dispatch a subagent to review the change against `proposal.md`, the spec scenarios, and `design.md` plus the diff and this task list (reviewer reports findings only, does not edit code).
- [ ] 9.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests.

## 10. Polish

- [ ] 10.1 Run linter and fix all errors (`yarn lint`).
- [ ] 10.2 Run formatter and apply fixes (`yarn format`).
- [ ] 10.3 Run the web type checker with zero errors.
- [ ] 10.4 Run coverage and confirm ≥80% lines/branches for the touched files.
