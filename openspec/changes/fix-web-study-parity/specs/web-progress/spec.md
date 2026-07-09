## MODIFIED Requirements

### Requirement: Five-minute review — queue entry

The five-minute review queue entry SHALL render as a centered, full-bleed hero (matching `openspec/design/QuickReview.html`) — vertically and horizontally centered in the area below the header, without a bordered/backgrounded card wrapper. It SHALL show a rounded accent-tinted **queue icon** above a plain, standalone due-count headline (not a count embedded in a circular avatar badge), the "items due for review" line, the domain breakdown chips (with no "By domain" section label), and the caption "Scheduled by spaced repetition · ~5 minutes". The `ReviewHeader` timer SHALL be a **live countdown** starting at 5:00 that decrements across the session and enters the urgent (red) state near expiry — not a static default.

The queue screen SHALL retain the "Prefer quiz instead?" mode toggle that lets the user choose the self-grade flashcard loop or the quiz + confidence run loop (a speced capability); the artboard depicts only the flashcard loop and does not remove the toggle.

#### Scenario: Queue renders as a centered hero with the icon and caption

- **WHEN** the five-minute review queue entry renders with items due
- **THEN** the content is a centered full-bleed hero with the queue icon above a plain due-count headline
- **AND** the "Scheduled by spaced repetition · ~5 minutes" caption is shown and no "By domain" label precedes the domain chips

#### Scenario: Countdown timer ticks down

- **WHEN** the review session is in progress
- **THEN** the header timer counts down from 5:00 and enters the urgent state near expiry

#### Scenario: Quiz-mode toggle remains available

- **WHEN** the queue entry renders
- **THEN** the "Prefer quiz instead?" toggle is shown, offering the self-grade or quiz+confidence run loop
