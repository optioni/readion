# Parity — Admin Certifications

0 active findings — 0 high · 0 medium · 0 low

## Reconciliation — ui-interaction-state-parity

This report keeps 11 snapshot observations as evidence. Counts and the parity index include only the 0 entries still marked `open`; `resolved` and `superseded` entries below are historical.

- Static Claude frames remain the visual hierarchy reference. Live loading/content/empty/error+Retry/background-refresh states, operation-specific busy labels and duplicate guards, semantic dark/light modes, accessibility/focus behavior, and tested 375px containment are intentional product contracts even when no static frame depicts them.
- Busy identity belongs only to the initiating action; adjacent disabled actions do not display its spinner or progressive label. Dimensions remain stable and reduced-motion preferences are honored.
- Resolved snapshot findings: “ReVerifyDiffPanel (Proposed changes modal)”; “AsyncMessage error 'Retry' button”; “Re-verify submit button submitting state”; “Existing certifications section label + active count”; “CertPageHeader subtitle”; “Table shell (card chrome around Existing/Due tables)”; “CodeChip (exam code pill)”; “AsyncMessage loading spinner”; “'New certification' button plus-icon”; “Re-verify error message placement”.
- Superseded by product contract: “Content-region width/layout”.

- **[high · resolved] ReVerifyDiffPanel (Proposed changes modal)** — divergent/layout
  - design: ReVerifyDiffPanel renders as a centered modal overlay (position: absolute, inset 0, rgba(10,15,30,0.6) backdrop, z-index 20) with its own header/diff-table/footer sections and a box-shadow, blocking interaction with the rest of the screen while re-verifying a cert.
  - app: The diff is rendered as an ordinary inline section appended at the bottom of the same scrollable page (`v-if="diff"` block), with no backdrop, no centering, no overlay/blocking behavior — the tables above remain fully interactive underneath it.
  - evidence: `openspec/design/AdminCertifications.html:218-256 (ReVerifyDiffPanel) vs apps/web/app/components/admin/AdminCertifications.vue:250-306`
- **[high · resolved] AsyncMessage error 'Retry' button** — missing/composition
  - design: Error state shows an alert icon plus inline 'Retry' button (border, poor-color text) next to 'Could not load certifications. Please try again.'
  - app: Error state renders only plain red text 'Could not load certifications. Please try again.' with no icon and no retry affordance — the user has no way to re-trigger the query from the UI.
  - evidence: `openspec/design/AdminCertifications.html:176-179 (AsyncMessage kind="error") vs apps/web/app/components/admin/AdminCertifications.vue:205-207`
- **[medium · resolved] Re-verify submit button submitting state** — missing/behavioral
  - design: While submitting, the 'Accept all & re-verify' button shows a spinning loader plus its label changes to 'Re-verifying…', in addition to being disabled.
  - app: Button only gets `disabled` + `opacity-50`; the label always reads 'Accept all & re-verify' and there is no spinner during submission.
  - evidence: `openspec/design/AdminCertifications.html:249-252 vs apps/web/app/components/admin/AdminCertifications.vue:288-296`
- **[medium · resolved] Existing certifications section label + active count** — divergent/composition
  - design: SectionLabel renders an uppercase, letter-spaced caption 'EXISTING CERTIFICATIONS' with a muted count badge (e.g. '3 active') next to it.
  - app: Second heading duplicates the page title verbatim ('Certifications' — identical text to the h1 above it) as a plain h2, with no 'Existing' qualifier and no active-count badge.
  - evidence: `openspec/design/AdminCertifications.html:103-108, 266 vs apps/web/app/components/admin/AdminCertifications.vue:157`
- **[medium · resolved] CertPageHeader subtitle** — missing/composition
  - design: Header includes a descriptive subtitle: 'Manage certifications and keep their metadata verified against source.' beneath the title.
  - app: Only the h1 'Certifications' is rendered; no subtitle text.
  - evidence: `openspec/design/AdminCertifications.html:92-94 vs apps/web/app/components/admin/AdminCertifications.vue:146-155`
- **[medium · resolved] Table shell (card chrome around Existing/Due tables)** — simplified/composition
  - design: TableShell wraps each table in a bordered, rounded (rXl) surface card visually distinct from the page background, with an elevated-background header row.
  - app: Plain HTML `<table>` with only a bottom border under the header row — no card container, background, border, or corner radius.
  - evidence: `openspec/design/AdminCertifications.html:111-120 vs apps/web/app/components/admin/AdminCertifications.vue:167-198, 212-244`
- **[low · resolved] CodeChip (exam code pill)** — simplified/composition
  - design: Exam code (e.g. 'SAA-C03') is rendered as a monospaced pill with its own background, border, and radius (CodeChip).
  - app: Code is rendered as plain text in a `<td>` with no monospace font or pill/chip styling.
  - evidence: `openspec/design/AdminCertifications.html:123-125 vs apps/web/app/components/admin/AdminCertifications.vue:185, 230`
- **[low · resolved] AsyncMessage loading spinner** — simplified/composition
  - design: Loading state shows a spinning ring indicator next to 'Loading certifications…'.
  - app: Loading state renders only the text 'Loading certifications…' with no spinner.
  - evidence: `openspec/design/AdminCertifications.html:175, 186 vs apps/web/app/components/admin/AdminCertifications.vue:202-204`
- **[low · resolved] 'New certification' button plus-icon** — simplified/composition
  - design: Primary action button includes a leading '+' SVG icon alongside the label.
  - app: NuxtLink renders only the text 'New certification', no icon.
  - evidence: `openspec/design/AdminCertifications.html:95-98 vs apps/web/app/components/admin/AdminCertifications.vue:148-154`
- **[low · superseded] Content-region width/layout** — divergent/layout
  - design: Sidebar + content fill the full artboard width edge-to-edge (no outer max-width constraint on the admin shell itself); content region scrolls independently of a fixed header bar.
  - app: AdminConsole wraps sidebar+content in `mx-auto max-w-7xl ... px-4 py-8`, centering the whole console with side gutters on wide viewports, and there is no distinct sticky/bordered header bar — the title row scrolls with the rest of the content.
  - evidence: `openspec/design/AdminCertifications.html:260-264 vs apps/web/app/components/admin/AdminConsole.vue:83-87`
- **[low · resolved] Re-verify error message placement** — divergent/behavioral
  - design: A re-verification failure is shown inside the diff panel's own footer, scoped to that modal, alongside the Cancel/Accept actions.
  - app: `reverifyError` is rendered as a standalone paragraph between the Due table and the diff section, outside/above the diff block rather than inside its footer.
  - evidence: `openspec/design/AdminCertifications.html:241-246 vs apps/web/app/components/admin/AdminCertifications.vue:246-249`
