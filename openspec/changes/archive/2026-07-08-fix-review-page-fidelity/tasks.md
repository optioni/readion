## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 RED: Extend the Playwright e2e (`apps/web/e2e/quick-review.e2e.ts` + `support/quick-review-seed`) so that, with a seeded due queue (`dueCount` N > 0 and matching `items`, some overdue), `/user-certifications/:id/review` renders the dedicated `ReviewHeader` (cert-code chip + "Quick review" label, progress bar, 5:00 timer) AND the `ReviewQueueEntry` shows both the primary "Start review →" and a secondary "Review all N" action plus the "N items overdue by X days" note. Fails today: no `ReviewHeader` exists and the entry card lacks the secondary action + overdue note.
- [x] 0.2 Confirm it fails for the right reason (missing header component / missing secondary action + overdue note), not a harness/seed error.

## 1. ReviewHeader component (`QuickReview.html` fidelity)

- [x] 1.1 RED: Component/e2e-test a new `ReviewHeader` — back-to-dashboard affordance, cert-code chip + "Quick review" label, a progress bar bound to `current/total`, and a 5:00 review timer.
- [x] 1.2 GREEN: Implement `apps/web/app/components/ReviewHeader.vue` per the design and mount it on `/user-certifications/:id/review`.
- [x] 1.3 REFACTOR: Ensure the header uses readion design tokens (cert-code chip, progress accent, timer) and composes with the `minimal` layout without a second stacked nav bar.

## 2. Entry card secondary action + overdue note (`ReviewQueueEntry.vue`)

- [x] 2.1 RED: Component/e2e-test that with due items `ReviewQueueEntry` renders a secondary "Review all N" action beside "Start review →" and, when items are overdue, the "N items overdue by X days" note.
- [x] 2.2 GREEN: Extend `ReviewQueueEntry.vue` with the secondary action and the overdue note derived from the due items' `dueAt`.
- [x] 2.3 RED (regression guard): Assert the zero-due path still renders the `review-all-caught-up` empty state — not the entry card, secondary action, or overdue note — extending the existing `mockReviewAllCaughtUp` coverage in `quick-review.e2e.ts`.
- [x] 2.4 REFACTOR: Keep the existing due-count circle, "N items due for review", by-domain chips, and the `all-caught-up` empty state unchanged; de-duplicate any date math into a small helper/composable.

## 3. Reconcile the "Rating style" toggle

- [x] 3.1 RED: e2e/component-test that the review entry surface presents a single primary "Start review →" (self-grade) path, with the Self-grade/Quiz choice as a secondary in-flow mode selector — not a top-level entry-competing toggle.
- [x] 3.2 GREEN: Relocate/relabel the `review-mode-toggle` per the design (in-flow secondary selector), preserving the existing self-grade and quiz run loops.
- [x] 3.3 REFACTOR: Keep the `review-mode-*` data-testids stable for the existing e2e coverage.

## 4. Acceptance Test — Outer Loop GREEN

- [x] 4.1 Confirm the extended e2e (0.1) passes end-to-end.
- [x] 4.2 REFACTOR: Clean up the queue seed fixtures and header/entry assertions.

## 5. Change Review — Subagent Verification

- [x] 5.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, `QuickReview.html`, and the diff plus this task list (reviewer reports findings only, does not edit code).
- [x] 5.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests.

## 6. Polish

- [x] 6.1 Run linter and fix all errors (`yarn lint`).
- [x] 6.2 Run formatter and apply fixes (`yarn format`).
- [x] 6.3 Run type checker with zero errors (`yarn workspace apps/web typecheck`).
- [x] 6.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn test:coverage`).
