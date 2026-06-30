## Why

The review entry screen diverges from the design (`openspec/design/QuickReview.html`, observed 2026-06-30) in two ways: the by-domain breakdown is a **plain list** where the design uses **chips**, and the entry surfaces a **separate "Self-grade flashcards" button** alongside "Start review", whereas the design treats self-grade *as* the review flow (the Again/Hard/Good/Easy rating appears in the revealed-card state, reached from a single Start). The Phase-11 self-grade card UI itself already matches the design (color-coded Again/Hard/Good/Easy) — this change is about the **entry affordance** and chips.

## What Changes

- Render the by-domain breakdown as **chips** (domain + count) per `QuickReview.html`.
- Unify the review entry: a single **Start review** entry that leads into the flow, with self-grade as the in-flow rating (remove the separate entry button, or demote it to a mode toggle if both quiz and self-grade loops must remain selectable — match the design's single-entry model).

## Capabilities

### Modified Capabilities
- `web-progress`: the review entry uses domain chips and a unified single-entry start aligned with the design (self-grade as the in-flow rating).

## Impact

- **Code**: `apps/web/app/` review entry component(s) + the review run loop entry; vitest tests; Playwright e2e (`apps/web/e2e/quick-review.e2e.ts`). The self-grade card UI is unchanged. No API change, no codegen.
- **No new entity/migration.**
- **Dependencies**: archived `web-progress`, `review-self-grade`.
