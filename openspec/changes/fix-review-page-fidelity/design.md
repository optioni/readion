## Context

The 5-minute review page (`/user-certifications/:id/review`, `apps/web/app/pages/user-certifications/[id]/review.vue`) is functionally correct but visually diverges from its design (`openspec/design/QuickReview.html`). Today it uses the `minimal` layout and renders only the `ReviewQueueEntry` card; there is no `ReviewHeader` component anywhere in `apps/web` (grep-confirmed). The design puts a dedicated `ReviewHeader` on every review screen (back affordance, cert-code chip + "Quick review", progress bar, 5:00 timer) and gives the queue entry a secondary "Review all N" action and an overdue note ("N items overdue by X days"). The page also carries a top-level "Rating style · Self-grade / Quiz" toggle with no design counterpart.

**The originally-reported HIGH queue bug is NOT present at HEAD and is out of scope.** `ReviewService.getQueue` (`apps/api/src/review/review.service.ts:66-67`) derives `meta.dueCount` from `items.length` (`const items = dueRows.map(...); return { items, meta: { dueCount: items.length, total } }`), so `dueCount:3` with `items:[]` cannot occur. An existing acceptance test (`apps/api/src/review/review.acceptance.spec.ts:110-128`) already seeds 3 due + 1 future item and asserts both `meta.dueCount === 3` and `data.length === 3`, and the spec's existing "Due count and list reflect active overdue items" scenario already locks the invariant. The stale-server curl repro was against a ~3-day-old server. This change is therefore design-fidelity only.

## Goals / Non-Goals

**Goals:**
- Add a dedicated `ReviewHeader` (back affordance, cert-code chip + "Quick review" label, progress bar, 5:00 timer) to the review page per `QuickReview.html`.
- Extend `ReviewQueueEntry` with the design's secondary "Review all N" action and the "N items overdue by X days" note.
- Reconcile the top-level "Rating style" toggle with the design (retain as an in-flow secondary mode selector, not a top-level entry-competing control).

**Non-Goals:**
- Any change to the due-queue read model / API contract — it is correct at HEAD (see Context). No `ReviewService`, controller, DTO, entity, or migration change.
- Any change to the Leitner schedule, accrual, self-grade submission, suppression, or re-anchoring behavior.
- The card front/back flashcard screens and the completion screen (existing self-grade + quiz run loops stay as-is beyond the toggle relocation).

## Visual Design

Visual source of truth: the local design mockup at `openspec/design/QuickReview.html` (the `*.html` mockup is authoritative over screenshots).

| Artboard / screen | Maps to |
|---|---|
| `ReviewHeader` (used on every artboard) | new `apps/web/app/components/ReviewHeader.vue`, mounted on `review.vue` |
| "Queue entry — items due by domain" (`QueueEntry`) | `apps/web/app/components/ReviewQueueEntry.vue` + `review.vue` `scene === 'queue'` |
| Queue entry due-count + "N items due for review" + by-domain chips | existing `ReviewQueueEntry` (`review-due-count`, `review-domain-breakdown`, `review-domain-chip`) — retained |
| Queue entry "Start review →" primary + "Review all N" secondary | `ReviewQueueEntry` (`start-review-button` retained; secondary action added) |
| Queue entry "N items overdue by X days" note | `ReviewQueueEntry` (new overdue note derived from due items' `dueAt`) |
| (no design artboard) — zero-due empty state | `ReviewQueueEntry` `review-all-caught-up` — app-only state with no `QuickReview.html` counterpart; preserved unchanged (renders instead of the entry card when `dueCount === 0`) |

**Layout to implement:** `ReviewHeader.vue` — a single review-scope header (cert-code chip, progress bar bound to `current/total`, 5:00 timer) built once and reused across the review scenes, composed above the existing `minimal` layout content (no second stacked app nav bar).

### Design ↔ contract reconciliation

| Design element | Conflict with contract | Resolution |
|---|---|---|
| No "Rating style · Self-grade / Quiz" toggle in the design | App exposes a top-level toggle as a competing entry control | Keep the toggle as an in-flow secondary mode selector (retain `review-mode-*` data-testids), not a top-level entry CTA |
| Design shows a live 5:00 countdown timer | No timer state exists on the page today; the review session cap is behavioral, not a hard client deadline | Render the timer as the design's review-window indicator; treat it as presentational (no hard auto-submit added in this change) |

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Review queue API (`GET /user-certifications/:id/review`) | HTTP mock via Playwright `route` fulfil, seeded with due items (some overdue) — see `apps/web/e2e/support/quick-review-seed` | n/a (component tests render with prop fixtures) |
| Postgres / NestJS API | not run — the e2e drives `apps/web` against the fully mocked API (existing `quick-review.e2e.ts` boundary) | n/a |
| `ReviewHeader` / `ReviewQueueEntry` rendering | asserted through the Playwright e2e against the real `apps/web` | component render with prop fixtures (due items, overdue days) |
| Clock (for overdue "X days") | seed fixture provides `dueAt` offsets so the note is deterministic | inject/fix the reference date |

## Decisions

- **New `ReviewHeader.vue` component (not inline markup).** The design reuses the header across four review screens; a shared component keeps the cert-code chip, progress bar, and timer consistent and testable, and avoids stacking a second nav bar under the `minimal` layout. Alternative — inline header markup in `review.vue` — rejected as non-reusable and harder to assert.
- **Overdue note derived client-side from the queue items' `dueAt`.** The queue already returns each item's `dueAt`; the "N items overdue by X days" note is computed in the web layer, requiring no API change. Alternative — add an `overdue` aggregate to the API response — rejected because it changes a correct contract for a purely presentational value.
- **"Review all N" as a secondary action beside the primary "Start review →".** Matches the design's two-CTA row; wiring it to the existing start/run-loop entry (reviewing the full set) keeps behavior within the current `startReview` flow.
- **Retain the "Rating style" toggle as an in-flow secondary selector.** Rather than delete a working capability with no design slot, relocate/relabel it so the single primary "Start review" launches the self-grade flow (the design's single-entry model) while the quiz mode stays reachable in-flow. Preserves existing e2e data-testids.

## Risks / Trade-offs

- **Timer is presentational, which may imply a hard deadline that does not exist** → render it as the design's review-window indicator without adding auto-submit; document in the reconciliation table so implementers do not wire a client-side kill switch.
- **Overdue-day math is timezone/rounding sensitive** → compute from `dueAt` against a single reference "now", floor to whole days, and cover with a deterministic seed fixture so the e2e assertion is stable.
- **Relocating the "Rating style" toggle could break existing quick-review e2e coverage** → keep the `review-mode-toggle` / `review-mode-self-grade` / `review-mode-quiz` data-testids stable so current tests continue to target them.
- **Scope creep toward the flashcard/completion screens** → this change is bounded to the header, the entry card, and the toggle; the run-loop and completion screens are explicitly non-goals.

## Open Questions

- Timer semantics: is the 5:00 a purely presentational review-window indicator, or should it eventually drive a soft nudge / auto-end? Defaulting to presentational for this change.
- "Review all N" target: does it start the same review session over the full due set, or a distinct "review everything" path? Defaulting to the existing `startReview` over the full due set unless product specifies otherwise.
- Overdue-note threshold and copy: does the note appear for any item ≥ 1 day overdue, and does it count items or report the oldest? Defaulting to counting items overdue by ≥ 1 day with the oldest overdue-by-days value, matching the design's "N items overdue by X days" phrasing.
