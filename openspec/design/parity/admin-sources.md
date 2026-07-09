# Parity — Sources

8 findings — 1 high · 4 medium · 3 low

- **[high] Running ingestion jobs banner** — simplified/composition
  - design: A live-progress banner with a spinning loader ring, the specific job name inline ("AWS documentation"), live percentage complete and ETA ("72% · ~4 min remaining"), rendered only while a job is in flight.
  - app: A static warning-colored text line reading 'Ingestion in progress for one or more sources.' with no spinner, no job name, no percentage, and no ETA, even though the underlying IngestionJobStatus data includes a `progress` field.
  - evidence: `openspec/design/admin-content.jsx:242-248 (SourcesScreen running-jobs banner) vs apps/web/app/components/admin/AdminSources.vue:233-239; progress field defined at packages/shared/src/content-pipeline/index.ts:88 but unused by the banner.`
- **[medium] Cancel running job action** — missing/behavioral
  - design: The running-jobs banner includes an inline 'Cancel' text button to stop the in-flight ingestion job.
  - app: No cancel-job affordance anywhere on the page; only a generic banner sentence with no actions.
  - evidence: `openspec/design/admin-content.jsx:247 (Cancel button) vs apps/web/app/components/admin/AdminSources.vue:233-239 (no cancel control, no job-cancel API call in script).`
- **[medium] Source identity column** — divergent/composition
  - design: Table's 'Source' column shows a human-readable label such as 'AWS documentation (web crawl)' or 'Official exam guide (PDF)'.
  - app: Table's Source column renders the raw registered URL (`source.url`) — there is no separate display name in the ContentSourceResponse model.
  - evidence: `openspec/design/admin-content.jsx:201-207,255 (s.name values) vs apps/web/app/components/admin/AdminSources.vue:268 (`{{ source.url }}`); packages/shared/src/content-pipeline/index.ts:60 has only `url`, no `name`.`
- **[medium] Status pill color coding** — simplified/composition
  - design: StatusPill gives each state (Active/Ingesting/Disabled/Error) its own tinted background and matching border color (e.g. violet bg+border for 'Ingesting…', red bg+border for 'Error') in addition to text color.
  - app: Status pill uses one uniform neutral pill background (`bg-readion-background-overlay`) for every state and only varies the text color via `sourceStatusTextClass`.
  - evidence: `openspec/design/admin-content.jsx:209-218 (StatusPill cfg with per-state bg/border) vs apps/web/app/components/admin/AdminSources.vue:293-301 and apps/web/app/composables/sourceStatus.ts:54-59 (text-color-only).`
- **[medium] Last ingested timestamp format** — divergent/behavioral
  - design: Relative, at-a-glance freshness text such as '2h ago', '3 days ago', or '—' when never ingested.
  - app: Absolute calendar date via Intl.DateTimeFormat (e.g. 'Jul 8, 2026'), and the literal word 'Never' instead of '—' when there's no timestamp.
  - evidence: `openspec/design/admin-content.jsx:202-206 (lastIngested values) vs apps/web/app/components/admin/AdminSources.vue:59-71 (lastIngestedFormatter, 'Never').`
- **[low] Type column badge** — simplified/composition
  - design: Type value ('PDF'/'Web'/'Video') is rendered as a small bordered badge with an elevated background, distinguishing it visually from plain text.
  - app: Type value is rendered as plain unstyled text in the cell.
  - evidence: `openspec/design/admin-content.jsx:256 (badge with border/background) vs apps/web/app/components/admin/AdminSources.vue:269 (`<td class="px-3 py-3 text-slate-300">{{ source.type }}</td>`).`
- **[low] Chunks column number formatting** — divergent/composition
  - design: Chunk counts are comma-grouped ('1,247', '12,441') and rendered in mono font, dimmed when the source is disabled.
  - app: Chunk count is rendered as the raw numeric value with no thousands separator and no enabled/disabled dimming.
  - evidence: `openspec/design/admin-content.jsx:202-206,259 vs apps/web/app/components/admin/AdminSources.vue:290-292 (`{{ source.chunkCount }}`).`
- **[low] Page header bar** — simplified/layout
  - design: A distinct bordered, elevated-background top bar (14px/28px padding) housing the 'Sources' title, separated from the scrollable content region below it.
  - app: The 'Sources' title is a plain inline `<h1>` inside the same flex column as the rest of the content, with no separate bordered header bar.
  - evidence: `openspec/design/admin-content.jsx:230-232 vs apps/web/app/components/admin/AdminSources.vue:142-144.`
