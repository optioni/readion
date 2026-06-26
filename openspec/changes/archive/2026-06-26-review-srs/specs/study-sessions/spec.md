## MODIFIED Requirements

### Requirement: Session planner derives item plan from config

The session planner SHALL derive the number of items from session duration (~2 min per reading block, ~1 min per quiz question), determine target domains from the focus area (explicit domains, or auto-weighted by `WeakArea` scores for the enrollment), and deterministically choose each quiz item's `format` (multiple-choice / true-false / scenario-based) from the chunk characteristics and session difficulty before any generation call. Item types SHALL alternate reading block → quiz questions → reading block. When the session's `learningStyle` is `spaced-repetition`, the planner SHALL consult `ReviewModule`'s due-items provider for the enrollment and front-load due `ReviewItem`s as quiz items at the start of the plan before any new-material items; when no items are due, the plan SHALL proceed with new material as normal.

#### Scenario: Item count scales with duration

- **WHEN** a 30-minute balanced session is planned
- **THEN** the plan contains roughly 4 reading blocks and 12 quiz questions, sequenced as reading block → quiz questions → reading block …

#### Scenario: Auto focus weights toward weak areas

- **WHEN** a session with `focusArea: { mode: "auto" }` is planned for an enrollment whose ranked `WeakArea` list puts "Security" first
- **THEN** the planner biases target-domain selection toward "Security" using the weak-area ranking from `WeakAreasModule`

#### Scenario: Specific focus area restricts domains

- **WHEN** a session with `focusArea: { mode: "domains", domains: ["Networking"] }` is planned
- **THEN** all planned items target only the "Networking" domain

#### Scenario: Format is fixed before generation

- **WHEN** the planner assigns a quiz item at exam-ready difficulty whose chunk supports a scenario stem
- **THEN** the item's `format` is set to `scenario-based` before the generation call, so `{ chunkIds, difficulty, format, certification }` is a complete cache key

#### Scenario: Spaced-repetition style front-loads due review items

- **WHEN** a session with `learningStyle: "spaced-repetition"` is planned for an enrollment that has 4 due `ReviewItem`s
- **THEN** the planner places quiz items generated from those due review items at the start of the plan, before any new-material items, and marks the remaining items as new material

#### Scenario: Spaced-repetition style with nothing due proceeds with new material

- **WHEN** a session with `learningStyle: "spaced-repetition"` is planned for an enrollment with zero due `ReviewItem`s
- **THEN** the plan contains only new-material items, as if no front-loading applied
