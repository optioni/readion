## MODIFIED Requirements

### Requirement: Five-minute review run loop

The `web-progress` review run loop SHALL render the reveal step's Again / Hard / Good / Easy buttons as real self-grade submissions calling the explicit self-grade endpoint, driving Leitner scheduling, in addition to (or as an alternative mode to) the existing quiz + confidence path. Each grade submits and advances to the next due item; the completion breakdown reflects the graded items.

#### Scenario: Self-grade advances the review loop

- **WHEN** the user reveals a review card and taps `Good`
- **THEN** the self-grade endpoint is called with `grade: good` for that `ReviewItem` and the loop advances to the next due item
- **AND** the completion breakdown counts the item as reviewed
