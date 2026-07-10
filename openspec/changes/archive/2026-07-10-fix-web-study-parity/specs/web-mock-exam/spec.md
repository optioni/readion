## MODIFIED Requirements

### Requirement: Mock-exam page renders a full-screen, agent-free surface keyed on generation and status

The mock-exam page SHALL render a full-screen, agent-free surface keyed on generation and status, with **exactly one header** — the exam's own `ExamHeader` — as the only chrome above the question/nav-panel split (matching `openspec/design/MockExam.html`). The page MUST NOT inherit the `minimal` layout's header (logo + "Back to dashboard"), which would stack a second header above `ExamHeader`; it uses a bare/headerless layout instead. `ExamHeader` SHALL include the accent logo mark, show only the uppercase cert **code** (not the full cert name) in the active state, and render the flag and timer with their icons.

#### Scenario: Only one exam header renders

- **WHEN** the active mock-exam surface renders
- **THEN** the exam's `ExamHeader` is the only header bar (no stacked minimal-layout header)
- **AND** it shows the logo mark, the code-only cert identity, and flag/timer icons

### Requirement: Active exam presents one question at a time with a question-nav sidebar

The active exam SHALL present one question at a time with a question-nav sidebar. A question SHALL be **flaggable per question**: flag state is keyed by question index (not a single shared toggle), and a flagged question SHALL render a distinct "Flagged" square in the nav grid regardless of which question is currently displayed. The active-mode nav legend SHALL show "Answered" and "Flagged" swatches, and the `NavSquareState` SHALL include a `flagged` variant. Flag state is session-scoped (in memory); persistence across reload is not required.

#### Scenario: Flagging a question marks its nav square independently

- **WHEN** the user flags question N while question M (≠ N) is current
- **THEN** question N's nav square renders in the "Flagged" state while M remains the current square
- **AND** the active-mode legend shows "Answered" and "Flagged"
