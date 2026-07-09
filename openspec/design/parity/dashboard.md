# Parity — Dashboard

9 findings — 2 high · 3 medium · 4 low

- **[high] Readiness progress bar (ReadinessBar)** — missing/composition
  - design: Under the readiness percentage on every CertCard (hero and standard), a 3px rounded progress track fills to the readiness percentage — white-tinted on the hero gradient card, status-colored on standard cards (Dashboard.html lines 102-112, 202).
  - app: CardReadiness.vue renders only the percentage number and an optional delta line ('X% since last session') — no progress bar/track element exists anywhere in the component.
  - evidence: `design: openspec/design/Dashboard.html:102-112,202 — app: apps/web/app/components/CardReadiness.vue:7-23`
- **[high] Dashboard content width/alignment** — divergent/layout
  - design: Main content area is `flex: 1` beside the sidebar with `padding: 32px 40px`, using the full available width (no max-width cap) — cards stretch the width of the content pane (Dashboard.html lines 283-297).
  - app: The dashboard page wraps everything in `mx-auto max-w-[720px]`, centering a narrow fixed-width column inside the content area instead of letting cards use the full available width.
  - evidence: `design: openspec/design/Dashboard.html:283-287 — app: apps/web/app/pages/index.vue:22`
- **[medium] Certification code pill (e.g. SAA-C03)** — missing/composition
  - design: Next to the vendor name, a small monospace pill shows the cert code (e.g. 'SAA-C03', 'PCA') on an elevated background (Dashboard.html lines 194-196).
  - app: CertCard.vue title block only renders card.name and card.provider; EnrollmentCard has no code/id field surfaced, so no code badge is rendered.
  - evidence: `design: openspec/design/Dashboard.html:194-196 — app: apps/web/app/components/CertCard.vue:61-63; apps/web/app/composables/useEnrollments.ts:7-15`
- **[medium] Card internal section structure (weak areas / recent sessions / review row)** — divergent/layout
  - design: Sections stack full-width, separated by 1px hairline dividers, directly on the card's own background — no boxed containers (Dashboard.html lines 206-229).
  - app: WeakAreasPanel and RecentSessionsPanel are placed side-by-side in a 2-column grid, each wrapped in a CardPanel with its own dark 'bg-black/25' rounded box — no hairline dividers, boxed-panel look instead of flat stacked sections.
  - evidence: `design: openspec/design/Dashboard.html:206-229 — app: apps/web/app/components/CertCard.vue:66-69; apps/web/app/components/CardPanel.vue:5-10`
- **[medium] Recent sessions row layout (SessionRow)** — divergent/composition
  - design: Sessions are laid out as equal-width columns side by side with vertical divider rules between them, each showing 'when' / 'duration' / delta stacked vertically within its column (Dashboard.html lines 132-151).
  - app: RecentSessionsPanel renders sessions as a vertical list of rows (one per line), each row showing date+duration on the left and accuracy%/delta badge on the right — a stacked-list layout, not the multi-column split from the design.
  - evidence: `design: openspec/design/Dashboard.html:132-151 — app: apps/web/app/components/RecentSessionsPanel.vue:20-44`
- **[low] '5-min review' button icon** — missing/composition
  - design: The review pill button includes a small triangle/play SVG icon before the label text (Dashboard.html lines 238-243).
  - app: ReviewQuickStart.vue's button renders only the text '5-minute review', no icon.
  - evidence: `design: openspec/design/Dashboard.html:238-243 — app: apps/web/app/components/ReviewQuickStart.vue:25-33`
- **[low] Reviews-due row visibility when count is zero** — divergent/behavioral
  - design: The review count + '5-min review' button are always rendered as part of the card's fixed section structure (bound directly to `cert.dueReviews`), regardless of value (Dashboard.html lines 232-244).
  - app: CertCard.vue only renders ReviewQuickStart when `dueCount > 0`; otherwise it renders an empty `<span/>`, removing the whole row from layout.
  - evidence: `design: openspec/design/Dashboard.html:232-244 — app: apps/web/app/components/CertCard.vue:71-77`
- **[low] Button label wording/casing** — divergent/composition
  - design: Buttons read 'Mock exam' and '5-min review' (sentence case).
  - app: Buttons read 'Mock Exam' and '5-minute review' (title case, expanded wording).
  - evidence: `design: openspec/design/Dashboard.html:242,246 — app: apps/web/app/components/QuickStartButtons.vue:34; apps/web/app/components/ReviewQuickStart.vue:32`
- **[low] Diagnostic re-prompt nudge banner** — divergent/behavioral
  - design: The two-certs artboard state has no per-card nudge/callout; only the separate 'day-one-empty' state shows a welcome callout above the card list (Dashboard.html lines 372-462 vs 274-309).
  - app: index.vue renders a DiagnosticRePromptNudge above every card unconditionally in markup (its own internal query can show/hide it), introducing an element not modeled in the two-certs design state.
  - evidence: `design: openspec/design/Dashboard.html:274-309 — app: apps/web/app/pages/index.vue:51-55`
