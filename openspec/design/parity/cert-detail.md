# Parity — Cert detail

1 active findings — 1 high · 0 medium · 0 low

## Reconciliation — ui-interaction-state-parity

This report keeps 10 snapshot observations as evidence. Counts and the parity index include only the 1 entries still marked `open`; `resolved` and `superseded` entries below are historical.

- Static Claude frames remain the visual hierarchy reference. Live loading/content/empty/error+Retry/background-refresh states, operation-specific busy labels and duplicate guards, semantic dark/light modes, accessibility/focus behavior, and tested 375px containment are intentional product contracts even when no static frame depicts them.
- Busy identity belongs only to the initiating action; adjacent disabled actions do not display its spinner or progressive label. Dimensions remain stable and reduced-motion preferences are honored.
- Resolved snapshot findings: “Recent session delta badge”; “Right-column layout (Suggested next + Recent sessions stacked)”; “Stat card individual borders”; “Sessions/Questions/Avg accuracy sub-captions”; “View all sessions link”; “Recent session row content”; “Divider lines between rows”; “Domain scores section label wording”; “'View progress' link”.

- **[high] Readiness stat sub-label** — divergent/behavioral
  - design: Readiness card shows a week-over-week trend, e.g. '↑3% this week' (a delta on the same metric).
  - app: Readiness card's sub-label is `trajectoryLabel`, an entirely different metric: 'exam-ready in ~N weeks' (a projected time-to-ready estimate), shown only when a trajectory exists.
  - evidence: `design: openspec/design/CertDetail.html:140 (sub: '↑3% this week'); app: apps/web/app/components/OverviewTab.vue:73-79 + apps/web/app/composables/certStatRow.ts:34-36 (trajectoryLabel = `exam-ready in ~${weeksToReady} weeks`)`
- **[high · resolved] Recent session delta badge** — missing/composition
  - design: Every recent-session row shows a green delta pill (e.g. '+3%', '+2%', '+8%') next to the accuracy percentage.
  - app: RecentSessionsPanel only renders a DeltaBadge for index 0, gated on a `readinessDelta` prop — but OverviewTab never passes that prop when instantiating the panel, so `deltaFor` always resolves to null and no delta badge is ever rendered for any row.
  - evidence: `design: openspec/design/CertDetail.html:196-213 (delta on every row); app: apps/web/app/components/OverviewTab.vue:137 (`<RecentSessionsPanel :sessions="sessions" />`, no readiness-delta binding) vs apps/web/app/components/RecentSessionsPanel.vue:7,15-16,39`
- **[medium · resolved] Right-column layout (Suggested next + Recent sessions stacked)** — divergent/layout
  - design: A fixed 260px right column stacks 'Suggested next' above 'Recent sessions', beside the wider Domain scores column.
  - app: Grid is only 2 columns (`md:grid-cols-[2fr_1fr]`) holding Domain Breakdown and Suggested-next; RecentSessionsPanel is placed as a separate full-width block below that grid, not stacked in the right column.
  - evidence: `design: openspec/design/CertDetail.html:153,183-219 (width:260 column contains both blocks); app: apps/web/app/components/OverviewTab.vue:95-137 (grid ends at line 135, RecentSessionsPanel at line 137 is a sibling below, full width)`
- **[medium · resolved] Stat card individual borders** — simplified/layout
  - design: Each of the 4 stats (Readiness, Sessions, Questions, Avg accuracy) is its own bordered/rounded card (`border: 1px solid`, `borderRadius: rXl`, own background) sitting in a gapped row.
  - app: All 4 stats share a single undifferentiated container (`bg-black/25 p-4` grid) with no per-card border or background — the individual card affordance is lost.
  - evidence: `design: openspec/design/CertDetail.html:138-151; app: apps/web/app/components/OverviewTab.vue:66-93 (single `data-testid="cert-detail-stat-row"` div, no per-card border)`
- **[medium · resolved] Sessions/Questions/Avg accuracy sub-captions** — missing/composition
  - design: Each stat card has a small caption under the value: Sessions → 'completed', Questions → 'answered', Avg accuracy → 'per session'.
  - app: ProgressStatCard only renders label + value (+ optional unit); no sub-caption slot is used for Sessions, Questions, or Avg accuracy in OverviewTab.
  - evidence: `design: openspec/design/CertDetail.html:141-148 (`sub` field per stat); app: apps/web/app/components/ProgressStatCard.vue:11-19 (no sub-caption row) and apps/web/app/components/OverviewTab.vue:81-92 (no sub text passed)`
- **[medium · resolved] View all sessions link** — missing/composition
  - design: Below the Recent sessions card, a right-aligned 'View all sessions →' link is shown, linking presumably to the Sessions tab.
  - app: No such link/affordance exists in RecentSessionsPanel or OverviewTab; the only way to reach the Sessions tab is the top-level tab bar.
  - evidence: `design: openspec/design/CertDetail.html:215-217; app: apps/web/app/components/RecentSessionsPanel.vue:19-45 (ends with the card, no link)`
- **[medium · resolved] Recent session row content** — divergent/composition
  - design: Row shows only date, duration (+ ' · Mock' suffix when applicable), accuracy% (color-coded by score band), and delta.
  - app: Row shows date, duration, then a combined 'Kind · focus-area/domains' label (e.g. 'Study · IAM, Networking') in place of design's simple duration/mock-tag line, and accuracy is plain uncolored text (no score-band coloring).
  - evidence: `design: openspec/design/CertDetail.html:196-213; app: apps/web/app/components/RecentSessionsPanel.vue:29-38 + apps/web/app/composables/recentSessionLabel.ts:24-25 (`${kind} · ${focusArea}`), no color class on accuracy span`
- **[low · resolved] Divider lines between rows** — simplified/composition
  - design: Both Domain scores and Recent sessions cards have a 1px divider between each row (`i < len-1 && <div border/>`).
  - app: DomainScoreBar rows use `mb-2` spacing only, and RecentSessionsPanel rows use `mb-2`/`last:mb-0` spacing — no divider element between rows in either list.
  - evidence: `design: openspec/design/CertDetail.html:176,211; app: apps/web/app/components/OverviewTab.vue:97-102 (mb-2, no divider) and apps/web/app/components/RecentSessionsPanel.vue:26 (mb-2, no divider)`
- **[low · resolved] Domain scores section label wording** — simplified/composition
  - design: Section label reads 'Domain scores'.
  - app: CardPanel label reads 'Domain Breakdown'.
  - evidence: `design: openspec/design/CertDetail.html:156; app: apps/web/app/components/OverviewTab.vue:96 (`label="Domain Breakdown"`)`
- **[low · resolved] 'View progress' link** — divergent/layout
  - design: No such link exists between the header and the tab bar; the design's header/tabs are adjacent with no intervening row.
  - app: An extra right-aligned 'View progress' NuxtLink row is inserted between CertHeaderBar and the tab bar, not present in the design.
  - evidence: `design: openspec/design/CertDetail.html:98-119,89-95 (CertHeader directly followed by CertTabs); app: apps/web/app/pages/user-certifications/[id]/index.vue:76-84 (extra `view-progress-link` block before the tablist)`
