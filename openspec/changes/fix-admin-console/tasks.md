## 0. Acceptance Test — Outer Loop RED

Reproduce the highest-impact defects first: Audit Log human-readability, the AdminSidebar shell chrome, and pagination on the large tables.

- [x] 0.1 Write a failing Playwright e2e (`apps/web/e2e/admin-console.e2e.ts`) that signs in as an admin, seeds ≥2 audit entries (a role change and a source/cert action), opens `/admin/audit-logs`, and asserts each row shows the actor **email** (not a UUID), a human **target label** (not `type · <uuid>`), and human **before → after** values (e.g. `user → admin`, `draft → live`) with no raw JSON braces
- [x] 0.2 Extend the e2e to assert the admin area renders the `AdminSidebar` chrome exactly once (orange `ADMIN` eyebrow, per-item icons, a Review-queue badge with the pending count, an Admin-session card showing the signed-in email) and that no second/duplicate study nav is present in the admin viewport
- [x] 0.3 Extend the e2e to assert `/admin` redirects to `/admin/certifications`, and that the Users and Audit Log tables render a pagination control when the API `meta` reports more than one page
- [x] 0.4 Write a failing NestJS integration test (Supertest) asserting `GET /api/v1/admin/audit-logs` returns each entry with `actorEmail` (the actor's email, and `null` for a purged/system actor) and a non-empty `targetLabel`, in addition to the existing fields
- [x] 0.5 Confirm 0.1–0.4 fail for the right reason (missing response fields + missing rendering/chrome), not a harness/setup error

## 1. Audit-log contract — resolvable identity (`audit-log`)

- [x] 1.1 RED: Unit-test the admin audit-logs read model / mapper — for a `user.role.promoted` entry it resolves `actorEmail` from `userId` and sets `targetLabel` to the target user's email; for a purged actor (`userId = null`) `actorEmail` is `null`; for a source/cert action `targetLabel` is the source/cert title
- [x] 1.2 GREEN: Extend the audit-logs query/DTO to expose `actorEmail` (nullable) and `targetLabel`; add `actorEmail`/`targetLabel` to the shared `AuditLogEntry` type in `packages/shared`
- [x] 1.3 REFACTOR: Keep the resolution in one read-model mapper; ensure the append-only + purge invariants are untouched (write path still stores only `userId`)
- [x] 1.4 Regenerate the Orval client and commit the updated `~~/src/api` audit-logs model

## 2. Audit Log rendering — human-readable (`web-admin`)

- [x] 2.1 RED: Unit/component-test `AdminAuditLog.vue` — a row renders `actorEmail` (and a `System`/`—` fallback when null), `targetLabel`, and a human `before → after` diff (scalar values, not `JSON.stringify`)
- [x] 2.2 GREEN: Render `actorEmail` / `targetLabel` and a scalar before→after formatter; drop the raw-JSON `formatSnapshot`
- [x] 2.3 REFACTOR: Extract the before→after diff formatter so it degrades gracefully for multi-key snapshots

## 3. Audit Log + Users pagination (`web-admin`)

- [x] 3.1 RED: Component-test both tables — when the API `meta` reports multiple pages a pagination control renders and advancing the page requests the next page
- [x] 3.2 GREEN: Wire pagination (page/limit) through `useAdminAuditLogs` and `useAdminUsers` and render the control
- [x] 3.3 REFACTOR: Share a single pagination control/composable between the two tables

## 4. Admin shell chrome — AdminSidebar (`web-admin`)

- [x] 4.1 RED: Component-test `AdminConsole.vue` — asserts the `ADMIN` eyebrow, per-item icons, a Review-queue badge bound to the pending quarantine count, and an Admin-session card showing the signed-in admin email; asserts the console is not wrapped by the study app shell (single admin nav)
- [x] 4.2 GREEN: Add the eyebrow, per-item icons, review-queue badge (from the quarantine pending count), and admin-session card; ensure admin routes use only the admin shell
- [x] 4.3 RED: Route-test `/admin` — an admin visiting `/admin` is redirected to `/admin/certifications`
- [x] 4.4 GREEN: Add the `/admin` → `/admin/certifications` redirect
- [x] 4.5 REFACTOR: De-duplicate nav item definitions and active-state logic

## 5. Users table fidelity (`web-admin`)

- [x] 5.1 RED: Component-test `AdminUsers.vue` — header-utility row (search field, Invite user, `N users · M admins` summary), `Certs` column header (not `Enrollments`), a `Name` column, a `Last active` column, a capitalized+colored role badge (`Admin`/`User`), and a single contextual role-toggle button (`Promote` for a user, `Demote` for an admin) plus a red `Remove`
- [x] 5.2 GREEN: Implement the header-utility row, column changes, role-badge styling, and contextual action buttons; render `Name`/`Last active` from the contract fields when present and a graceful placeholder otherwise
- [x] 5.3 REFACTOR: Keep the summary count derivation and the contextual-action selection in small pure helpers

## 6. Sources table fidelity (`web-admin`)

- [x] 6.1 RED: Component-test `AdminSources.vue` — certification selection renders as pills (not a `<select>`), source registration sits behind a dashed "Add source" affordance (not an always-open form), the table has `Enabled` toggle / `Last ingested` / `Chunks` columns, and with no certification selected an empty state ("Select a certification to view its sources") renders instead of floating headers over a blank body
- [x] 6.2 GREEN: Implement cert pills, the "Add source" affordance, the `Enabled`/`Last ingested`/`Chunks` columns (chunk count + last-ingested from the contract — chunkCount added to the content-source contract this change), and the empty state
- [x] 6.3 REFACTOR: Reuse the shared status/job helpers for the enabled/last-ingested derivation

## 7. Review queue fidelity (`web-admin`)

- [x] 7.1 RED: Component-test `AdminReviewQueue.vue` — header shows `N items awaiting review`, certification filter chips filter the list, and each list row shows a mono item id, a certification badge, and a formatted flag/verdict badge
- [x] 7.2 GREEN: Implement the count, filter chips, and richer list-row metadata
- [x] 7.3 REFACTOR: Keep the verdict/flag badge formatting in one place shared with the detail pane

## 8. Certifications index list (`web-admin`)

- [x] 8.1 RED: Component-test `AdminCertifications.vue` — the section lists existing certifications (from the certifications list endpoint), each linking to its detail/setup, in addition to the Due-for-re-verification section
- [x] 8.2 GREEN: Fetch and render the existing-certifications list with an empty state
- [x] 8.3 REFACTOR: Reuse the shared certifications list query already used by Sources

## 9. Cert setup wizard chrome (`web-admin`)

- [ ] 9.1 RED: Component-test the new-certification flow — a `SetupHeader` renders a breadcrumb, a `Step N of 4 · <step name>` indicator with a progress bar, and a Cancel affordance, across the discover → extraction → coverage steps
- [ ] 9.2 GREEN: Add the `SetupHeader` chrome (breadcrumb + step indicator + progress bar + Cancel) around the existing wizard steps
- [ ] 9.3 REFACTOR: Derive the step index/label and progress from the existing wizard state (no duplicated step constants)

## 10. Acceptance Test — Outer Loop GREEN

- [ ] 10.1 Confirm the e2e (0.1–0.3) and the integration test (0.4) pass end-to-end
- [ ] 10.2 Verify `apps/web` and `apps/api` boot locally with the audit-logs response and any admin-users field additions — no startup/config errors
- [ ] 10.3 Regression: confirm the behaviors preserved by the MODIFIED requirements still pass — role-gate redirects (non-admin blocked, unauthenticated → login) and audit-logs `403`/`401` guards; Users promote + last-admin-demote `409`; Sources re-ingest job status + disable-maps-to-Remove; and the Review-queue detail reviewer (select, Approve/Reject removes the item, `content: null` degrades gracefully, no-selection empty prompt) — none regressed by the fidelity/pagination changes
- [ ] 10.4 REFACTOR: Clean up test fixtures and the admin seed helpers

## 11. Change Review — Subagent Verification

- [ ] 11.1 Dispatch a subagent to review the change against `proposal.md`, the spec scenarios, and the diff plus this task list (reviewer reports findings only, does not edit code)
- [ ] 11.2 Triage findings: fix every CRITICAL, resolve or consciously accept each WARNING (one-line reason per accepted WARNING), note SUGGESTIONs; re-run affected tests

## 12. Polish

- [ ] 12.1 Run linter and fix all errors (`yarn lint`)
- [ ] 12.2 Run formatter and apply fixes (`yarn format`)
- [ ] 12.3 Run type checker with zero errors (`apps/web`, `apps/api`, shared)
- [ ] 12.4 Run coverage and confirm ≥80% lines/branches/functions (`yarn test:coverage`)
- [ ] 12.5 Run `yarn codegen` and commit the regenerated client if the API changed
