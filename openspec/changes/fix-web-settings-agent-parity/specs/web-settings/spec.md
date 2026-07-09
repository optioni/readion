## MODIFIED Requirements

### Requirement: Study defaults tab edits all five session defaults

The Study defaults tab SHALL let the user edit **all five** session defaults — duration, content mix, difficulty, focus area, and learning style — pre-filled from `GET /users/me` `sessionDefaults` and persisted via `PATCH /users/me`, using the shared `sessionDefaultsSchema` enums as the authoritative allowed value sets. The focus-area field SHALL remain present (the artboard omitting it does not reduce the contract).

Option controls SHALL render **human-readable labels** via a value→label map (matching `openspec/design/Settings.html`) — the raw enum slugs (e.g. `beginner`, `reading-heavy`, `weak-area-focus`) MUST NOT be shown as button text. The mapping is presentational only: the value persisted to the profile remains the enum slug, and the full enum value set for each field is preserved (no options are dropped or renamed at the value level).

The **duration** field SHALL render as a slider (filled track, draggable thumb, live "N min" readout) that snaps to the real `sessionDefaultDurations` options `[15, 30, 60, 90]` — not free values and not the artboard's illustrative 5/15/30/45/60 ticks. The remaining fields SHALL render as fully-rounded pill chips with a solid-primary selected state.

Fields SHALL use the two-column **FieldRow** layout (a fixed-width label column with an optional hint on the left, the control on the right). The tab SHALL show a "Session preferences" section title and the intro copy explaining these are adaptive starting defaults ("These are your default starting values for each new session. Readion adjusts them over time based on your performance."), and the duration field SHALL show a "Default duration per session" hint.

#### Scenario: Options render human-readable labels, not raw slugs

- **WHEN** the Study defaults tab renders the difficulty, content-mix, and learning-style controls
- **THEN** each option shows a human-readable label (via the value→label map), never the raw enum slug
- **AND** the value persisted on change is still the enum slug, and every enum option remains selectable

#### Scenario: Duration renders as a slider over the real options

- **WHEN** the Session length field renders
- **THEN** it is a slider with a live "N min" readout that snaps to one of `[15, 30, 60, 90]`

#### Scenario: All five defaults are editable including focus area

- **WHEN** the Study defaults tab renders
- **THEN** duration, content mix, difficulty, focus area, and learning style are all present and editable

#### Scenario: Section framing and hint render

- **WHEN** the tab renders
- **THEN** a "Session preferences" section title and the adaptive-defaults intro copy are shown, and the duration field shows its "Default duration per session" hint
