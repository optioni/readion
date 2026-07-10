## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Failing Playwright e2e for **Certifications list**: assert tables render in surface cards, the error state shows a Retry button, and clicking Re-verify opens a centered modal overlay (not an inline appended section)
- [x] 0.2 Failing Playwright e2e for **Cert-setup**: assert a distinct step-1 "Identify certification" screen with a certifying-body field and an upfront known-URL, advancing via "Search for sources →" to a separate confirmation step (5 steps total)
- [x] 0.3 Failing Playwright e2e for **Cert re-verification**: assert a dedicated `/admin/certifications/:code/re-verify` route renders a full-height screen with the stale header/pill and strikethrough-red/bold-green diff coloring
- [x] 0.4 Failing Playwright e2e for **Review queue / Sources / Users / Audit**: assert the source-evidence card renders the quoted excerpt (from `supportingSpans`); the sources banner shows live % + ETA; the user search filters the list; the audit table has separate Before/After columns with the append-only caption
- [x] 0.5 Confirm all fail for the right reason

## 1. Admin-wide chrome primitives (`web-admin`)

- [x] 1.1 RED: component tests for a shared table-shell surface card, a bordered admin header bar, an async-message component (loading spinner / error + Retry), and a relative-time helper
- [x] 1.2 GREEN: implement the shared primitives and apply them across the admin screens' tables and headers
- [x] 1.3 REFACTOR: de-duplicate per-screen table/header markup through the primitives

## 2. Certifications list (`web-admin`)

- [x] 2.1 RED: component tests for the re-verify **modal overlay** (backdrop + centered + blocks the list), the error Retry, the submitting spinner + "Re-verifying…" label, the "EXISTING CERTIFICATIONS · N active" label + subtitle, the code chip, and the "+" icon
- [x] 2.2 GREEN: implement the modal, retry, submitting state, labels, chip, and icon
- [x] 2.3 REFACTOR: scope the re-verify error inside the modal footer

## 3. Cert-setup — 5-step identify flow (`web-admin`)

- [x] 3.1 RED: component/e2e tests for a standalone step-1 "Identify certification" (name / required mono code + hint / certifying body / optional known URL) that advances to a separate confirmation step; intro + "what happens next" callouts; Cancel + primary CTA in a shared bordered footer; dynamic breadcrumb + header title
- [x] 3.2 GREEN: split step 1 into identify + confirmation (5 steps in `certSetupSteps.ts`); wire the certifying-body field to `state.identity.provider`; support the upfront known-URL; add callouts, footer, breadcrumb/title, ~640px column
- [x] 3.3 REFACTOR: keep the extraction/content/review steps intact; ensure the search kicks off on identify → confirmation

## 4. Cert re-verification — dedicated screen (`web-admin`)

- [x] 4.1 RED: e2e test for a `/admin/certifications/[code]/re-verify` route rendering a full-height screen: stale header (breadcrumb + cert title + "Metadata stale · action required" pill), and the diff with strikethrough-red old / bold-green new coloring + "Current (outdated)" / "Proposed (new guide)" headers
- [x] 4.2 GREEN: add the route/page, the stale header, and the diff color coding; remove the stray "(unverified)" annotation on the reverify diff
- [x] 4.3 REFACTOR: reuse the diff table; leave per-field Accept + extra rows + save-vs-verify for the descoped contract change

## 5. Review queue — render existing evidence + snippet (`web-admin`)

- [x] 5.1 RED: component tests for the source-evidence card (quoted excerpt from `supportingSpans` + highlighted phrase + link), the question-text snippet in list rows, the "Quarantined items" label + in-panel filter chips, the decision warning icon, relative dates, and the full-height split shell
- [x] 5.2 GREEN: render `supportingSpans` as the evidence card, switch the list snippet to question text, relocate the label/chips, add the icon + relative dates + full-height layout — **note:** `QuarantinedItemListItem` has no question/content field (`quarantine-admin.service.ts`'s `LIST_ITEM_FIELDS` excludes `generatedContent`), so the snippet is built from the existing `reason` field instead; see final report
- [x] 5.3 REFACTOR: leave the verdict taxonomy / flag badge / recommended-fix / per-source-correct for `enrich-review-queue-contract`

## 6. Sources / Users / Audit — presentational fidelity (`web-admin`)

- [x] 6.1 RED: Sources tests — running-job banner rendering the existing `progress` (spinner + % + ETA), per-state status-pill colors, relative last-ingested, type badge, comma-grouped mono chunk counts
- [x] 6.2 RED: Users tests — client-side search filtering the loaded list, amber Admin badge, "Email" column label, toolbar order, avatar styling
- [x] 6.3 RED: Audit tests — separate Before/After columns (six-column order), "Append-only · read-only · ★ = privileged action" caption, relative mono timestamps, table + header-bar chrome, italic/muted system actor; pagination retained
- [x] 6.4 GREEN: implement the Sources / Users / Audit fixes
- [x] 6.5 REFACTOR: leave cancel-job/source-name, user name/last-active/remove/invite, and audit privileged/export for their descoped contract changes

## 7. Acceptance Test — Outer Loop GREEN

- [x] 7.1 Confirm the section-0 e2e specs pass end-to-end
- [x] 7.2 Visually diff each admin surface against its artboard; reconcile residual drift — found and fixed a real bug (NaN ETA from a string-vs-epoch-ms mismatch in the Sources fixture)
- [x] 7.3 REFACTOR: clean up selectors and shared fixtures

## 8. Change Review — Subagent Verification

- [x] 8.1 Dispatch a reviewer subagent against `proposal.md`, the `web-admin` spec delta, and the diff
- [x] 8.2 Triage findings; re-run affected tests

## 9. Polish

- [x] 9.1 `yarn lint`
- [x] 9.2 `yarn format`
- [x] 9.3 `yarn workspace apps/web typecheck` (zero errors)
- [x] 9.4 `yarn workspace apps/web test:coverage` (≥80% for touched components)
