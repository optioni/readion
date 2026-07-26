# Parity — Progress

3 active findings — 1 high · 1 medium · 1 low

## Reconciliation — ui-interaction-state-parity

This report keeps 11 snapshot observations as evidence. Counts and the parity index include only the 3 entries still marked `open`; `resolved` and `superseded` entries below are historical.

- Static Claude frames remain the visual hierarchy reference. Live loading/content/empty/error+Retry/background-refresh states, operation-specific busy labels and duplicate guards, semantic dark/light modes, accessibility/focus behavior, and tested 375px containment are intentional product contracts even when no static frame depicts them.
- Busy identity belongs only to the initiating action; adjacent disabled actions do not display its spinner or progressive label. Dimensions remain stable and reduced-motion preferences are honored.
- Resolved snapshot findings: “TrajectoryCallout placement”; “Readiness chart X-axis date labels”; “Readiness chart area fill and projection line”; “'This month' section label and per-stat cards”; “Section header counters ('N sessions', 'Last N sessions', 'N sessions total')”; “Accuracy bar per-bar percentage label”; “Accuracy bar per-session short label”.
- Superseded by product contract: “Content column width/layout”.

- **[high · resolved] TrajectoryCallout placement** — divergent/layout
  - design: TrajectoryCallout/TrajectoryInsufficient sits at the bottom of the 'Readiness over time' section, directly below the readiness chart + accuracy bars card, as a conclusion drawn from the visible trend.
  - app: TrajectoryCallout is rendered immediately after CertTabs, before the 'This month' usage stats grid and before the readiness chart is shown at all — first thing on the page.
  - evidence: `openspec/design/Progress.html:347-366 (ProgressPage: UsageStats → readiness card → TrajectoryCallout) vs apps/web/app/pages/user-certifications/[id]/progress.vue:70-95 (TrajectoryCallout at line 74, before the stats grid at line 76 and ReadinessAccuracyCard at line 90)`
- **[high] Domain 'Mastered' state (grouping, persistence, Unretire)** — simplified/behavioral
  - design: Mastered domains move under a divider labeled 'Mastered', render with strikethrough name, dimmed/greyed score bar, a 'Mastered' pill badge, and an 'Unretire' button to reverse the state; state persists across sessions.
  - app: ProgressDomainRow tracks a local ref `mastered` that toggles the button to plain text 'Mastered' in place — no divider/section move, no strikethrough, no dimmed bar, no pill badge, and no 'Unretire' affordance. State is not re-derived from fetched data (useDomainScores has no mastered/suppressed flag), so it resets on reload.
  - evidence: `openspec/design/Progress.html:188-238 (DomainRow mastered branch), 376-387 (mastered section divider) vs apps/web/app/components/ProgressDomainRow.vue:19,46-55 and apps/web/app/composables/useDomainScores.ts:13-31 (no mastered flag)`
- **[medium · resolved] Readiness chart X-axis date labels** — missing/composition
  - design: ReadinessChart shows first/middle/last session date labels along the X axis (e.g. 'Jun 2', 'Jun 21', 'Today').
  - app: ReadinessTrend renders only Y-axis grid tick labels (25/50/75/100) and the target label; no X-axis date labels are rendered anywhere.
  - evidence: `openspec/design/Progress.html:120-121,157-162 (labelIdxs / X labels) vs apps/web/app/components/ReadinessTrend.vue:39-45,118-127 (only Y tickLabels, no X labels)`
- **[medium · resolved] Readiness chart area fill and projection line** — missing/composition
  - design: Chart fills the area under the line (rgba(124,140,248,0.07)) and, when trajectory data exists, draws a dashed projection line from the last point toward the 80% target.
  - app: ReadinessTrend draws only the grid, target line, polyline, and points — no area fill path and no projection segment, even when the trajectory/pace callout is shown.
  - evidence: `openspec/design/Progress.html:109-111,137-142 (areaPath, showProjection path) vs apps/web/app/components/ReadinessTrend.vue:66-116 (svg content: grid, target line, polyline, circles only)`
- **[medium · resolved] 'This month' section label and per-stat cards** — simplified/composition
  - design: UsageStats renders under an uppercase 'This month' SectionLabel, with each stat (Sessions, Questions answered, Study time, Current streak) in its own bordered surface card.
  - app: The stats grid has no 'This month' heading at all, and all four ProgressStatCard items share a single bg-black/25 container instead of individual bordered cards.
  - evidence: `openspec/design/Progress.html:312-327 (UsageStats with SectionLabel + per-card surface/border) vs apps/web/app/pages/user-certifications/[id]/progress.vue:76-88 (no heading, shared container, ProgressStatCard.vue:12 has no border/card wrapper)`
- **[medium · resolved] Section header counters ('N sessions', 'Last N sessions', 'N sessions total')** — missing/composition
  - design: Section headers for readiness, accuracy, and session history each show a live count (e.g. '10 sessions', 'Last 6 sessions', '7 sessions total') next to the section label.
  - app: ReadinessTrend shows a static 'Readiness Trend' label, AccuracyBars shows a static 'Accuracy per Session' label, and ProgressSessionHistoryTable shows a static 'Session History' label — none display a session count.
  - evidence: `openspec/design/Progress.html:349-351,356-359,395-397 vs apps/web/app/components/ReadinessTrend.vue:53, AccuracyBars.vue:14, ProgressSessionHistoryTable.vue:28`
- **[medium] Session history row time-of-day** — missing/composition
  - design: Each history row shows date on one line and the session's start time (e.g. '3:42 PM') as a secondary line beneath it.
  - app: Row only renders `friendlyDate(row.startedAt)` (e.g. 'Today, Jun 23') with no time-of-day sub-line.
  - evidence: `openspec/design/Progress.html:271-275 (s.date / s.time) vs apps/web/app/components/ProgressSessionHistoryTable.vue:55-57`
- **[low · resolved] Accuracy bar per-bar percentage label** — divergent/composition
  - design: Only the most recent (last) bar shows its accuracy percentage above it; earlier bars show no numeric label.
  - app: Every bar shows its percentage number above it, just with different text color/weight for the last one.
  - evidence: `openspec/design/Progress.html:249-250 ({isLast && <span>...}) vs apps/web/app/components/AccuracyBars.vue:25-30 (label rendered for every point)`
- **[low · resolved] Accuracy bar per-session short label** — missing/composition
  - design: Each accuracy bar has a short date label beneath it (e.g. 'J16', 'J17', 'Today').
  - app: AccuracyBars renders no label beneath each bar at all.
  - evidence: `openspec/design/Progress.html:252 (s.shortLabel) vs apps/web/app/components/AccuracyBars.vue:17-37 (no per-bar caption)`
- **[low · superseded] Content column width/layout** — divergent/layout
  - design: ProgressPage content pane is a flexible full-width region next to the sidebar (flex:1, padding 28px 36px, no max-width cap) sized to hold a 740px-wide chart and full-bleed cards/tables.
  - app: Page content is wrapped in a centered `mx-auto max-w-[720px]` column inside the shared `<main>`, constraining width regardless of viewport.
  - evidence: `openspec/design/Progress.html:330-333 (flex:1, no maxWidth) vs apps/web/app/pages/user-certifications/[id]/progress.vue:41 (class="mx-auto max-w-[720px]")`
- **[low] Section label wording** — divergent/composition
  - design: Section labels read 'Readiness over time' and 'Domain scores'.
  - app: Equivalent labels read 'Readiness Trend' (inline, inside the card) and 'Domain Breakdown' (CardPanel label), with different casing/wording and no separate section-level heading outside the card for the readiness chart.
  - evidence: `openspec/design/Progress.html:350,371 vs apps/web/app/components/ReadinessTrend.vue:53 and apps/web/app/pages/user-certifications/[id]/progress.vue:97 (label="Domain Breakdown")`
