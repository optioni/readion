# Parity — Audit log

9 findings — 3 high · 4 medium · 2 low

- **[high] Export CSV button** — missing/composition
  - design: A top-right 'Export CSV' button (transparent, bordered, rMd radius) sits beside the append-only caption row, letting an admin export the log.
  - app: absent — no export affordance anywhere in AdminAuditLog.vue or its composable/API client calls
  - evidence: `openspec/design/admin-content.jsx:375 (button 'Export CSV'); apps/web/app/components/admin/AdminAuditLog.vue:36-93 (no export control)`
- **[high] Privileged-action star marker + ActionBadge color coding** — missing/composition
  - design: ActionBadge renders the action in a colored monospace label (warn/poor/good/accent per action type) and appends a superscript ★ when `privileged` is true; the caption row explicitly defines '★ = privileged action' as the whole reason the screen exists per the artboard subtitle ('Privileged actions marked with a star').
  - app: Action column renders `entry.action` as plain text with no color coding, no monospace, and no privileged flag/star at all — the underlying AuditLogEntry type has no `privileged` field to even source this from
  - evidence: `openspec/design/admin-content.jsx:341-359 (ActionBadge), :373 (star legend); apps/web/app/components/admin/AdminAuditLog.vue:65-67 (plain {{ entry.action }}); packages/shared/src/admin/index.ts:47-58 (AuditLogEntry has no privileged field)`
- **[high] Column structure (Timestamp/Actor/Action/Target/Before/After)** — divergent/composition
  - design: Six distinct columns in fixed order — Timestamp, Actor, Action, Target, Before, After — with Before/After shown as separate monospace cells for direct diffing.
  - app: Five columns in a different order — Action, Target, Change, Actor, When — with Before/After collapsed into a single 'Change' string (`before → after`) via formatAuditDiff.
  - evidence: `openspec/design/admin-content.jsx:379 (THead cols); apps/web/app/components/admin/AdminAuditLog.vue:49-55 (thead th order), :71-72 (formatChange merges before/after)`
- **[medium] Append-only / read-only caption + star legend** — missing/behavioral
  - design: A caption line above the table states 'Append-only · read-only' with a dot separator and '★ = privileged action' legend, communicating the immutability guarantee and badge meaning directly on screen.
  - app: No such caption/legend text is rendered anywhere on the page.
  - evidence: `openspec/design/admin-content.jsx:369-374; apps/web/app/components/admin/AdminAuditLog.vue:36-45 (only h1 + loading/error states)`
- **[medium] Timestamp formatting** — divergent/behavioral
  - design: Relative/short timestamps ('Today 14:32', 'Jun 22 18:41') in a small subtle monospace font, keeping the log scannable.
  - app: Absolute long-form date via Intl.DateTimeFormat (e.g. 'Jan 1, 2026, 02:32 PM'), plain (non-mono) text.
  - evidence: `openspec/design/admin-content.jsx:332-338 (ts values), :382 (mono/subtle style); apps/web/app/components/admin/AdminAuditLog.vue:15-25,77-79`
- **[medium] Table container chrome** — simplified/composition
  - design: Table wrapped in a surfaced card: `T.surface` background, 1px border, `rXl` rounded corners, overflow hidden, with an elevated-background uppercase-letter-spaced header row.
  - app: Bare `<table>` with only a bottom border on `<thead>`/rows — no card background, no border, no rounding, no uppercase header styling.
  - evidence: `openspec/design/admin-content.jsx:378-379 (card + THead styles), :43-49 (THead uppercase/elevated); apps/web/app/components/admin/AdminAuditLog.vue:47-56`
- **[medium] Header bar chrome** — simplified/layout
  - design: Section header is a full-width bar with `T.elevated` background, bottom border, and `14px 28px` padding, matching the other admin screens (Sources, Users, Review queue).
  - app: Just an `<h1>` text node with no surrounding bar/background/border — inconsistent with the other admin section headers in the same shell.
  - evidence: `openspec/design/admin-content.jsx:365-367; apps/web/app/components/admin/AdminAuditLog.vue:38`
- **[low] System actor styling** — simplified/composition
  - design: When `actor === 'system'`, the actor cell is italicized and rendered in a subtler muted tone to visually distinguish automated entries from human admins.
  - app: Actor cell falls back to the literal string 'System' when `actorEmail` is null but applies no italic/muted styling distinction.
  - evidence: `openspec/design/admin-content.jsx:383; apps/web/app/components/admin/AdminAuditLog.vue:74-76`
- **[low] Pagination control** — divergent/behavioral
  - design: Artboard depicts a fixed, single-page, scrollable log (7 rows fill the 820px frame) with no pagination controls.
  - app: Adds an `AdminPagination` control driven by `meta.total`/`meta.limit`, not represented in the design at all.
  - evidence: `openspec/design/admin-content.jsx:361-394 (no pagination); apps/web/app/components/admin/AdminAuditLog.vue:84-91`
