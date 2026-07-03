## Context

Phase-11's `quarantine-review-queue` shipped a working admin Review queue in `apps/web/app/components/admin/AdminReviewQueue.vue`: it lists `GET /api/v1/admin/quarantine` via `useAdminQuarantine`, shows each item's domain/reason and a **raw** `verdict` string plus provenance chunk ids, and offers audit-logged **Approve** / **Reject** wired to `quarantineAdminControllerApprove` / `quarantineAdminControllerReject`. The current UI is a stacked list of cards that leaks the raw verdict and renders no question/options (observed 2026-06-30).

The design (`openspec/design/AdminContentUsers.html`, `ContentQualityScreen`) is a **two-pane master-detail reviewer**: a scrollable item list on the left (`QueueList`, ~320px, item identity + cert + verdict badge) and, for the selected item, a detail panel on the right that leads with a **human-formatted verdict** (pass/fail label + reasoning) and renders the **question as stored** with its **options and answer key** marked. The resolve actions sit in the detail pane, in context.

This is a **frontend fidelity delta** (per `openspec/IMPLEMENTATION-ORDER.md` line 361) — not a new SPEC.md/PRD.md requirement. It changes no backend contract. The detail pane consumes the read-only `GET /api/v1/admin/quarantine/:id` endpoint that the just-archived `admin-quarantine-item-detail` change added; its typed contract (`QuarantinedItemDetail` + `QuarantinedItemDetailContent`) lives in `@readion/shared` (`packages/shared/src/admin/index.ts`) and the Orval operation `quarantineAdminControllerDetail` is already generated under `apps/web/src/api/quarantine-admin/`. The list still uses `GET /admin/quarantine`; approve/reject endpoints are unchanged. No new API endpoint, entity, or migration here.

Work is confined to `apps/web/app/components/admin/` (+ a composable and a pure formatter), with vitest component/unit tests and a Playwright e2e assertion (`apps/web/e2e/admin.e2e.ts`).

## Goals / Non-Goals

**Goals:**
- Convert the Review queue to a two-pane **master-detail** layout: item list (left) + detail panel (right) for the selected item, per `AdminContentUsers.html`.
- On selection, load the item's detail via `quarantineAdminControllerDetail` (`GET /api/v1/admin/quarantine/:id`) and render its **question, options, and answer key** (`detail.content`), with the answer-key option visibly marked.
- Replace the raw verdict string with a **human-formatted verdict** (pass/fail label + score % + reason) via a pure, unit-tested formatter.
- Keep **Approve** / **Reject** in the detail pane, wired to the existing audit-logged endpoints; reflect resolution and remove the resolved item from the pending list.
- Handle empty (no selection), loading, and detail-error / `content: null` states gracefully.

**Non-Goals:**
- No backend change: no new endpoint, no contract change to list/approve/reject, no codegen (the detail operation already exists).
- No new entity or migration.
- No editing of quarantined content — resolution stays **Approve / Reject** (the artboard's "Edit key → C" / "Discard" is a deliberately preserved divergence, per IMPLEMENTATION-ORDER.md line 366).
- No pagination/filter redesign beyond what `quarantine-review-queue` already ships (the existing list query is reused as-is).

## Decisions

### Two-pane master-detail layout

`AdminReviewQueue.vue` becomes the container holding a left list pane and a right detail pane, replacing the current single `<ul>` of full cards. The list is extracted to a presentational **`AdminReviewQueueList`** (renders `items`, highlights the selected id, emits `select`) and the detail to **`AdminReviewQueueDetail`** (takes the selected id, fetches + renders the item). The container owns `selectedId` (a `ref<string | null>`) and the shared resolve handler. This mirrors the artboard's `QueueList` + detail column split and keeps each pane independently testable (tasks 2.3).

Selection defaults to none; the detail pane renders an **empty state** ("Select an item to review") until a list row is chosen. The list reuses the existing `useAdminQuarantine` query (no change to the list request).

### Detail fetch on selection

A new composable **`useAdminQuarantineDetail(id: Ref<string | null>)`** wraps `quarantineAdminControllerDetail` in a TanStack `useQuery`, keyed under the existing `adminQueryKeys.quarantine()` namespace (e.g. `adminQueryKeys.quarantineDetail(id)`), enabled only when an id is selected. The detail pane consumes it and renders loading / error / loaded states. This keeps the list lean (list request unchanged) and fetches the heavier `content` payload only for the item under review — matching the deliberate list/detail split `admin-quarantine-item-detail` established.

### Formatted verdict (pure formatter)

A pure helper **`formatVerdict`** (e.g. `apps/web/app/utils/formatVerdict.ts`) maps the verdict signal to a human label + tone. The source fields come from the typed contract: `provenance.verdict` is a `VerifierVerdict` (`{ pass: boolean, score: number, distractorFindings }`) and `reason` is the item's stored reason string. The formatter produces `{ label: 'Passed' | 'Failed', tone: 'good' | 'poor', scorePercent: string, reason: string }` — e.g. `{ pass: false, score: 0.2 }` + reason → **"Failed · 20% · <reason>"** — so no raw JSON reaches the DOM. Verdict labels/colours live in a single source (task 1.3) shared by the list badge and the detail header, echoing the artboard's `VerdictBadge` tone scale (good/poor/warn).

### Rendering question / options / answer key

The detail pane renders `detail.content` (`QuarantinedItemDetailContent`: `question`, `options[]`, `answerKey`, `format`, `supportingSpans`, `sourceChunkIds`). It shows the question stem, then the options list with the option matching `answerKey` visibly marked as the stored key (mirroring the artboard's "Marked correct" tag). Because `admin-quarantine-item-detail` deliberately degrades absent/malformed JSONB to **`content: null`**, the pane renders a graceful "no structured content" state when `content` is null rather than assuming a shape — the verdict/reason/provenance still render from the always-present fields.

### Resolve actions in context

Approve / Reject move into the detail pane, keeping the existing vocabulary and the audit-logged `quarantineAdminControllerApprove` / `quarantineAdminControllerReject` calls. The container owns a shared resolve handler (task 3.3) that, on success, invalidates `adminQueryKeys.quarantine()` (dropping the resolved item from the pending list) and clears `selectedId` back to the empty state; the existing `409` error surface (last-admin-style rejection path) is preserved. This is the preserved divergence from the artboard's "Edit key / Discard" — Readion resolves via Approve/Reject with an audit trail.

## Test Boundaries

Outside-in TDD per the repo convention:

| Layer | Test | Notes |
|---|---|---|
| Acceptance (e2e) | Extend `apps/web/e2e/admin.e2e.ts`: selecting a queue item opens a detail pane showing question/options + a formatted verdict (no raw JSON); Approve/Reject resolves it and removes it from the list. First asserted RED against the current stacked-card / raw-JSON UI (task 0.2). | Playwright against the running app |
| Component | `AdminReviewQueue` / `AdminReviewQueueDetail`: selecting a list item fetches detail via `quarantineAdminControllerDetail` and renders question/options/answer-key + formatted verdict; empty / loading / `content: null` states; Approve/Reject call the endpoints, reflect resolution, and drop the item from pending. | vitest + Vue Test Utils, mocked Orval operations / TanStack query |
| Unit | `formatVerdict` pure helper: `{ pass, score, reason }` → label (Passed/Failed) + score % + reason; tone mapping. | pure, no deps |

Coverage stays ≥ 80% (task 4.1); `yarn lint`, `yarn typecheck`, and web unit + e2e green.

## Risks / Trade-offs

- **`content: null` for older/non-quiz rows** — the detail endpoint intentionally returns `content: null` for malformed/absent `generatedContent`. Mitigated by an explicit "no structured content" state so the reviewer never renders `undefined`/blank; the verdict and provenance always render.
- **Answer-key match ambiguity** — `answerKey` is matched against `options[]` to mark the correct row; if the stored key does not match any option (legacy data), the pane still lists options and shows the key value separately rather than silently marking nothing.
- **Extra request per selection** — the detail fetch is a second round-trip on click; acceptable and intended (keeps the list lean) and cached by TanStack per id.

## Open Questions

- None blocking. All dependencies (`admin-quarantine-item-detail`, `quarantine-review-queue`, `web-admin`, `web-app-shell-sidebar`) are archived and the `quarantineAdminControllerDetail` client is generated.
