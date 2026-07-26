# Parity — Cert re-verification

10 active findings — 4 high · 4 medium · 2 low

## Reconciliation — ui-interaction-state-parity

This report keeps 10 snapshot observations as evidence. Counts and the parity index include only the 10 entries still marked `open`; `resolved` and `superseded` entries below are historical.

- Static Claude frames remain the visual hierarchy reference. Live loading/content/empty/error+Retry/background-refresh states, operation-specific busy labels and duplicate guards, semantic dark/light modes, accessibility/focus behavior, and tested 375px containment are intentional product contracts even when no static frame depicts them.
- Busy identity belongs only to the initiating action; adjacent disabled actions do not display its spinner or progressive label. Dimensions remain stable and reduced-motion preferences are honored.

- **[high] Dedicated re-verification screen/route** — missing/layout
  - design: A standalone full-page screen at route /admin/certifications/:code/re-verify — own AdminSidebar, own header, occupies the whole viewport for one certification's stale-metadata review.
  - app: No such route exists (Glob of apps/web/app/pages/admin/certifications only returns index.vue and new.vue). The reverify flow is an inline card that expands at the bottom of the generic /admin/certifications list page after clicking a table row's 'Re-verify' button — there is no per-cert navigation/URL.
  - evidence: `design: openspec/design/AdminCertSetup.html:515-579,706 (StaleRecertScreen, route=/admin/certifications/:code/re-verify); app: apps/web/app/pages/admin/certifications/{index,new}.vue (no [code]/re-verify page) and apps/web/app/components/admin/AdminCertifications.vue:250-306 (inline <div v-if="diff">)`
- **[high] Stale-cert header (breadcrumb + cert title + 'Metadata stale · action required' pill)** — missing/composition
  - design: Page header shows breadcrumb 'Certifications › SAA-C03 › Re-verification required' (last crumb in warning color), the cert's display name 'Solutions Architect – Associate' as an H1-equivalent, and a right-aligned warning-colored pill 'Metadata stale · action required'.
  - app: No per-cert header is rendered for the reverify state; the page still shows the generic 'Certifications' h1 (shared with the rest of the list page). No breadcrumb and no stale-status pill exist anywhere in the component.
  - evidence: `design: openspec/design/AdminCertSetup.html:519-535; app: apps/web/app/components/admin/AdminCertifications.vue:144-155`
- **[high] Stale-reason callout ('Exam guide updated — November 2024' explanation)** — missing/composition
  - design: A warning-tinted callout with icon explains *why* re-verification is needed: 'AWS published a revised SAA-C03 exam guide. The agent identified changes to domain weightings and 2 renamed domains.'
  - app: No explanatory callout is rendered anywhere in the reverify flow — the admin sees only the raw diff table with no narrative context for the change.
  - evidence: `design: openspec/design/AdminCertSetup.html:539-547; app: apps/web/app/components/admin/AdminCertifications.vue:250-306 (no equivalent block)`
- **[high] Per-row 'Accept' button for individually changed fields** — missing/behavioral
  - design: Each DiffRow shows an individual 'Accept' button only for rows that changed, letting the admin accept field changes one at a time.
  - app: Only a single bulk 'Accept all & re-verify' button exists for the whole diff; there is no per-row accept control or ability to selectively accept individual field changes.
  - evidence: `design: openspec/design/AdminCertSetup.html:504-513 (DiffRow's conditional Accept button); app: apps/web/app/components/admin/AdminCertifications.vue:265-296 (no per-row action column)`
- **[medium] Domain-level diff granularity + Validity period / Exam version rows** — simplified/composition
  - design: Diff table has 8 granular rows: Domain 1 name, Domain 1 weight, Domain 3 name, Domain 3 weight, Domain 4 weight, Validity period, Exam version, Passing score — each domain's name and weight independently comparable.
  - app: All domains are collapsed into a single 'Domains' row formatted as a comma-joined string (e.g. 'Name (30%), ...'); there is no per-domain name/weight comparison. 'Validity period' and 'Exam version' fields don't exist in the reverify schema at all (CertProposedValues only has domains, questionCount, passingScore, timeLimitMinutes).
  - evidence: `design: openspec/design/AdminCertSetup.html:559-566; app: apps/web/app/composables/certReverifyDiff.ts:37-42,50-67,85-117`
- **[medium] Changed-value color coding (strikethrough red old / bold green new)** — simplified/composition
  - design: Changed rows render the old value with strikethrough + red (poor) text on a faint red background, and the new value bold + green (good) text on a faint green background; unchanged rows are muted/subtle in both columns.
  - app: The 'current' cell is always plain slate-300 text with no strikethrough or red tint. The 'proposed' cell only gets a color change (readion-primary) when changed — no strikethrough, no distinct background tinting for changed vs. unchanged rows.
  - evidence: `design: openspec/design/AdminCertSetup.html:504-513; app: apps/web/app/components/admin/AdminCertifications.vue:265-284`
- **[medium] Footer actions: 'Review source URL first' / 'Accept all changes' / 'Save & mark verified'** — divergent/behavioral
  - design: Three distinct actions: a left-anchored secondary 'Review source URL first' (lets the admin verify the source before trusting the diff), and a right-side pair — secondary 'Accept all changes' and primary 'Save & mark verified' — implying accept-then-commit as two steps.
  - app: Only two actions exist: 'Accept all & re-verify' (primary, submits immediately) and 'Cancel'. There is no source-URL review action and no separation between accepting changes and committing/marking verified — it's a single combined submit.
  - evidence: `design: openspec/design/AdminCertSetup.html:569-575; app: apps/web/app/components/admin/AdminCertifications.vue:287-306`
- **[medium] Full-height split-panel layout vs. boxed inline section** — divergent/layout
  - design: Edge-to-edge flex layout: fixed-width AdminSidebar plus a flex-1 content column that fills the viewport height, dedicated entirely to this one certification's re-verification.
  - app: AdminConsole renders a centered `mx-auto max-w-7xl` boxed container shared by the whole /admin/certifications page; the reverify diff appears as one more card stacked beneath two other tables (existing certs, due-for-reverification), not as a focused full-height screen.
  - evidence: `design: openspec/design/AdminCertSetup.html:516-518; app: apps/web/app/components/admin/AdminConsole.vue:83-87 and AdminCertifications.vue:144-145,250-253`
- **[low] Diff section label & colored column headers ('Field changes detected' / 'Current (outdated)' / 'Proposed (new guide)')** — divergent/composition
  - design: Uppercase eyebrow label 'Field changes detected' above the table; column headers explicitly read 'Current (outdated)' (red) and 'Proposed (new guide)' (green).
  - app: Section is titled 'Proposed changes' (h2, not an uppercase eyebrow) with plain, uncolored column headers 'Current' and 'Proposed'.
  - evidence: `design: openspec/design/AdminCertSetup.html:550,554-556; app: apps/web/app/components/admin/AdminCertifications.vue:255,259-261`
- **[low] '(unverified)' inline annotation on diff rows** — divergent/composition
  - design: The stale-diff screen has no unverified-field annotation — that status concept belongs to the separate field-extraction screen (StatusBadge), not the re-verification diff.
  - app: Adds a '(unverified)' text annotation next to the field label when the extracted value lacks a citation, a behavior not present in the corresponding design screen.
  - evidence: `design: openspec/design/AdminCertSetup.html:504-513 (no such annotation in DiffRow); app: apps/web/app/components/admin/AdminCertifications.vue:274`
