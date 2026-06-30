## MODIFIED Requirements

### Requirement: Five-minute review — queue entry

The review run loop SHALL open on a queue-entry screen driven by `enrollmentReviewControllerQueue`, showing the due count and a per-domain breakdown of due items, with a primary "Start review" action calling `enrollmentReviewControllerStart`.

The per-domain breakdown SHALL render as **chips** — one chip per distinct due `domain`, each pairing the domain label with its due `count` (an accent-coloured numeric) — matching `openspec/design/QuickReview.html`, not a plain key/value list of rows. The counts SHALL continue to be derived client-side from the queue items' `domain` via the existing `useDueDomainBreakdown` composable (no new API field).

The entry SHALL surface a **single primary "Start review"** affordance that leads into the review flow. The self-grade Again/Hard/Good/Easy rating defined by "Five-minute review run loop" is the in-flow rating revealed on the card — it SHALL NOT be promoted to a second, parallel entry button on the queue-entry screen. The previous separate "Self-grade flashcards" entry button (and its `start-self-grade` affordance on this screen) SHALL be removed so the entry matches the design's single-entry model; selecting between the quiz + confidence path and the self-grade path is a property of the in-flow run loop, not a competing entry CTA.

#### Scenario: Per-domain breakdown renders as chips

- **WHEN** the queue has due items spanning multiple domains
- **THEN** the breakdown renders one chip per distinct domain, each showing the domain label and its due count
- **THEN** the breakdown is not rendered as a plain row-per-domain list, and the counts come from the queue items' `domain` (no new API field)

#### Scenario: Items are due

- **WHEN** the queue has due items (`meta.dueCount > 0`)
- **THEN** the entry screen shows the due count and the per-domain breakdown chips derived from the queue items' `domain`
- **THEN** a single primary "Start review" action calls `enrollmentReviewControllerStart`, which returns `{ status: 'started', session }`, and the loop advances into that `review`-kind session where the self-grade Again/Hard/Good/Easy rating is revealed in-flow on the card

#### Scenario: No separate self-grade entry button

- **WHEN** the queue-entry screen is shown with due items
- **THEN** there is no second "Self-grade flashcards" entry button alongside "Start review"
- **THEN** the only primary entry affordance is the single "Start review" that leads into the flow; the Again/Hard/Good/Easy self-grade is reached as the in-flow revealed-card rating, not as a parallel entry choice

#### Scenario: Nothing due — all caught up

- **WHEN** `enrollmentReviewControllerStart` returns `{ status: 'all_caught_up' }` (or the queue is empty)
- **THEN** the screen shows an "all caught up" empty state offering a normal study session instead of a review
