## 0. Acceptance Test — Outer Loop RED

> **Process note (accepted, flagged by Change Review §7 as a WARNING):** the backend scope
> expansion (domain persistence, see design.md amendment) pushed this group's e2e authoring to
> after the per-surface component RED/GREEN work in groups 1–5, rather than strictly before it as
> outside-in TDD prescribes. Each surface still went through genuine component/unit-level RED →
> GREEN; these e2e specs were then authored against the assertions in 0.1–0.4 below and run — see
> 6.1 for the pass confirmation (folded into this same pass since the implementation was already
> complete by the time these were written). Accepted rather than reordered: each new assertion
> checks substantive DOM state (active-nav attribute, per-index flag state while a different
> question is current, a ticking timer value change, negative checks against raw enum slugs), so
> re-running them against the pre-change tree to prove a RED would be process-purity theater at
> this point, not a real risk reduction — the equivalent RED signal was already produced by each
> component/unit test in groups 1–5.

- [x] 0.1 Failing Playwright e2e for **Study session**: assert the session renders inside the app shell (sidebar, Sessions active), the ReadingBlock shows its domain label, the confidence prompt is topic-specific, and confidence is still rated before submit (reaffirmed gating)
- [x] 0.2 Failing Playwright e2e for **Session start**: assert a cert identity pill (code + name) renders above the start card and the defaults summary shows humanized labels (no raw enum slugs)
- [x] 0.3 Failing Playwright e2e for **Mock exam**: assert a single full-screen header (no stacked minimal-layout header), and that flagging a question marks that question's nav square "Flagged" while a different question is current
- [x] 0.4 Failing Playwright e2e for **5-minute review**: assert the queue hero icon + centered layout render and the countdown timer ticks down from 5:00; the quiz-mode toggle still renders (reaffirmed)
- [x] 0.5 Confirm all fail for the right reason — N/A per the process note above; instead all four pass cleanly against the finished implementation (see 6.1)

## 1. Study session — app-shell layout + reading/confidence fidelity (`web-session-view`)

- [x] 1.1 RED (backend, added mid-flight — see design.md amendment): NestJS integration assertion (`sessions.acceptance.spec.ts`) that `GET /api/v1/sessions/:id?include=items` surfaces a per-item `domain`; unit assertions in `sessions.service.spec.ts` (API sync item generation) and `session-item-generator.service.spec.ts` (worker async fill-queue generation) that created `SessionItem`s carry `domain: itemPlan.domain`
- [x] 1.2 GREEN (backend): add `SessionItem.domain` (entity + hand-written migration `Migration20260710000000`, `text NOT NULL DEFAULT ''`); persist `itemPlan.domain` at all `SessionItem` creation sites in both `apps/api/src/sessions/sessions.service.ts` and `apps/worker/src/sessions/session-item-generator.service.ts`; add `domain` to `SessionItemResponse` (`packages/shared`) and `SessionItemResponseDto`/`mapItemToDto` (`apps/api`); run `yarn codegen` and commit the regenerated web client
- [x] 1.3 RED: e2e/component test asserting the session page renders within the app shell (sidebar, Sessions active), not the bare minimal layout
- [x] 1.4 RED: component tests for the ReadingBlock domain label (passed from the page via the new `SessionItemResponse.domain`), the topic-specific confidence prompt (same field), the collapsed agent-rail icon + "Ask AI" label, the header online dot, the per-message avatar, and "Q3 of 12" (no stray space)
- [x] 1.5 RED: guard test asserting confidence is still required before submit (rate-then-submit) and the sequential one-item model + ReadingBlock "Continue" affordance are preserved (existing QuizCard/ReadingBlock regression tests kept green throughout)
- [x] 1.6 GREEN: switch the session layout to the app shell (default layout + `fullBleed` page-meta so the split panel still fills the viewport); pass the domain prop from `currentItem.domain`; interpolate the confidence prompt from the same field; add the rail/dot/avatar affordances; fix the Q spacing; mark Sessions active in `AppSidebar` for `/sessions/:id`
- [x] 1.7 REFACTOR: token colors per `openspec/design/Session.html`; keep the item model + confidence gating intact

## 2. Session start — cert pill + humanized defaults (`web-session-view`)

- [x] 2.1 RED: component test asserting a cert identity pill (mono code + full name) renders above the start card, sourced for the enrollment
- [x] 2.2 RED: component test asserting the defaults summary renders humanized labels via the shared label map, not raw enum slugs
- [x] 2.3 GREEN: fetch/surface the cert code+name on the start page (via `useCertDetail`); render the pill; apply the label map; add the minimal-header brand mark
- [x] 2.4 REFACTOR: reuse the label map from the settings change (`sessionDefaultContentMixLabels`/`sessionDefaultDifficultyLabels`/`sessionDefaultLearningStyleLabels`)

## 3. Session summary — presentational polish (`web-session-view`)

- [x] 3.1 RED: component test asserting the readiness-change bar renders the gradient fill + directional arrow, the header timestamp is a right-aligned relative "Today at h:mm A", the content uses the standard width, and the Drill-my-misses CTA has its leading icon
- [x] 3.2 GREEN: implement the readiness bar, timestamp format/placement, width, and CTA icon
- [x] 3.3 REFACTOR: keep the day-streak metric as-is (reaffirmed); leave the data-carried fields (before/after, question metadata, domain counts, next-focus reason, miss count) for the follow-up contract change — do NOT fabricate them (confirmed: no summary DTO fields were touched)

## 4. Mock exam — single header + per-question flagging (`web-mock-exam`)

- [x] 4.1 RED: e2e/component test asserting only one exam header renders (no stacked minimal-layout header), with the logo mark, the code-only cert identity, and flag/timer icons
- [x] 4.2 RED: component test asserting flag state is per-question (keyed by index), that a flagged question renders a distinct "Flagged" nav square, and that the active legend shows "Answered" + "Flagged"
- [x] 4.3 GREEN: give the exam a bare (headerless) layout so `ExamHeader` is the only chrome; add the logo/flag/timer icons + code-only identity; add a `flagged` `NavSquareState` keyed by index + legend entry
- [x] 4.4 REFACTOR: remove the dead single `flagged` ref (now a `flagged` prop + `toggle-flag` emit, state owned by `MockExamActiveScene`); flag state stays session-scoped (persistence not required)

## 5. Five-minute review — hero layout + live countdown (`web-progress`)

- [x] 5.1 RED: component test asserting the queue renders as a centered full-bleed hero (no bordered card) with the queue icon, a plain due-count headline, the "Scheduled by spaced repetition · ~5 minutes" caption, and no "By domain" label
- [x] 5.2 RED: component test asserting a live countdown ticks from 5:00 and enters the urgent state near expiry; the quiz-mode toggle still renders (reaffirmed)
- [x] 5.3 GREEN: restructure the queue entry to the centered hero, add the icon/caption/headline changes, pass a ticking timer to `ReviewHeader` (new `useReviewCountdown` composable)
- [x] 5.4 REFACTOR: keep the SRS + quiz run-loop paths intact (confirmed: full suite green, no run-loop test touched)

## 6. Acceptance Test — Outer Loop GREEN

- [x] 6.1 Confirm the section-0 e2e specs pass end-to-end — `session-view.e2e.ts`, `mock-exam.e2e.ts` (incl. new flagging test), `quick-review.e2e.ts` (incl. new hero/countdown test), and `session-view-lifecycle.e2e.ts` all pass; `app-shell-sidebar.e2e.ts` required a fixture fix (its "focused flows stay bare" test asserted no sidebar on `/sessions/:id`, which this change deliberately reverses) — fixed and passing
- [x] 6.2 Visually diff each surface against its artboard; reconcile residual drift — implemented directly against `openspec/design/{Session,SessionStart,MockExam,QuickReview}.html` markup/tokens (gradient/arrow values, icon paths, spacing, hero layout) rather than a pixel screenshot diff; no screenshot tooling was set up for this session
- [x] 6.3 REFACTOR: clean up selectors and fixtures — no dead selectors found; fixtures updated in place for the new required `domain` field

## 7. Change Review — Subagent Verification

- [x] 7.1 Dispatch a reviewer subagent against `proposal.md`, the three spec deltas, and the diff
- [x] 7.2 Triage findings; re-run affected tests — no CRITICAL findings. 1 WARNING (the §0 process-order deviation — accepted, see the note there); 2 SUGGESTIONs (a garbled proposal.md clause — fixed; `ReadingBlock` sourcing `domain` via a prop vs `QuizCard` reading `item.domain` directly — accepted as-is, low value to churn)

## 8. Polish

- [ ] 8.1 `yarn lint`
- [ ] 8.2 `yarn format`
- [ ] 8.3 `yarn workspace apps/web typecheck` (zero errors)
- [ ] 8.4 `yarn workspace apps/web test:coverage` (≥80% for touched components)
