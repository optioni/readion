## Why

The implemented web UI is visually close to the Claude Design artboards, but its interaction contract is incomplete: important controls lack consistent hover, pressed, keyboard-focus, busy, error, and retry states, while several pages expose false-empty content, clipped or overflowing layouts, incomplete theme tokens, or behavior that diverges from the approved designs and existing specs. Closing these gaps now makes the interface predictable, accessible, and production-ready without changing the product's deliberately quiet visual language.

## What Changes

- Define a reusable interaction-state contract for primary, secondary, destructive, toggle, and icon controls, including hover, pressed, `focus-visible`, disabled, and in-flight feedback.
- Define consistent asynchronous presentation rules: page skeletons for initial reads, action-local spinners and progressive labels for mutations, preserved content during background refresh, explicit failure messages with Retry, and accessible busy/status announcements.
- Apply those states to learner-critical actions including session and mock-exam start, certification enrollment, quick review, full-explanation loading, Settings saves and deletion, agent initialization, and admin approval/re-verification/setup actions.
- Complete the Readion token mapping and ensure the color-mode toggle changes and persists a usable theme instead of presenting a cosmetic control.
- Remove horizontal overflow at phone widths, especially in Settings, and correct progress-chart labels and other responsive visual defects.
- Reconcile the standalone-agent TTL treatment with the behavioral contract so expiry information appears only when actionable rather than as persistent chrome.
- Bring contrast, semantic state attributes, reduced-motion behavior, design-parity documentation, and browser coverage into alignment with `DESIGN.md`, the imported Claude Design artboards, and the existing web specifications.
- Remove or update assertions and parity notes that encode obsolete prototype behavior.

## Capabilities

### New Capabilities

- `web-interaction-states`: Cross-cutting visual, semantic, and accessibility requirements for interactive controls and asynchronous UI states across the web application.

### Modified Capabilities

- `web-shell`: Complete the Readion token contract, make color-mode switching functional and persistent, and prevent shell/content overflow at phone widths.
- `web-dashboard`: Add honest initial/error states and action-local progress for session start, mock-exam start, review start, and certification enrollment.
- `web-cert-detail`: Add loading, failure, and pending-action feedback for certification detail/history surfaces and header quick actions.
- `web-session-view`: Add observable progress and recovery behavior while creating/resuming sessions and expanding remotely loaded explanations.
- `web-progress`: Keep progress charts legible and contained at supported viewports and give progress/quick-review data explicit loading, empty, error, and retry states.
- `web-agent-chat`: Add conversation initialization recovery and replace the persistent TTL indicator with an actionable near-expiry warning.
- `web-settings`: Prevent mobile overflow and add profile-loading, error/retry, mutation-busy, and mutation-result feedback across all tabs.
- `web-admin`: Identify the specific in-flight admin action and expose usable loading, success, failure, and retry states for review and certification operations.

## Impact

- Primary implementation impact is in `apps/web`: shared UI primitives/styles, composables, learner pages, admin components, accessibility attributes, and Playwright/component tests.
- `DESIGN.md` and the OpenSpec design-parity records will gain the missing interaction, asynchronous-state, responsive, and accessibility guidance.
- Existing API contracts remain unchanged; this change consumes the current query and mutation state exposed by the generated client and TanStack Query.
- No database migration, backend endpoint, or new runtime dependency is expected.
