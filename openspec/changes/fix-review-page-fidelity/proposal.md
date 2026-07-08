## Why

The 5-minute review page (`/user-certifications/:id/review`) works functionally — the due queue returns its items and the `ReviewQueueEntry` card renders — but it does not match its design (`QuickReview.html`). Two concrete gaps:

- **No review header.** The page uses the `minimal` layout and renders only the entry card; there is no `ReviewHeader` component in the app at all. The design puts a dedicated `ReviewHeader` on every review screen: a back-to-dashboard affordance, a cert-code chip + "Quick review" label, a progress bar, and a 5:00 review timer. Without it the review surface is a bare card with no context or timer.
- **Entry card missing secondary affordances.** The design's queue entry offers a secondary "Review all N" action beside the primary "Start review →", and an overdue note ("N items overdue by X days"). The app's `ReviewQueueEntry` has the due-count circle, "N items due for review", by-domain chips, and the primary CTA, but neither the secondary action nor the overdue note.

Separately, the review page carries a top-level "Rating style · Self-grade / Quiz" toggle that has no counterpart in the design and reads as a competing entry control; it should be reconciled (kept as the in-flow secondary mode selector, not a top-level entry toggle).

Note (see Impact): the originally-reported HIGH bug — `GET /user-certifications/:id/review` returning `items: []` while `meta.dueCount` is 3 — is **not present in current source** and is out of scope; this change is design-fidelity only.

## What Changes

- Add a dedicated `ReviewHeader` to the review page per `QuickReview.html`: back affordance, cert-code chip + "Quick review" label, progress bar, and a 5:00 review timer.
- Extend `ReviewQueueEntry` with the design's secondary "Review all N" action beside "Start review →" and the "N items overdue by X days" note when items are overdue.
- Reconcile the "Rating style" toggle with the design — retain it as the in-flow secondary mode selector rather than a top-level entry-competing control.

## Capabilities

### Modified Capabilities
- `spaced-repetition`: adds web design-fidelity expectations for the review page — a dedicated `ReviewHeader` (cert-code chip, progress bar, 5:00 timer) and the `ReviewQueueEntry`'s secondary "Review all N" action + overdue note per `QuickReview.html`. No change to the queue read model, Leitner schedule, accrual, self-grade, suppression, or re-anchoring contracts.

## Impact

- **`apps/web/app/pages/user-certifications/[id]/review.vue`** — mount a `ReviewHeader` on the review route.
- **`apps/web/app/components/`** — new `ReviewHeader.vue`; extend `ReviewQueueEntry.vue` with the secondary "Review all N" action and the overdue note.
- **Tests** — `apps/web/e2e/quick-review.e2e.ts` (+ `support/quick-review-seed`) extended to assert the `ReviewHeader` (cert-code chip, progress, timer) and the entry card's secondary action + overdue note render.
- **Not a bug fix.** The queue read model is already correct at HEAD: `ReviewService.getQueue` (`apps/api/src/review/review.service.ts:66-67`) derives `meta.dueCount` from `items.length`, and an existing acceptance test (`apps/api/src/review/review.acceptance.spec.ts:110-128`) asserts `dueCount === 3` **and** `data.length === 3` for the 3-due scenario. The spec's "Due count and list reflect active overdue items" scenario already captures the invariant. No API/DB change is in scope.
