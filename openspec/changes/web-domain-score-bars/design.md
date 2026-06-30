# Design — web-domain-score-bars

## Context

The artboards render per-domain scores as colored horizontal progress bars on a status-colour scale (red→amber→green) with the score percentage and a trend delta:

- `openspec/design/Progress.html` — `DomainRow` (lines ~181–212): label, a `height: 4` track with a fill of `width: score + '%'` and `background: scoreColor(score)`, the `score%` figure, and an optional signed delta (`↑/↓{|delta|}%`).
- `openspec/design/CertDetail.html` — "Domain scores" block (lines ~148–174): label, a `height: 3` track fill of `width: d.score + '%'` and `background: scoreColor(d.score)`, the `score%`, and a delta.

The shipped implementation renders both as **text-only** rows (label + `score%`), so the two surfaces visually diverge from the design and duplicate the same concept. This change introduces one shared bar component and adopts it in both places. Frontend-only; no API change, no codegen.

## Current code being replaced

- **Progress** — `apps/web/app/components/ProgressDomainRow.vue` renders the score as a coloured `<span>{{ score }}%</span>` plus a `DeltaBadge` and the "Mark mastered" control. The score row must become the shared bar; the mastery button and delta affordance stay on this row.
- **CertDetail** — `apps/web/app/components/OverviewTab.vue` renders the "Domain Breakdown" `CardPanel` with inline `data-testid="domain-score-row"` rows (label + coloured `domain-score` span). These inline rows must become the shared bar.

Both consume the same join helpers: `apps/web/app/composables/domainScores.ts` (`joinDomainScores` → `DomainScoreRow { domain, score, status, hasData }`) and, on Progress, `apps/web/app/composables/useDomainScores.ts` (`useDomainScores` → adds `delta`).

## New shared component

- **Name / location**: `apps/web/app/components/DomainScoreBar.vue`.
- **Props**: `domain: string`, `score: number | null`, `status: StatusColorKey | null`, `hasData: boolean`, `delta?: number | null` (optional).
- **Rendering**: a track with a fill of `width: ${score}%` and class `bg-readion-status-${status}`; the `score%` figure; the optional signed delta (reuse `DeltaBadge.vue`, which already renders `↑/↓{|value|}%` in good/poor); an ARIA label conveying domain + score. When `hasData` is false, render the neutral "no data yet" state (no fill, no percentage, no delta, no status colour).
- **Reference**: `apps/web/app/components/admin/CertSetupCoverageBar.vue` already implements this exact bar idiom (`bg-readion-status-${statusColorForScore(...)}` fill with a `width` style on a rounded track) and is the pattern to follow.

## Band thresholds — single source

`apps/web/app/composables/statusColor.ts` `statusColorForScore` is the single source of the band scale and already matches the archived web-cert-detail spec exactly: `<50` poor, `<65` warning (i.e. 50–65), `<=80` medium (i.e. 65–80), `>80` good. The component MUST NOT re-declare thresholds; it consumes `status` from the existing join helpers (which call `statusColorForScore`).

Note: the design bundle's reference helper `openspec/design/app-shell.jsx` `scoreColor` uses a medium/good split at 75 rather than 80. This is a design-artboard reference only; the shipped, spec-aligned threshold is 80 (per `statusColor.ts` and the archived web-cert-detail spec), and that is authoritative. No threshold change is in scope.

## Trend / delta data availability

The base per-domain **score is available** (`WeakAreaResponseDto.score`, `apps/web/src/api/model/weakAreaResponseDto.ts`) — no blocker.

The trend delta is **not a field on the weak-area record**. It is derived client-side from the latest completed session summary's `weakAreaDeltas` (`WeakAreaDeltaDto { domain, delta }`, `apps/web/src/api/model/weakAreaDeltaDto.ts`), joined in `useDomainScores`. It exists only for domains present in that latest summary, so it is per-row optional. Accordingly the component's `delta` prop is **optional** and the trend element is omitted when absent. CertDetail's `OverviewTab` does not currently compute a delta, so it adopts the bar without passing one. No backend change is added to make trend universally available.

## Test surfaces

- New `apps/web/app/components/DomainScoreBar.spec.ts`: width from value, status colour by band, signed delta rendered/omitted, a11y label, "no data yet" state.
- Update Progress and CertDetail domain-list specs to assert the shared bar markup.
- Playwright e2e: Progress and CertDetail render domain rows as coloured bars (width ∝ score, status colour, optional trend), not plain text.
