## Context

The web application implements the structure and visual hierarchy of the imported Claude Design artboards, but interaction behavior grew page by page. The result is a fragmented state model: hover is common but shallow, explicit pressed and `focus-visible` states are absent, disabled and busy often look identical, and some queries render empty content before they have resolved. The same audit found incomplete token aliases, a cosmetic color-mode toggle, 375px Settings overflow, clipped progress-chart text, an always-visible agent TTL chip, and stale parity assertions.

This is a cross-cutting frontend change. It must preserve Readion's dark-first, low-noise character while making every wait and interaction legible to pointer, keyboard, touch, and assistive-technology users. Existing HTTP contracts are sufficient; the work is primarily shared presentation primitives, query/mutation state handling, responsive CSS, semantics, documentation, and tests.

## Goals / Non-Goals

**Goals:**

- Establish one reusable state contract for primary, secondary, destructive, toggle, and icon controls.
- Make initial loading, background refresh, action progress, success, failure, empty, and retry states mutually exclusive and observable.
- Correct the audited token, theme, responsive-overflow, chart-legibility, contrast, and agent-TTL divergences.
- Cover the contract with outside-in Playwright tests and focused component/unit tests.
- Keep motion subtle, layout-stable, and compatible with `prefers-reduced-motion`.

**Non-Goals:**

- Redesigning the Claude Design artboards or changing Readion's information architecture.
- Changing REST endpoints, DTOs, persistence, session-generation semantics, or TTL duration.
- Adding ornamental animation, shadows, gradients, or color beyond `DESIGN.md`.
- Introducing a visual-regression SaaS, animation library, or new component framework.
- Replacing all existing components when a shared state primitive or style recipe can compose with them.

## Visual Design

Visual source of truth: the repository's previously imported snapshots from the Claude Design project, copied into this change at `design/<view>.html`. DesignSync was not available in the current session, so these checked-in snapshots were reused without modification and their provenance remains `openspec/design/`.

| Artboard / screen | Maps to |
|---|---|
| `design/app-shell.html` | Default authenticated shell, navigation controls, theme toggle, shared tokens |
| `design/dashboard.html` | Dashboard queries, quick starts, review start, and add-certification modal |
| `design/cert-detail.html` | Certification overview/history regions and header quick actions |
| `design/settings.html` | Settings tabs, FieldRows, saves, password update, digest toggle, deletion |
| `design/progress.html` | Progress charts, metrics, history, and responsive chart labels |
| `design/quick-review.html` | Review queue loading, empty, error, run, and completion states |
| `design/agent-chat.html` | Standalone conversation initialization, composer states, and TTL warning |
| `design/session-start.html` | Quick/custom session creation and resume feedback |
| `design/session.html` | In-session reading content and remote full-explanation expansion |
| `design/admin-review-queue.html` | Admin fetch, approve, reject, and retry states |
| `design/admin-certifications.html` | Certification list loading and re-verification actions |
| `design/admin-cert-setup.html` | Certification setup review and draft creation |

**Layout to implement:** Preserve the existing shared app shell and focused-flow layouts. Build the control-state recipe and async-state primitives once, then compose them into page-owned controls. FieldRow is shared by all Settings tabs and must switch from two columns to a stacked layout below its mobile breakpoint. Page-specific content remains responsible for its own copy and result navigation.

### Design ↔ contract reconciliation

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Artboards mostly show a single resting state | Production controls need hover, pressed, keyboard focus, disabled, and busy states | Extend the artboard language with token-based, low-motion states defined by `web-interaction-states`; do not add decorative effects |
| Static pages omit loading and transport failures | HTTP-backed views can be unresolved or fail | Specs win: show structure-preserving loading, explicit failure and Retry, and never show empty/success content before resolution |
| Dark artboards do not demonstrate a complete light palette | `web-shell` requires a working, persistent color-mode toggle | Retain dark as the first-load default and supply complete semantic variables for both persisted modes |
| Settings uses a desktop FieldRow | A 375px viewport currently overflows horizontally | Preserve FieldRow on desktop and stack label/control/action regions on phones without document overflow |
| Progress chart uses illustrative SVG typography | Real labels can exceed the plotted bounds and become clipped or oversized | Treat the illustration as hierarchy only; use bounded responsive text and verify every label remains within the chart container |
| Agent artboard presents session-duration chrome | The behavior contract requires expiry disclosure only when actionable | Remove the persistent TTL chip; render a polite warning only inside the existing near-expiry threshold and clear it after activity resets expiry |
| Quick Review artboard includes a caught-up state | The due-count request is asynchronous | Do not render caught-up until a successful response explicitly reports zero due items |
| Static buttons retain their normal labels | Mutations can take long enough for duplicate input or uncertainty | Keep button width stable, show an inline spinner and action-specific progressive copy, and disable duplicate submission only while in flight |
| Some prototype colors are raw slate values | Readion uses semantic tokens and accessible contrast | Map all shared states to semantic tokens and enforce WCAG AA contrast for text and focus indicators |
| Prototype assertions encode static copy/placement | Behavioral and accessibility requirements now add transient content | Update parity records and tests where the new contract intentionally supersedes static assertions |

## Test Boundaries

| Dependency | In acceptance test | In unit tests |
|---|---|---|
| Nuxt application and shared UI components | Real application rendered in Chromium by Playwright | Real mounted Vue components where DOM behavior matters |
| REST API | Playwright route interception with deterministic delayed, success, and RFC 7807 responses | Generated composables/mutation functions mocked at the module boundary |
| PostgreSQL, Redis, workers, and LLM providers | Not started; all affected backend calls are intercepted because API behavior is unchanged | Not used |
| Claude Design artboards | Checked-in HTML fixtures used as human/parity reference, not executed as the application | Not used |
| CSS tokens, responsive layout, and browser focus | Real computed styles and layout in desktop and 375px browser viewports | Token/state mapping functions tested directly where extracted |
| Color-mode persistence | Real browser storage and document-root class across reload | Storage adapter mocked only for isolated composable tests |
| Reduced-motion preference | Real Playwright media emulation | Motion-class selection tested as pure/state mapping if needed |
| Accessibility announcements | Real DOM roles/ARIA attributes and focus order in Playwright | Mounted component assertions for `aria-busy`, live regions, and selection semantics |
| SVG/chart layout | Real browser bounding boxes and overflow checks with deterministic fixture data | Formatting and label-density helpers tested as pure functions |

No NestJS integration test is required because this change does not modify a backend contract. Acceptance tests still exercise the application from the browser boundary and fail against the current UI before implementation begins.

## Decisions

### Use shared state recipes and small primitives

Create or consolidate a shared button/control recipe plus reusable loading, skeleton, async-message, and status-indicator primitives. Page components provide action-specific labels and icons.

Alternative: patch Tailwind classes independently in every component. Rejected because the audit already demonstrates drift caused by page-local state styling and because future controls would have no enforceable contract.

### Separate disabled from busy

`disabled` means an action is unavailable because prerequisites are unmet. `busy` means the accepted action is executing. Busy controls keep their footprint, replace or augment their label with a spinner and progressive verb, expose `aria-busy="true"`, and reject duplicate activation.

Alternative: reduce opacity for both states. Rejected because it hides whether input was accepted and is inaccessible to screen-reader users.

### Model queries as explicit mutually exclusive states

Initial loading renders a skeleton or bounded status placeholder; success with zero items renders the empty state; failure renders a concise error and Retry; background refetch preserves the last successful content and adds non-blocking progress.

Alternative: initialize data to zero/empty arrays and let templates render immediately. Rejected because it produces false success and false-empty states.

### Keep motion quiet and tokenized

Pointer hover and press feedback uses color/border changes and a subtle press transform over approximately 120–180ms. Focus is immediate and visible. Under `prefers-reduced-motion: reduce`, non-essential transforms and transitions are removed.

Alternative: rich spring motion or per-control animation. Rejected because it conflicts with Readion's focused, low-noise visual system and adds an unnecessary dependency.

### Make focus and contrast first-class tokens

Add the missing surface, border, warning, focus-ring, and mode-specific semantic aliases to the theme. Shared controls consume semantic aliases rather than raw palette utilities. Text meets 4.5:1 contrast at normal sizes; large text and non-text focus indicators meet 3:1.

Alternative: keep raw Tailwind values inside individual components. Rejected because raw values caused missing aliases and inconsistent contrast.

### Test representative variants plus every audited critical flow

Component tests cover the complete shared variant/state matrix once. Playwright covers keyboard/pointer behavior and the critical asynchronous flows: dashboard, session start, quick review, agent, progress, Settings, and admin review.

Alternative: duplicate the entire state matrix in every page test. Rejected because it is slow and brittle; page tests only need to prove correct integration and action-specific copy.

### Keep transient feedback local to the initiating action

Mutation progress appears in the activated control or its nearest operation region. Destructive and competing admin actions identify the exact operation in progress. Initial reads use page/section placeholders, not global overlays.

Alternative: a global loading overlay. Rejected because it obscures unaffected content, breaks context, and makes concurrent requests ambiguous.

## Risks / Trade-offs

- [A shared recipe changes many controls at once] → Introduce it behind component tests, migrate by control family, and run existing visual/functional Playwright suites after each group.
- [Pressed transforms can cause visual jitter] → Transform the control in place, reserve spinner/label width, and never change surrounding layout dimensions.
- [Focus rings may be clipped by overflow containers] → Include focus-ring clearance in primitives and test keyboard traversal inside cards, modals, tabs, and sidebars.
- [Light-mode fixes broaden the visual matrix] → Limit to semantic token substitution and add a focused persistence/contrast acceptance test rather than duplicating every dark-mode screenshot.
- [Skeletons can mimic content too literally or flash on fast requests] → Use simple structural blocks, preserve minimum dimensions, and avoid delayed fake loading.
- [Retry can repeat non-idempotent mutations] → Offer Retry automatically for reads; for mutations, return the control to an enabled state and require an explicit new activation.
- [Static Claude snapshots may have changed remotely] → Treat the checked-in snapshot as the implementation source for this change and refresh through DesignSync before implementation if the connector becomes available.
- [Broad scope can produce an unreviewable patch] → Tasks are divided into independently testable slices of at most two hours, with the shared contract landing before page migrations.

## Open Questions

None blocking. If DesignSync becomes available before implementation, refresh only the twelve owned snapshots and record any changed hashes before writing acceptance tests.
