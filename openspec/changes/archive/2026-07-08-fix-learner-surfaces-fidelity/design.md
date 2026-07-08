## Context

The three learner "home" surfaces — dashboard (`pages/index.vue`), cert-detail (`pages/user-certifications/[id]/index.vue`), and progress (`pages/user-certifications/[id]/progress.vue`) — already load and render their data correctly against real API contracts (`readinessControllerRead`, `sessionsControllerList`, `sessionSummaryControllerSummary`, `userCertificationsControllerListWeakAreas`). A UI walkthrough against `openspec/design/*.html` (the UI source of truth) surfaced three classes of defect that are UI-only:

1. **Pluralization bugs on two independent code paths.** `apps/web/app/composables/certStatRow.ts:29` hardcodes `weeks` → "exam-ready in ~1 weeks"; `apps/web/app/pages/user-certifications/[id]/progress.vue:85` passes `unit="days"` → "CURRENT STREAK 1 days". A third path, `apps/web/app/composables/paceFormatter.ts:18`, already picks `week`/`weeks` correctly for a count of 1 — the correct rule exists but is not shared.
2. **QUESTIONS-0 accuracy.** The cert-detail Overview fourth stat renders a red `0%` accuracy beside `QUESTIONS 0` when no questions have been answered, fabricating a failing accuracy from absent data.
3. **Design-fidelity gaps** across all three surfaces (missing shared PageHeader, inverted hero hierarchy, weak areas as text lists instead of `DomainBadge` chips, wrong cert-detail stat set / narrow column / missing per-domain deltas, split readiness+accuracy cards with no 80% target, missing progress table header row and raw locale dates).

Existing components in play: `CertCard.vue`, `WeakAreasPanel.vue`, `RecentSessionsPanel.vue`, `QuickStartButtons.vue`, `DiagnosticRePromptNudge.vue`, `OverviewTab.vue`, `DomainScoreBar.vue`, `CertTabs.vue`, `ExamHistoryTab.vue`, `ReadinessTrend.vue`, `AccuracyBars.vue`, `ProgressDomainRow.vue`, `ProgressSessionHistoryTable.vue`, `ProgressStatCard.vue`. A shared `PageHeader` and `DomainBadge` do not exist yet and are introduced by this change.

## Goals / Non-Goals

**Goals:**
- Correct singular/plural for the `~N week(s)` trajectory phrase (cert-detail) and the `N day(s)` streak unit (progress), consolidating both on the singular-aware rule already in `paceFormatter.ts`.
- Suppress the cert-detail Avg-accuracy figure (no `0%`) when `questionsAnswered === 0`.
- Bring the three surfaces up to `openspec/design/*.html`: shared `PageHeader`, corrected dashboard hero hierarchy + `DomainBadge` weak-area chips + compact recent-sessions row + in-card actions + review-due row + accent-tinted banner; cert-detail full-width + header bar + Readiness/Sessions/Questions/Avg-accuracy stat set + per-domain deltas + rationale-bearing suggested focus + "Exam history" casing; progress one-surface readiness+accuracy card with an 80% target + friendly low-data states + session-history header row + friendly dates.

**Non-Goals:**
- Any backend change. Readiness, weak-area, streak, accuracy, and delta values continue to be computed exactly as today (client-side derivation from data already loaded); this change does not alter readiness/weak-area computation or add endpoints/fields.
- The other four UI changes in the walkthrough (auth/CSRF, mock-exam results, session-view lifecycle, review queue, admin, settings/agent/auth polish) — separate change proposals.
- New product behaviour beyond the design mockups (e.g. the dashboard "diagnostic banner" is a restyle of the existing `DiagnosticRePromptNudge`, not a new feature).

## Visual Design

Visual source of truth: the local design HTML at `openspec/design/*.html` (no DesignSync; these files are the authoritative mockups for this change).

| Artboard / screen | Maps to |
|---|---|
| `Dashboard.html` | `pages/index.vue` + `CertCard.vue`, `WeakAreasPanel.vue`, `RecentSessionsPanel.vue`, `QuickStartButtons.vue`, `AddCertificationModal.vue`, `DiagnosticRePromptNudge.vue`, and the new `PageHeader` / `DomainBadge` |
| `App Shell.html` | `AppSidebar.vue` chrome + the new shared `PageHeader` (eyebrow + h1 + "N active" indicator) reused across learner pages |
| `CertDetail.html` | `pages/user-certifications/[id]/index.vue` + `CertTabs.vue`, `OverviewTab.vue`, `DomainScoreBar.vue`, `ExamHistoryTab.vue`, and `composables/certStatRow.ts` (trajectory + accuracy) |
| `Progress.html` | `pages/user-certifications/[id]/progress.vue` + `ProgressStatCard.vue`, `ReadinessTrend.vue`, `AccuracyBars.vue`, `ProgressDomainRow.vue`, `ProgressSessionHistoryTable.vue` |

**Layout to implement:** one shared `PageHeader` component (eyebrow + h1 + right-aligned active-count indicator with a green dot), built once and reused by the dashboard and the other learner surfaces; one shared `DomainBadge` chip (status dot + label + %) reused by the dashboard weak-areas panel.

### Design ↔ contract reconciliation

| Design element | Conflict with contract | Resolution |
|---|---|---|
| Cert-detail "Avg accuracy" stat | Summaries can report `questionsAnswered === 0`, whose mean accuracy is a meaningless `0%` | Suppress the figure (neutral placeholder / em dash) when `questionsAnswered === 0`; render the real mean only when > 0 |
| Cert-detail stat strip = Readiness / Sessions / Questions / Avg accuracy | Prior spec listed Due reviews as the third stat | Adopt the design's four stats; Due reviews is surfaced on the dashboard review-due row, not the cert-detail strip |
| Per-domain delta ("↑7%") on domain rows | No per-domain delta field on the weak-areas DTO | Derive from the latest completed summary's `weakAreaDeltas`, shown only when a delta exists (same pattern as progress) |
| Suggested-focus rationale "Lowest domain score (45%). Last studied 2 days ago." | `nextFocus` is only `{ domain: string }`; no `lastStudied` field exists | Require the score-based reason (from the domain's weak-area `score`, always derivable); render "Last studied N days ago" only as a best-effort addition derived client-side from the newest session whose `focusArea` domains include the suggested domain, and omit it (never fabricate) when not derivable |
| Friendly dates ("Today, Jun 23") | Session DTO exposes only ISO `startedAt` | Format client-side from `startedAt`; no new field |

## Test Boundaries

The highest-value regression tests are the two pluralization cases and the QUESTIONS-0 accuracy suppression — they are asserted both at the acceptance (Playwright e2e) layer against seeded fixtures and at the unit layer against the pure formatter/composable, so a regression is caught cheaply.

| Dependency | In acceptance test (Playwright e2e) | In unit / component tests |
|---|---|---|
| API — `readinessControllerRead` (incl. `trajectory.weeksToReady`) | seeded fixture: one enrollment with `weeksToReady === 1` (singular case) and one calibrated | pure input to `formatCertStatRow`; no HTTP |
| API — `sessionsControllerList` (`startedAt`, `durationMinutes`, `kind`) | seeded fixture: single-day streak (one session started today) + a completed session for dates/streak | pure input to activity/streak + date composables |
| API — `sessionSummaryControllerSummary` (`questionsAnswered`, `accuracy`, `readiness.after`, `weakAreaDeltas`) | seeded fixture: a calibrated enrollment whose summaries report `questionsAnswered === 0` (accuracy-suppression case) | pure input to `formatCertStatRow` / trend / table composables |
| API — `userCertificationsControllerListWeakAreas`, `certificationsControllerDetail` | seeded real responses via the running API | pure inputs |
| Auth / login | real (drives login to reach the authenticated surfaces) | n/a |
| Backend readiness/weak-area/streak computation | real, unchanged (this change asserts rendering, not computed values) | n/a — non-goal |
| Rendering (DOM assertions: singular copy, no `0%`, PageHeader, table header row) | real DOM via Playwright | Vue Test Utils component render |

## Decisions

- **Consolidate week/day pluralization on the singular-aware helper.** Extract/expose the count→word rule already living in `paceFormatter.ts:18` as a reusable helper and have `certStatRow.ts` (weeks) and the progress streak unit (days) both consume it. Alternative — fix each call site's literal in place — rejected: it leaves two more copies of the same rule and the bug recurs the next time a third surface needs it.
- **Suppress accuracy when `questionsAnswered === 0`, in `formatCertStatRow`.** Fold the suppression into the existing accuracy-null branch so `accuracyLabel`/`accuracyColorClass` are `null` for zero questions regardless of the numeric accuracy input. Chosen over hiding it in the template so the "no data" rule is unit-testable in one pure place. `0%` is a real, valid accuracy only when at least one question was answered.
- **Introduce shared `PageHeader` and `DomainBadge` components.** The design reuses the same header and chip across surfaces; building them once (rather than per-page markup) matches `App Shell.html` and removes the bordered-text-list weak-area rendering. Alternative — inline per-page — rejected as it re-duplicates the pattern the design intends to share.
- **One readiness+accuracy surface card with an 80% target.** Compose `ReadinessTrend` (top) + divider + `AccuracyBars` (below) in a single card with a dashed 80% reference line, per `Progress.html`, replacing the two side-by-side cards. The 80% target is a static reference marker (the readiness target), not a new data series.
- **Client-side friendly dates and per-domain deltas, no backend field.** Dates format from `startedAt`; per-domain deltas come from the latest summary's `weakAreaDeltas`. Keeps the change UI-only and consistent with how the progress page already derives its columns.

## Risks / Trade-offs

- **Introducing `PageHeader`/`DomainBadge` touches shared surface area** → keep them minimal and prop-driven; cover with component tests and reuse in place of the removed bespoke markup so behaviour is unchanged apart from layout.
- **Friendly relative dates ("Today", "Yesterday") depend on the viewer's timezone/clock** → derive from the same timestamp the row already uses and pin the clock/timezone in tests to avoid flakiness; fall back to an absolute "Mon D" form beyond the relative window.
- **Combining the two progress cards into one may reflow low-data states** → the low-data empty states are specified explicitly (friendly not-yet-calibrated / insufficient-data), so the combined card degrades gracefully rather than showing slider-looking flat lines.
- **Restyling `DiagnosticRePromptNudge` into an accent callout** → this is a visual restyle only; the nudge's existing trigger/dismiss logic is unchanged.

## Open Questions

- Exact relative-date window for the progress table — "Today, Jun 23" implies same-day gets a "Today" prefix; confirm the cutoff (Today / Yesterday / weekday / "Mon D") against `Progress.html` during implementation.
- Whether `PageHeader` should also be adopted by the cert-detail and progress pages in this change or only the dashboard — the design shows the shared header on the shell; scoped here to the dashboard header plus the cert-detail cert-header bar, with the reusable component available to the others.
