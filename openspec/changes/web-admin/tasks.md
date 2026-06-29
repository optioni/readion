## 0. Acceptance Test — Outer Loop RED

- [x] 0.1 Set up the Playwright e2e harness in `apps/web/e2e/admin.e2e.ts` with `/api/v1/*` route mocks per design.md Test Boundaries: admin endpoints (`GET /admin/users`, `POST /admin/users/:id/promote|demote`, `GET /admin/audit-logs`), content endpoints (`GET/POST /admin/content-sources`, `:id/enable|disable|reingest|jobs`), cert-setup endpoints (`discover-sources`, `extract`, `extractions/:jobId`, `due-for-reverification`, `POST /admin/certifications`, `:id/reverify`), and `GET /certifications/:id` + `:id/coverage`; an `admin`-role session seeded via the existing auth e2e helpers, plus a `user`-role session for the gate test
- [x] 0.2 Write failing acceptance test covering the spec scenarios: admin opens the console (AdminSidebar, section routing); a `user`-role session is blocked from `/admin/**`; Users list → promote/demote (incl. 409 last-admin); Audit Log read-only render; Sources list per cert → register-by-URL → re-ingest → disable; Cert setup wizard (discover → confirm source → poll extraction with one grounded + one unverified field → enter identity fields → submit draft, no publish button → coverage read-only); re-verification from the due list (client diff → reverify); Review queue shows the placeholder and issues no request
- [x] 0.3 Confirm the acceptance test fails for the right reason (no `/admin` routes yet), not a harness/setup error

## 1. Admin shell + role gate (outermost)

- [x] 1.1 RED: Write unit tests for (a) extending `AuthUser` (`app/stores/auth.ts`) with `role: RoleValue` and populating it from `runAuthBootstrap` (`/users/me` already returns `role`); (b) a non-global admin route middleware `app/middleware/admin.ts` — awaits `auth.ready`, redirects unauthenticated → login and signed-in non-admins → `/`, allows `admin`; (c) the admin shell component rendering `AdminSidebar` (Certifications, Review queue, Sources, Users, Audit Log, and a Settings item that links out to the existing `/settings` page) with the active section highlighted. Build to `app-shell.jsx` → `Shell.AdminSidebar`. SPEC.md → Frontend → Admin; Authentication & Authorisation → Roles
- [x] 1.2 GREEN: Implement the `AuthUser.role` extension + bootstrap population, the `admin` middleware, and the admin shell; wire `/admin/**` pages to apply the middleware
- [x] 1.3 REFACTOR: Share the shell across sections; reuse `statusColor`/badge primitives where applicable

## 2. adminQueryKeys + shared admin query/mutation wrappers

- [x] 2.1 RED: Write unit test for `app/composables/adminQueryKeys.ts` (stable keys per surface: `users()`, `auditLogs()`, `contentSources(certId)`, `sourceJobs(id)`, `dueForReverification()`, `coverage(certId)`) and the envelope-narrowing helper that types weak Orval responses via `@readion/shared`
- [x] 2.2 GREEN: Implement `adminQueryKeys` and the narrowing helpers
- [x] 2.3 REFACTOR: Deduplicate against existing query-key composables where sensible

## 3. Users section

- [x] 3.1 RED: Write unit test for the Users table — renders email, role badge, join date (`createdAt`), enrollment count from `adminControllerListUsers`; promote (`adminControllerPromote`) flips the badge; demote (`adminControllerDemote`) with `409` surfaces an error and leaves the role; NO name/last-active/search/invite/delete controls (per reconciliation); avatar = derived initials. Build to `AdminContentUsers.html` → `UsersScreen`. SPEC.md → AdminModule
- [x] 3.2 GREEN: Implement the Users section + promote/demote mutations with list invalidation
- [x] 3.3 REFACTOR: Clean up table/badge reuse

## 4. Audit Log section

- [x] 4.1 RED: Write unit test for the read-only Audit Log table — renders action, target (`targetType`/`targetId`), before/after JSONB (tolerating `null`), timestamp, and `userId` actor from `adminControllerListAuditLogs`; no edit/delete/export control; no fabricated actor email. Build to `AdminContentUsers.html` → `AuditLogScreen`. SPEC.md → AdminModule (AuditLog)
- [x] 4.2 GREEN: Implement the Audit Log section
- [x] 4.3 REFACTOR: Clean up snapshot rendering

## 5. Sources section

- [x] 5.1 RED: Write unit test for the Sources section — cert selector drives `contentControllerList({ certificationId })`; rows show url/type + an enabled toggle; register-by-URL (`contentControllerRegister` with `{ certificationId, type, url }`, validated by `registerSourceRequestSchema`, no file upload); Re-ingest (`contentControllerReingest`, 202); "Remove" → `contentControllerDisable`; status pill + running-jobs banner derived from `contentControllerListJobs` (`active`→ingesting, `failed`→error, `!enabled`→disabled); NO chunk-count column, NO cancel control. Build to `AdminContentUsers.html` → `ContentSourcesScreen`. SPEC.md → ContentModule
- [x] 5.2 GREEN: Implement the Sources section + register/enable/disable/reingest mutations + job-status polling
- [x] 5.3 REFACTOR: Extract the status-derivation helper; reuse `statusColor`

## 6. Cert setup — Step 1 discovery + confirm

- [ ] 6.1 RED: Write unit test — name/code entry triggers `certSetupControllerDiscoverSources`; `candidates[]` (`url`,`title`,`snippet?`) render selectable with a manual-URL input; NO confidence badge; confirming one url advances to extraction. Build to `AdminCertSetup.html` → `SourceConfirmationScreen`. SPEC.md → Certification Setup & Grounding
- [ ] 6.2 GREEN: Implement the discovery/confirm step
- [ ] 6.3 REFACTOR: Clean up source-selection state

## 7. Cert setup — Step 2 grounded extraction + citations

- [ ] 7.1 RED: Write unit test — confirming a source calls `certSetupControllerExtract` (202 + `jobId`); poll `certSetupControllerReadExtraction` until `fields` present; render the four grounded fields (`domains`, `questionCount`, `passingScore`, `timeLimitMinutes`) — `{ value, citation }` shows the value next to its cited passage/url, `{ unverified: true }` shows the "unverified — confirm manually" state; admin enters `name`/`provider`/`code`; per-field Confirm/Flag is client state; NO invented fields (cost/prereq/validity/etc.). Build to `AdminCertSetup.html` → `FieldExtractionScreen`. SPEC.md → Certification Setup & Grounding; Grounding & Verification
- [ ] 7.2 GREEN: Implement the extraction poll + per-field citation/review panel
- [ ] 7.3 REFACTOR: Extract the citation panel / field-row components

## 8. Cert setup — Step 3 sources + read-only coverage, Step 4 draft submit

- [ ] 8.1 RED: Write unit test — Step 3 registers suggested/manual sources via `contentControllerRegister` ("Approve"=register, "Reject"=discard; no pending-review status, no upload); coverage bars render read-only from `certificationCoverageControllerCoverage`; NO "Admin review sign-off". Step 4 submits `certSetupControllerCreate` with the four fields + `provenance` map (built via `@readion/shared` `buildProvenanceMap`) + `sourceUrl`, creating a `draft`; NO "Publish" button (go-live is automatic); a `409` (duplicate code) or `422` (domain weights ≠ 100) response surfaces the error and keeps fields editable, and submit is gated on a client-side weight-sum check. Build to `AdminCertSetup.html` → `ContentSourcesScreen` + `ReviewPublishScreen`. SPEC.md → Certification Setup & Grounding ("Draft → live is automatic")
- [ ] 8.2 GREEN: Implement Step 3 (sources + coverage) and Step 4 (review + draft create)
- [ ] 8.3 REFACTOR: Reuse the coverage-bar component across step 3/4

## 9. Cert re-verification (due list + client diff)

- [ ] 9.1 RED: Write unit test — due list from `certSetupControllerListDueForReverification`; re-verify reads current values via `certificationsControllerDetail`, re-runs discover/extract, diffs proposed vs current client-side, and submits `certSetupControllerReverify` with `{ confirmedSourceUrl, domains, questionCount, passingScore, timeLimitMinutes, provenance }`; "Accept all" is client-side. Build to `AdminCertSetup.html` → `StaleRecertScreen`. SPEC.md → Certification Setup & Grounding (Metadata freshness)
- [ ] 9.2 GREEN: Implement the due list + re-verification diff + `reverify` mutation
- [ ] 9.3 REFACTOR: Reuse the discovery/extraction steps from the setup wizard

## 10. Review queue placeholder

- [ ] 10.1 RED: Write unit test — the Review queue section renders a clear "not yet available" placeholder, issues NO request to any quarantine endpoint, and shows no fabricated items/verdicts/badge count (per reconciliation: no backend exists). Build to `AdminContentUsers.html` → `ContentQualityScreen` (descoped)
- [ ] 10.2 GREEN: Implement the placeholder section
- [ ] 10.3 REFACTOR: Ensure the AdminSidebar `Review queue` item carries no fabricated badge count

## 11. Acceptance Test — Outer Loop GREEN

- [ ] 11.1 Confirm the acceptance test passes end-to-end
- [ ] 11.2 Verify `apps/web` starts in the local environment (smoke test) — boot the app, sign in as admin, confirm `/admin/**` renders and a non-admin is blocked (no backend/codegen changes were made)
- [ ] 11.3 REFACTOR: Clean up e2e mocks/fixtures and shared test setup if needed

## 12. Change Review — Subagent Verification

- [ ] 12.1 Dispatch a subagent to review the change against proposal.md, the spec scenarios, and design.md (reviewer reports findings only, does not edit code)
- [ ] 12.2 Triage findings: fix every CRITICAL, resolve or accept each WARNING, note SUGGESTIONs; re-run affected tests

## 13. Polish

- [ ] 13.1 Run linter and fix all errors (`yarn lint`)
- [ ] 13.2 Run formatter and apply fixes (`yarn format`)
- [ ] 13.3 Run type checker with zero errors (`yarn workspace apps/web typecheck` / `yarn typecheck`)
- [ ] 13.4 Run coverage report and confirm ≥80% lines/branches/functions (`yarn workspace apps/web test:coverage`)
