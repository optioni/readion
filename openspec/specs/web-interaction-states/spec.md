## Purpose

Specifies the cross-cutting interaction contract for `apps/web`: the visual state matrix every interactive control exposes (rest, hover, pressed, keyboard focus, disabled, selected, busy), how asynchronous HTTP-backed regions distinguish initial loading from content, empty, failure, and background refresh, and the accessibility, motion, and contrast requirements that apply to all of it. Page- and feature-level capabilities inherit these requirements rather than restating them; `DESIGN.md` carries the corresponding implementer guidance and the shared primitives that satisfy it.

## Requirements

### Requirement: Interactive controls expose a complete visual state contract

Every enabled primary, secondary, destructive, toggle, and icon control in `apps/web` SHALL expose distinguishable rest, pointer-hover, pressed, and keyboard-focus states using Readion semantic tokens. The pressed state MUST provide immediate in-place feedback without changing the surrounding layout. Keyboard focus MUST use an application-defined `:focus-visible` indicator with at least 3:1 contrast against adjacent colors. A control that represents a persistent selection MUST expose the appropriate semantic state (`aria-pressed`, `aria-selected`, `aria-checked`, or `aria-current`).

#### Scenario: Primary control responds to pointer and keyboard input

- **WHEN** Playwright renders an enabled primary action, records its computed rest styles, hovers it, presses it, and then focuses it with the keyboard
- **THEN** the hover state has a computed surface or border different from rest
- **AND** the pressed state has an in-place transform or stronger active surface without changing the control's bounding-box position in page layout
- **AND** keyboard focus renders a visible focus indicator whose contrast against adjacent colors is at least 3:1

#### Scenario: Selected toggle exposes state semantically

- **WHEN** the user activates an unselected two-way toggle
- **THEN** its selected visual state changes
- **AND** the control exposes the new state through `aria-checked` or the native checked property

### Requirement: Disabled and busy are distinct states

An unavailable control SHALL be disabled and visually muted without a progress indicator. A control whose accepted action is in flight SHALL remain dimensionally stable, reject duplicate activation, expose `aria-busy="true"`, and show an inline progress indicator with an action-specific progressive label such as "Starting…", "Saving…", "Adding…", "Approving…", or "Deleting…". When the operation settles, the control SHALL leave the busy state and either present the successful result or become available for an explicit retry.

#### Scenario: Mutation button identifies the action in progress

- **WHEN** a user activates a "Start session" button and the intercepted request remains pending
- **THEN** exactly one request is sent
- **AND** the button remains the same width, is not activatable again, exposes `aria-busy="true"`, and displays a spinner with "Starting…"
- **AND** after the request succeeds the destination transition occurs and the busy state is removed

#### Scenario: Prerequisite-disabled control does not imply progress

- **WHEN** a form's submit control is disabled because a required field is empty
- **THEN** the control is visibly unavailable and cannot be activated
- **AND** it does not expose `aria-busy="true"`, a spinner, or progressive action copy

### Requirement: Asynchronous reads never render a false success or empty state

Every HTTP-backed region SHALL distinguish initial loading, successful content, successful empty, failure, and background refresh. Initial loading SHALL render a bounded skeleton or status placeholder and MUST NOT render success or empty copy. A failure SHALL render a concise error with a Retry action. Retry SHALL repeat the read once per activation. A background refresh SHALL preserve the last successful content while exposing non-blocking progress.

#### Scenario: Delayed initial read does not show empty content

- **WHEN** Playwright delays an HTTP read for an otherwise empty collection
- **THEN** the region exposes `aria-busy="true"` and renders its loading presentation
- **AND** no success or empty-state copy is visible until the response resolves
- **AND** after a successful response containing zero items the loading presentation is removed and the empty state is shown

#### Scenario: Failed read can be retried

- **WHEN** the first HTTP read returns an RFC 7807 error and the second returns content
- **THEN** the region shows an error message and a Retry action and does not show the empty state
- **AND** activating Retry issues exactly one additional request
- **AND** the error is replaced by the returned content after the second response

### Requirement: Progress and result feedback is accessible

Async regions SHALL expose `aria-busy` while work is pending. Newly rendered non-destructive status text SHALL be announced through `role="status"` or an `aria-live="polite"` region. Destructive failures SHALL use an assertive alert. Icon-only controls MUST have an accessible name, and focus MUST move predictably when a modal opens, closes, or an async route transition fails.

#### Scenario: Screen reader receives mutation progress and completion

- **WHEN** a save operation starts and then succeeds
- **THEN** the operation region exposes `aria-busy="true"` while pending
- **AND** progressive copy is available to the accessibility tree
- **AND** completion text is rendered in a polite status region after success

### Requirement: Motion and contrast respect user needs

Interactive transitions SHALL complete in approximately 120–180ms and SHALL use only opacity, color, border, or in-place transform for routine feedback. When `prefers-reduced-motion: reduce` is active, non-essential transforms and transitions MUST be removed. Normal-size text MUST have at least 4.5:1 contrast; large text and essential non-text state indicators MUST have at least 3:1 contrast.

#### Scenario: Reduced motion removes press animation

- **WHEN** Playwright emulates `prefers-reduced-motion: reduce` and presses an enabled action
- **THEN** the action still exposes a distinguishable active state
- **AND** its computed transition duration for non-essential transform motion is zero

#### Scenario: Shared control states meet contrast thresholds

- **WHEN** component tests render primary, secondary, destructive, disabled, focus-visible, and busy variants in both supported color modes
- **THEN** normal-size labels have a computed contrast ratio of at least 4.5:1
- **AND** focus and essential state indicators have a computed contrast ratio of at least 3:1
