## Context

The CertDetail Overview "Recent sessions" panel renders every row as the literal `[object Object]` with a `0%` score. This is a frontend rendering bug on an already-shipped page; the backend contract is unchanged and exposes everything the row needs. The artboard `openspec/design/CertDetail.html` (Overview, "Recent sessions") shows each row as a type/date + score pair, e.g. a dated label on the left and a coloured accuracy on the right, with mock rows tagged. For study/review sessions the row reduces to a session-type + date label plus accuracy.

## Where the list is rendered

- Panel component: `apps/web/app/components/RecentSessionsPanel.vue` — iterates `RecentSessionEntry[]` and renders `rowLabel(session)` plus `accuracyPercent(session.accuracy)`.
- Data composable (cert-detail Overview): `apps/web/app/composables/useOverviewSessions.ts` — builds each `RecentSessionEntry`.
- Mounted by: `apps/web/app/components/OverviewTab.vue` via `<RecentSessionsPanel :sessions="sessions" />`, where `sessions` comes from `useOverviewSessions`.
- Shared entry shape + the dashboard sibling composable: `apps/web/app/composables/useCardRecentSessions.ts` (defines `RecentSessionEntry` and contains the identical mapping bug).
- Summary join helper: `apps/web/app/composables/recentSessionSummaries.ts` — fetches `GET /sessions/:id/summary` for completed rows and returns a `Map<id, SessionSummaryResponseDto>`.

## The actual session read-model

From the API DTO `apps/api/src/sessions/sessions.controller.ts` (`SessionResponseDto`) and the shared types in `packages/shared/src/sessions/index.ts`, a session row carries:

- `kind: SessionKind` — `'study' | 'review'` (the session type).
- `status: SessionStatus` — `'active' | 'completed' | 'partial' | 'abandoned'`.
- `startedAt: string` — ISO timestamp (the date).
- `focusArea: SessionFocusArea` — a Zod discriminated union: `{ mode: 'auto' }` or `{ mode: 'domains', domains: string[] }`. **This is an object, not a string.**

Per-session accuracy is not on the session row; it comes from the joined summary `SessionSummaryResponseDto.accuracy` (a 0–1 fraction) via `recentSessionSummaries.ts`.

Note on the Orval client: `apps/web/src/api/model/sessionResponseDtoFocusArea.ts`, `sessionResponseDtoKind.ts`, and `sessionResponseDtoStatus.ts` are all generated as `{ [key: string]: unknown }` because the backend `@ApiProperty()` decorators don't declare the enum/shape. So the generated types give no compile-time help here; `kind`/`status` are real strings at runtime, while `focusArea` is genuinely an object.

## How the `[object Object]` bug arises

In `useOverviewSessions.ts` (and identically in `useCardRecentSessions.ts`):

```ts
label: String(session.focusArea),
```

`session.focusArea` is the discriminated-union object, so `String({ mode: 'auto' })` evaluates to `"[object Object]"`. `RecentSessionsPanel.vue` then renders that string for every row. The `0%`/missing-score symptom is the separate accuracy path: rows without an available summary carry `accuracy: null` and render no figure, and any place that coerced a missing accuracy to `0` would surface a misleading `0%` — the fix must keep accuracy sourced from the real `summary.accuracy`.

## Fix approach (frontend-only)

1. Replace `label: String(session.focusArea)` with a real label built from typed fields — the session `kind` (study/review) and a formatted `startedAt` date — and, when useful, the domain text derived from `focusArea` (`mode: 'auto'` → an "All domains"-style label; `mode: 'domains'` → the joined `domains` list). Never pass the raw `focusArea` object through `String(...)`.
2. Keep accuracy sourced from the joined `summary.accuracy`; rows without a summary render no accuracy figure (no `0%` fallback). This matches the artboard, where each row pairs a dated/typed label with its real accuracy.
3. Extract a small shared formatter so `useOverviewSessions.ts` and `useCardRecentSessions.ts` produce the same `RecentSessionEntry.label`, removing the duplicated buggy mapping.
4. Cover with a `RecentSessionsPanel.vue` / `OverviewTab.vue` vitest that asserts a real label and forbids `[object Object]`, plus the existing cert-detail e2e (`apps/web/e2e/cert-detail.e2e.ts`).

## Decisions

- No backend change and no `yarn codegen`: `kind`, `startedAt`, and the joined `summary.accuracy` already supply type, date, and score. The only defect is client-side stringification of a structured field.
- Mock/diagnostic attempts (the artboard's "Mock" tag) belong to Exam History, not the Overview recent-sessions list, which is study/review sessions only; this change does not pull mock attempts into the panel.
