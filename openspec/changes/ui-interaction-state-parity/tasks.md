## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up deterministic Playwright route fixtures for delayed reads, delayed mutations, RFC 7807 failures, retries, background refreshes, and successful navigation using the HTTP boundary in `design.md` (SPEC.md § Frontend — `apps/web`; § Testing Strategy)
- [x] 0.2 Write failing acceptance tests for the complete shared control-state matrix, keyboard focus, busy semantics, accessible status announcements, contrast, and reduced motion from `web-interaction-states` (SPEC.md § Frontend — `apps/web`; § Testing Strategy)
- [x] 0.3 Write failing acceptance tests for color-mode persistence, semantic token resolution, and 375px shell overflow across Dashboard, Progress, Ask AI, Settings, and Admin from `web-shell` (SPEC.md § Frontend — `apps/web` → Layout Decisions; § Testing Strategy)
- [x] 0.4 Write failing acceptance tests for dashboard/cert-detail loading, false-empty prevention, Retry, session/mock/review start progress, and selected-certification enrollment progress from `web-dashboard` and `web-cert-detail` (SPEC.md § Frontend — `apps/web` → Pages; § Certification Enrollment)
- [x] 0.5 Write failing acceptance tests for quick/custom session start and remote explanation progress/recovery from `web-session-view`, using `design/session-start.html` and the design reconciliation (SPEC.md § Frontend — `apps/web` → Study session; § Session Item Generation)
- [x] 0.6 Write failing acceptance tests for Progress and Quick Review loading/error states, bounded chart labels, and 375px containment from `web-progress`, using `design/progress.html` and `design/quick-review.html` (SPEC.md § Frontend — `apps/web` → Progress; § Spaced Repetition & Review Queue)
- [x] 0.7 Write failing acceptance tests for agent initialization/Retry and actionable-only TTL disclosure from `web-agent-chat`, using `design/agent-chat.html` (SPEC.md § Frontend — `apps/web` → Agent chat; § Agent Context)
- [x] 0.8 Write failing acceptance tests for Settings mobile reflow, profile loading/Retry, save/digest/delete progress, and rollback from `web-settings`, using `design/settings.html` (SPEC.md § Frontend — `apps/web` → Settings; § Account Deletion)
- [x] 0.9 Write failing acceptance tests for operation-specific admin Approve, Reject, Re-verify, Create, and collection Retry behavior from `web-admin`, using `design/admin-review-queue.html` (SPEC.md § Frontend — `apps/web` → Admin; § Certification Setup & Grounding)
- [x] 0.10 Run the new acceptance suite and record that every scenario fails for an expected missing behavior or style—not a fixture, selector, authentication, or startup error (SPEC.md § Testing Strategy → Layers and Tooling)

## 1. Semantic Tokens and Control Primitives

- [x] 1.1 RED: Write component tests for dark/light semantic token completeness and for primary, secondary, destructive, toggle, and icon control rest/hover/pressed/focus-visible/disabled/busy variants (SPEC.md § Frontend — `apps/web` → Layout Decisions; § Testing Strategy)
- [x] 1.2 GREEN: Define the missing surface, border, warning, focus, and mode-specific tokens and implement the shared control-state recipe with stable busy dimensions and action-specific label slots (SPEC.md § Frontend — `apps/web` → Layout Decisions)
- [x] 1.3 RED: Add component tests for accessible names, selection semantics, `aria-busy`, polite/assertive status roles, contrast thresholds, and reduced-motion overrides (SPEC.md § Frontend — `apps/web`; § Testing Strategy)
- [x] 1.4 GREEN: Implement the semantic attributes, visible focus treatment, contrast-safe variants, and reduced-motion behavior needed to pass the state matrix (SPEC.md § Frontend — `apps/web` → Layout Decisions)
- [x] 1.5 REFACTOR: Consolidate duplicated button/icon/toggle state classes into typed shared recipes without changing the Claude Design hierarchy (SPEC.md § Frontend — `apps/web` → Layout Decisions)

## 2. Shared Async-State Presentation

- [x] 2.1 RED: Write component tests for mutually exclusive initial-loading, content, empty, error/Retry, and background-refresh states plus action-local mutation progress (SPEC.md § Frontend — `apps/web`; § Testing Strategy)
- [x] 2.2 GREEN: Implement or consolidate shared skeleton, async-message, inline-spinner, status-region, and query-state helpers that preserve loaded content during refetch (SPEC.md § Frontend — `apps/web`)
- [x] 2.3 RED: Write tests proving Retry issues one read per activation and busy mutation controls reject duplicate submission without automatically replaying non-idempotent requests (SPEC.md § API conventions; § Testing Strategy)
- [x] 2.4 GREEN: Wire explicit retry callbacks and duplicate-submission guards into the shared primitives/composables (SPEC.md § API conventions; § Frontend — `apps/web`)
- [x] 2.5 REFACTOR: Remove superseded one-off loading markup only where behavior and accessibility remain covered by the shared tests (SPEC.md § Frontend — `apps/web`)

## 3. Shell, Theme, and Responsive Frame

- [x] 3.1 RED: Add focused component tests for real document-root color-mode switching, persisted restoration, and complete semantic variable substitution (SPEC.md § Frontend — `apps/web` → Layout Decisions)
- [x] 3.2 GREEN: Make the sidebar color-mode toggle update and persist a usable dark/light theme while keeping dark as the first-load default, matching `design/app-shell.html` reconciliation (SPEC.md § Frontend — `apps/web` → Layout Decisions)
- [x] 3.3 RED: Add layout tests with long labels that reproduce document overflow in the default shell and shared content containers at 375px (SPEC.md § Frontend — `apps/web` → Mobile & PWA)
- [x] 3.4 GREEN: Correct shell/container minimum widths, wrapping, bounded local overflow, and focus-ring clearance without changing desktop layout (SPEC.md § Frontend — `apps/web` → Mobile & PWA)
- [x] 3.5 REFACTOR: Replace remaining audited raw shared palette utilities with semantic tokens where they encode background, border, status, text, or interaction state (SPEC.md § Frontend — `apps/web` → Layout Decisions)

## 4. Dashboard and Certification Detail

- [x] 4.1 RED: Write component tests for dashboard enrollment loading/failure/Retry and preservation of loaded certification cards during refetch (SPEC.md § Frontend — `apps/web` → Dashboard)
- [x] 4.2 GREEN: Implement honest dashboard query-state rendering, including "Couldn't load your certifications" and Retry, without flashing the no-certifications state (SPEC.md § Frontend — `apps/web` → Dashboard)
- [x] 4.3 RED: Write component tests for action-specific Start session, Mock exam, review start, and selected-certification Adding states, duplicate guards, and failure recovery (SPEC.md § Frontend — `apps/web` → Dashboard; § Certification Enrollment)
- [x] 4.4 GREEN: Migrate dashboard quick starts and add-certification enrollment to the shared busy/error contract while retaining `design/dashboard.html` placement and copy (SPEC.md § Frontend — `apps/web` → Dashboard; § Certification Enrollment)
- [x] 4.5 RED: Write component tests that separate cert-detail header/overview/history loading, empty, failure, Retry, and launch progress using `design/cert-detail.html` reconciliation (SPEC.md § Frontend — `apps/web` → Certification detail)
- [x] 4.6 GREEN: Implement section-local cert-detail async states and header launch feedback from `design/cert-detail.html` without discarding successful sibling content (SPEC.md § Frontend — `apps/web` → Certification detail)
- [x] 4.7 REFACTOR: Share launch-action logic between dashboard and cert header while preserving page-owned navigation and messages (SPEC.md § Frontend — `apps/web` → Pages)

## 5. Session Start and Reading Expansion

- [x] 5.1 RED: Write component tests for quick/custom Start session busy state, resume navigation, duplicate rejection, and configuration preservation after failure (SPEC.md § Frontend — `apps/web` → Study session; § Session resume)
- [x] 5.2 GREEN: Implement action-local "Starting…" feedback for quick/custom creation and resume paths using `design/session-start.html` (SPEC.md § Frontend — `apps/web` → Study session; § Session resume)
- [x] 5.3 RED: Write component tests for full-explanation Loading, retained TL;DR/citations, inline failure, Retry, and stable focus using `design/session.html` reconciliation (SPEC.md § Session Item Generation; § Frontend — `apps/web` → Study session)
- [x] 5.4 GREEN: Implement the remote reading-expansion async state from `design/session.html` without hiding existing learning content or duplicating requests (SPEC.md § Session Item Generation; § Frontend — `apps/web` → Study session)
- [x] 5.5 REFACTOR: Consolidate session operation feedback while retaining distinct create/resume/explanation result handling (SPEC.md § Frontend — `apps/web` → Study session)

## 6. Progress Charts and Quick Review

- [x] 6.1 RED: Write component tests proving Progress summary/trend/domain/history regions do not render synthetic zero/empty content before successful responses and retry independently (SPEC.md § Frontend — `apps/web` → Progress; § Exam Readiness Score)
- [x] 6.2 GREEN: Implement structural Progress skeletons, section-local failure/Retry, and content-preserving background refresh using `design/progress.html` (SPEC.md § Frontend — `apps/web` → Progress; § Exam Readiness Score)
- [x] 6.3 RED: Write chart tests for bounded font sizes, contained label bounding boxes, projection rendering, and no document overflow at 375px/1440px (SPEC.md § Exam Readiness Score → Readiness trajectory; § Testing Strategy)
- [x] 6.4 GREEN: Correct readiness/accuracy chart typography, label density, responsive bounds, and SVG/container sizing while preserving the artboard hierarchy (SPEC.md § Exam Readiness Score → Readiness trajectory)
- [x] 6.5 RED: Write Quick Review component tests for delayed due count, explicit zero, failure/Retry, and start-action progress (SPEC.md § Spaced Repetition & Review Queue → Consumption and Interactions)
- [x] 6.6 GREEN: Replace the implicit zero initialization with explicit review query states and integrate shared busy/Retry feedback using `design/quick-review.html` (SPEC.md § Spaced Repetition & Review Queue → Consumption and Interactions)
- [x] 6.7 REFACTOR: Share only generic progress/loading pieces; keep chart and review domain state in their owning components (SPEC.md § Frontend — `apps/web` → Progress)

## 7. Standalone Agent Chat

- [x] 7.1 RED: Write composable/component tests for initializing, hydrated, empty, failed, retried, and background-refresh conversation states (SPEC.md § Agent Context; § Testing Strategy)
- [x] 7.2 GREEN: Expose initialization state and Retry from the standalone chat composable and prevent suggestion chips from flashing before resolution (SPEC.md § Frontend — `apps/web` → Agent chat; § Agent Context)
- [x] 7.3 RED: Write tests proving fresh conversations show no TTL chrome, near-expiry conversations show a polite rounded-minute warning, and successful activity clears it (SPEC.md § Agent Context)
- [x] 7.4 GREEN: Remove the persistent session-duration chip and implement actionable-only TTL warning behavior while preserving the server-provided expiry timestamp (SPEC.md § Agent Context)
- [x] 7.5 REFACTOR: Isolate remaining-duration derivation and timer cleanup as tested pure/composable logic, retaining `design/agent-chat.html` layout (SPEC.md § Agent Context)

## 8. Settings

- [x] 8.1 RED: Write responsive component/browser tests for Account, Study defaults, Notifications, long timezone values, validation text, action rows, and delete modal at 375px (SPEC.md § Frontend — `apps/web` → Settings; § Mobile & PWA)
- [x] 8.2 GREEN: Stack FieldRows and constrain controls/actions/modals on phones without changing the desktop layout from `design/settings.html` (SPEC.md § Frontend — `apps/web` → Settings; § Mobile & PWA)
- [x] 8.3 RED: Write tests for profile initial loading, populated success, failure/Retry, and content preservation during refetch (SPEC.md § Frontend — `apps/web` → Settings)
- [x] 8.4 GREEN: Gate Settings controls on explicit profile query states and add Retry without rendering blank fallback values (SPEC.md § Frontend — `apps/web` → Settings)
- [x] 8.5 RED: Write tests for timezone/password/defaults save progress, digest rollback, deletion progress, duplicate guards, and accessible outcomes (SPEC.md § Frontend — `apps/web` → Settings; § Account Deletion)
- [x] 8.6 GREEN: Migrate every Settings mutation to action-specific busy/success/failure feedback, preserving non-secret inputs and existing password security behavior (SPEC.md § Frontend — `apps/web` → Settings; § Account Deletion)
- [x] 8.7 REFACTOR: Consolidate Settings form-operation state without coupling independent tab mutations (SPEC.md § Frontend — `apps/web` → Settings)

## 9. Admin Operations

- [x] 9.1 RED: Write component tests for Approve/Reject operation identity, conflicting-action disablement, evidence preservation, failure recovery, and duplicate guards (SPEC.md § Frontend — `apps/web` → Admin; § Certification Setup & Grounding)
- [x] 9.2 GREEN: Implement "Approving…"/"Rejecting…" states in the review queue using `design/admin-review-queue.html`, keeping the non-initiating action visually distinct (SPEC.md § Frontend — `apps/web` → Admin; § Certification Setup & Grounding)
- [x] 9.3 RED: Write component tests for Re-verifying/Create draft busy states and consistent admin collection loading/error/Retry semantics using `design/admin-certifications.html` and `design/admin-cert-setup.html` reconciliation (SPEC.md § Certification Setup & Grounding; § Frontend — `apps/web` → Admin)
- [x] 9.4 GREEN: Migrate re-verification, draft creation, and remaining admin reads to the shared interaction/async contract while retaining the two imported admin artboards' hierarchy (SPEC.md § Certification Setup & Grounding; § Frontend — `apps/web` → Admin)
- [x] 9.5 REFACTOR: Remove duplicated admin spinner/error markup only after shared behavior is covered and existing admin copy remains intact (SPEC.md § Frontend — `apps/web` → Admin)

## 10. Acceptance Test — Outer Loop GREEN

- [x] 10.1 Run the complete new Playwright acceptance matrix and confirm every scenario in all nine delta specs passes end to end (SPEC.md § Testing Strategy → Layers and Tooling)
- [x] 10.2 Run the existing mocked functional-flow and design-fidelity Playwright suites; fix product regressions and update only assertions intentionally superseded by the reconciled contract (SPEC.md § Frontend — `apps/web`; § Testing Strategy)
- [x] 10.3 Verify the affected web app starts in the local environment with `yarn workspace @readion/web dev` and reaches a rendered authenticated route without startup/config errors (SPEC.md § Frontend — `apps/web`; § Testing Strategy)
- [x] 10.4 REFACTOR: Remove redundant test fixtures/selectors, stabilize async assertions, and confirm no acceptance behavior depends on arbitrary sleeps (SPEC.md § Testing Strategy → Tooling)

## 11. Change Review — Subagent Verification

- [x] 11.1 Dispatch a subagent to review the implemented diff and task list against `proposal.md`, every spec scenario, and `design.md`; provide no implementation reasoning, require findings-only grouped as CRITICAL/WARNING/SUGGESTION, and forbid edits (SPEC.md § Testing Strategy)
- [x] 11.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING with a one-line reason, note SUGGESTIONs, and re-run every affected test (SPEC.md § Testing Strategy)

## 12. Polish

- [x] 12.1 Run `yarn lint` and fix all errors (SPEC.md § Testing Strategy)
- [x] 12.2 Run `yarn format` and apply all required formatting (SPEC.md § Testing Strategy)
- [x] 12.3 Run the repository typecheck command with zero errors (SPEC.md § Tech Stack; § Testing Strategy)
- [x] 12.4 Run `yarn test:coverage` and confirm at least 80% lines, branches, and functions (SPEC.md § Testing Strategy → Coverage)

## 13. Documentation

- [x] 13.1 Update `DESIGN.md` interaction, async-state, accessibility, responsive, and light-mode token sections for frontend implementers so future controls inherit this durable contract instead of page-local conventions (SPEC.md § Frontend — `apps/web` → Layout Decisions)
- [x] 13.2 Update affected `openspec/design/parity/*.md`, JSON manifests, and parity index entries for UI reviewers to record intentional state/TTL/responsive divergences from the static Claude snapshots and keep automated assertions current (SPEC.md § Frontend — `apps/web`; § Testing Strategy)
