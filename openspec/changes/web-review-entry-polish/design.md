# Design — web-review-entry-polish

## Context

The five-minute review queue-entry screen diverges from `openspec/design/QuickReview.html` (observed 2026-06-30) in two ways:

1. The by-domain breakdown is a plain list of label/count rows, whereas the artboard renders it as **chips** (pill: domain label + accent-coloured count).
2. The entry surfaces **two** CTAs — a primary "Start review" and a secondary "Self-grade flashcards" — whereas the artboard has a **single** primary "Start review" entry. In the artboard the Again/Hard/Good/Easy self-grade rating is not an entry choice; it is the rating revealed on the card once the user is inside the flow (`CardBackScreen` → `SRSButton` quartet).

The Phase-11 self-grade card UI itself (color-coded Again/Hard/Good/Easy on the revealed card) already matches the design and is out of scope. This change is entry-affordance + chips only. No API change, no codegen.

## Current code (file paths)

- `apps/web/app/components/ReviewQueueEntry.vue` — the entry component. Renders:
  - `data-testid="review-domain-breakdown"`: a `v-for` of `flex justify-between` rows (label + count) — the plain list to convert to chips.
  - `data-testid="start-review-button"` → `emit('start')` (quiz + confidence path).
  - `data-testid="start-self-grade-button"` ("Self-grade flashcards") → `emit('start-self-grade')` — the second entry button to remove.
  - `emits: { start: []; 'start-self-grade': [] }` — `start-self-grade` becomes dead and is removed.
- `apps/web/app/composables/useDueDomainBreakdown.ts` — already produces the `{ domain, count }[]` (sorted by count desc, then name) that the chips need. **This is the data source for the chips; it is unchanged.** Confirms the read model already carries per-domain counts, so there is NO backend blocker.
- `apps/web/app/pages/user-certifications/[id]/review.vue` — the run-loop host. Holds `scene` (`'queue' | 'loop' | 'completion' | 'self-grade' | 'self-grade-completion'`). It wires both `@start="handleStart"` (quiz loop via `startReview` → `QuizCard`) and `@start-self-grade="handleStartSelfGrade"` (self-grade scene with the revealed Again/Hard/Good/Easy buttons, `data-testid="grade-*"`). Removing the second entry button means the `@start-self-grade` binding and `handleStartSelfGrade` trigger no longer originate from the entry screen.
- `apps/web/tests/components/ReviewQueueEntry.spec.ts` — existing component tests (breakdown text, start button, emit). Updated for chips + removed self-grade button.
- `apps/web/e2e/quick-review.e2e.ts` — outer-loop e2e.

## Where the self-grade rating lives in the revealed-card flow

In `review.vue`, the self-grade Again/Hard/Good/Easy buttons live in the `scene === 'self-grade'` block (`data-testid="self-grade-card"`): a `Reveal` button flips `selfGradeRevealed`, and the revealed state shows the four `grade-*` buttons calling `handleGrade(grade)` → `gradeReviewItem`. This already matches the artboard's `CardBackScreen` rating row. The self-grade rating is therefore an **in-flow revealed-card** affordance, exactly the design's model — it never needed to be a competing entry button.

## Decisions

### Chips for the breakdown

Render `useDueDomainBreakdown(items)` as a flex-wrapped row of pills inside `data-testid="review-domain-breakdown"`. There is **no shared generic chip component** in `apps/web/app/components` (`CitationChip.vue` and `agent/AgentChip.vue` are domain-specific to citations/agent UI and not reusable here). Matching the artboard `DomainTag`/breakdown pill (`rounded-full`, `bg-readion-background-surface`, `border-readion-border-strong`, label in `text-readion-text-secondary` + count in an accent colour) with inline Tailwind classes is the lightest faithful approach and stays consistent with how the component already styles its inline elements. Keep `data-testid="review-domain-breakdown"` on the container; each chip carries the existing label + count text so the existing breakdown assertions still pass.

### Single-entry unification (quiz-vs-self-grade selectability)

The artboard has one primary entry: "Start review". The Again/Hard/Good/Easy quartet is the in-flow revealed-card rating, owned by the "Five-minute review run loop" requirement — not an entry choice. Accordingly:

- Remove the `start-self-grade-button` and the `'start-self-grade'` emit from `ReviewQueueEntry.vue`; keep the single `start-review-button`.
- **Both review loops remain defined and reachable** — the delta does NOT delete either the "question and confidence loop" requirement or the "run loop" (self-grade) requirement; it only removes the *parallel entry button*. The single-entry model preserves selectability by moving the quiz-vs-self-grade distinction off the entry screen and into the in-flow run loop: the self-grade Again/Hard/Good/Easy rating is the default in-flow revealed-card rating (per the artboard), and the quiz + confidence path remains its own documented run-loop mode rather than a competing entry CTA. The entry no longer forces the user to pick a "mode" before starting — it just starts the review.

This is the minimal change that matches the design's single-entry model without touching the (already-correct) self-grade card UI or any API.

### Dead copy/handlers to remove

- `ReviewQueueEntry.vue`: the "Self-grade flashcards" button markup, its `data-testid="start-self-grade-button"`, and the `'start-self-grade'` entry in `defineEmits`.
- `review.vue`: the `@start-self-grade="handleStartSelfGrade"` binding on `<ReviewQueueEntry>`. `handleStartSelfGrade` / the `self-grade` scene / `gradeReviewItem` remain (they implement the in-flow self-grade rating that the run-loop requirement keeps) — only the *entry-screen trigger* is removed. If, after rework, no path reaches the `self-grade` scene, that is a follow-up for the run-loop wiring task, not this entry-only delta.

## Blocker check

Not blocked. `useDueDomainBreakdown` already yields the per-domain `{ domain, count }` chips need from the existing `enrollmentReviewControllerQueue` items; no new API field or backend scope is required.
