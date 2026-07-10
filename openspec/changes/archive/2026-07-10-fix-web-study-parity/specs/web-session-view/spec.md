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

Quiz cards SHALL require a confidence rating on a 1–5 scale before the answer is submitted (rate-then-submit) — the Submit control stays disabled until an option and a confidence value are both chosen. This gating is deliberate and is NOT changed to the artboard's submit-then-rate ordering. The confidence prompt SHALL interpolate the item's topic/domain (e.g. "How confident do you feel about **IAM & SCPs**?"), sourced from the item's persisted `domain` field, not a generic prompt.

#### Scenario: Confidence is required before submit with a topic-specific prompt

- **WHEN** a quiz card renders in the answering state
- **THEN** the confidence prompt names the item's topic/domain
- **AND** Submit remains disabled until both an option and a 1–5 confidence value are selected

### Requirement: Reading blocks render Markdown TL;DR with go-deeper expansion and citation chips

A reading-block item SHALL render its `content` as Markdown (the LLM-formatted TL;DR). It MUST provide a "Read full explanation" affordance that calls `POST /api/v1/sessions/:id/items/:index/go-deeper` and renders the returned `expandedContent` Markdown inline; once expanded the affordance MUST NOT re-fetch. It MUST render source citation chips derived from the item's provenance (`supportingSpans` / `sourceChunkIds`), and each chip MUST display a **human-readable source label**. A raw content-chunk id/UUID MUST NEVER be used as a chip label; when no human title can be resolved for a `sourceChunkId` the chip MUST fall back to a generic "Source" label rather than exposing the id. Advancing past a reading block MUST mark it complete via `POST /api/v1/sessions/:id/items/:index/complete`. The block SHALL render a **domain label** (e.g. "IAM & Security") beside the "Reading" pill, sourced from the item's persisted `domain` field (`SessionItemResponse.domain`) — this supersedes the prior deferred note; the domain is now real per-item data, not a placeholder.

#### Scenario: TL;DR renders and expands on demand

- **WHEN** a reading block is shown and the user presses "Read full explanation"
- **THEN** `POST /api/v1/sessions/:id/items/:index/go-deeper` is called and the returned `expandedContent` is rendered as Markdown below the TL;DR
- **AND** pressing it again does not trigger a second request

#### Scenario: Citation chips show human labels, never raw chunk ids

- **WHEN** a reading block carries `sourceChunkIds` containing a raw UUID and `supportingSpans`
- **THEN** the block renders one citation chip per cited source with a human-readable label
- **AND** no chip label is a raw content-chunk UUID

#### Scenario: Reading block shows its domain label

- **WHEN** a reading block item with a non-empty `domain` renders
- **THEN** its domain is shown as a label beside the "Reading" pill

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
