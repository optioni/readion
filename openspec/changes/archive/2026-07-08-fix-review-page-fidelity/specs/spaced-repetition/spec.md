## ADDED Requirements

### Requirement: Review page adopts the dedicated ReviewHeader

The web review page (`/user-certifications/:id/review`) SHALL render a dedicated `ReviewHeader` per the design (`QuickReview.html`) rather than only the bare entry card. The header SHALL show a back-to-dashboard affordance, a cert-code chip alongside a "Quick review" label, a progress bar bound to the current/total review position, and a 5:00 review timer. It SHALL NOT stack a second app/dashboard nav bar above the review surface.

#### Scenario: Review header renders on the review page

- **WHEN** the review page loads for an enrollment with due items
- **THEN** a `ReviewHeader` is shown with the cert-code chip and "Quick review" label, a progress bar, and a 5:00 review timer
- **AND** no generic "Readion / Back to dashboard" app nav bar is stacked above it

### Requirement: Review entry card exposes secondary action and overdue note

The `ReviewQueueEntry` card SHALL, when items are due, present the primary "Start review →" CTA alongside a secondary "Review all N" action, and SHALL show an overdue note ("N items overdue by X days") when one or more due items are past their `dueAt` by at least a day. The existing due-count circle, "N item(s) due for review" line, and by-domain chips SHALL be retained, and the "all caught up" empty state SHALL remain for a zero due count.

#### Scenario: Secondary action and overdue note render when items are overdue

- **WHEN** the review page loads for an enrollment whose due queue returns several items, some overdue by 2 days
- **THEN** the `ReviewQueueEntry` shows the primary "Start review →" CTA and a secondary "Review all N" action
- **AND** it shows an overdue note reading "N items overdue by 2 days"

#### Scenario: Zero due count still shows the all-caught-up state

- **WHEN** the review page loads for an enrollment whose due queue returns a due count of zero
- **THEN** the page renders the "all caught up" empty state rather than the entry card, secondary action, or overdue note
