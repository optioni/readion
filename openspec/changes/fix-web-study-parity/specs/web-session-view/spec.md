## MODIFIED Requirements

### Requirement: Session view renders a split panel with a collapsible agent

The session view SHALL render within the **app shell** (the global sidebar with `Sessions` active), matching `openspec/design/Session.html` and the design manifest — not the bare `minimal` layout. The content SHALL be the split panel of reading/quiz items on the left and a collapsible agent panel on the right. When the agent panel is collapsed it SHALL show a chat-bubble icon and a vertical "Ask AI" label alongside the expand control (not only a bare toggle arrow). The agent panel header SHALL show an online-status dot next to "Study assistant", and each non-user bubble SHALL render a per-message sparkle avatar.

#### Scenario: Session renders inside the app shell

- **WHEN** a session view renders
- **THEN** the global app sidebar is present with `Sessions` active, wrapping the reading/quiz + agent split

#### Scenario: Collapsed agent panel shows an icon and label

- **WHEN** the agent panel is collapsed
- **THEN** it shows a chat-bubble icon and a vertical "Ask AI" label alongside the expand control

### Requirement: Confidence rating is required and uses a 1–5 scale

Quiz cards SHALL require a confidence rating on a 1–5 scale before the answer is submitted (rate-then-submit) — the Submit control stays disabled until an option and a confidence value are both chosen. This gating is deliberate and is NOT changed to the artboard's submit-then-rate ordering. The confidence prompt SHALL interpolate the item's topic/domain (e.g. "How confident do you feel about **IAM & SCPs**?"), not a generic prompt.

#### Scenario: Confidence is required before submit with a topic-specific prompt

- **WHEN** a quiz card renders in the answering state
- **THEN** the confidence prompt names the item's topic/domain
- **AND** Submit remains disabled until both an option and a 1–5 confidence value are selected

### Requirement: Session start screen offers a one-tap quick start from saved defaults

The session-start screen SHALL offer a one-tap quick start from the saved session defaults. Above the start card it SHALL render a **cert identity pill** showing the certification's mono code and full name (sourced for the enrollment), so the user confirms which certification the session is for. The defaults summary SHALL render **humanized labels** via the shared value→label map (e.g. content mix, difficulty, learning style), never raw enum slugs.

#### Scenario: Cert identity pill and humanized defaults render

- **WHEN** the session-start screen renders for an enrollment
- **THEN** a cert identity pill with the cert code and full name is shown above the start card
- **AND** the defaults summary values render as humanized labels, not raw enum slugs

### Requirement: End-of-session summary screen renders the session outcome

The end-of-session summary SHALL render the session outcome, matching `openspec/design/Summary.html` for the fields the summary DTO carries. The readiness-change bar SHALL render the inset gradient fill plus a directional arrow marker (not a flat empty spacer). The header timestamp SHALL be a right-aligned relative label ("Today at h:mm A") opposite the title block. The content SHALL use the standard content width, and the Drill-my-misses CTA SHALL show its leading play icon. The streak stat SHALL remain the real day-streak metric (a "sessions in a row" count is a different metric and is not adopted).

#### Scenario: Readiness bar, timestamp, and drill CTA match the design

- **WHEN** the summary renders
- **THEN** the readiness-change bar shows a gradient fill and directional arrow
- **AND** the header timestamp is a right-aligned "Today at h:mm A" label and the Drill-my-misses CTA shows its leading icon
