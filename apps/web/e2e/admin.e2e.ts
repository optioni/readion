import { expect, test } from '@playwright/test'
import {
  ADMIN_USER_ID,
  AUDIT_LOG_ROLE_CHANGE_ID,
  CERT_CODE,
  CERT_ID,
  mockAdmin,
  PROMOTE_USER_ID,
  QUARANTINE_ITEM_A_ID,
  QUARANTINE_ITEM_B_ID,
  SOURCE_ENABLED_ID,
} from './support/admin-seed'
import { gotoAuthenticated } from './support/session-view-seed'

// ============================================================================
// web-admin — acceptance test (outer-loop RED).
//
// Drives the real apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil) — see
// design.md Test Boundaries. No running NestJS API or Postgres is required (frontend-only change).
//
// CONTRACT FOR LATER IMPLEMENTER GROUPS: the routes, role gate, consumed endpoints, and the
// data-testids asserted below are the contract the implementation must satisfy. Keep them in sync.
//
// Routes under test (all under /admin/**, behind a non-global admin-role route middleware)
//   /admin                         → redirects to the default section (Certifications)
//   /admin/users                   → Users management
//   /admin/audit-logs              → Audit Log (read-only)
//   /admin/sources                 → Content sources per certification
//   /admin/certifications          → Certifications list + re-verification due list
//   /admin/certifications/new      → Cert setup wizard (discover → extract → submit draft)
//   /admin/review-queue            → quarantine review (list + approve/reject)
//
// Role gate
//   Signed-in non-admin (role: 'user') hitting /admin/** is redirected to '/'. (Unauthenticated →
//   login, covered by the shared auth middleware.) Admin role is read from /users/me `role`.
//
// Consumed endpoints (future Orval methods)
//   GET  /api/v1/admin/users                              ({ data: AdminUserListItem[], meta })
//   POST /api/v1/admin/users/:id/promote | :id/demote     (demote 409 = last admin)
//   GET  /api/v1/admin/audit-logs                         ({ data: AuditLogEntry[], meta })
//   GET  /api/v1/admin/content-sources?certificationId=   ({ data: ContentSourceResponse[], meta })
//   POST /api/v1/admin/content-sources                    ({ certificationId, type, url })
//   POST /api/v1/admin/content-sources/:id/enable|disable|reingest
//   GET  /api/v1/admin/content-sources/:id/jobs           ({ data: IngestionJobStatus[] })
//   POST /api/v1/admin/certifications/discover-sources    ({ name, code? })
//   POST /api/v1/admin/certifications/extract             ({ name, code?, confirmedSourceUrl })
//   GET  /api/v1/admin/certifications/extractions/:jobId  ({ data: ExtractionStatusResponse })
//   GET  /api/v1/admin/certifications/due-for-reverification
//   POST /api/v1/admin/certifications                     (creates a DRAFT — no publish)
//   POST /api/v1/admin/certifications/:id/reverify
//   GET  /api/v1/admin/quarantine?status=                  ({ data: QuarantinedItemListItem[], meta })
//   GET  /api/v1/admin/quarantine/:id                      ({ data: QuarantinedItemDetail }) — content: null | {...}
//   POST /api/v1/admin/quarantine/:id/approve | :id/reject ({ data: { id, status } })
//   GET  /api/v1/certifications/:id  &  :id/coverage       (read-only)
//
// Key data-testids (the contract for the implementer groups)
//   Shell / nav   : admin-console, admin-sidebar,
//                   admin-nav-certifications, admin-nav-review-queue, admin-nav-sources,
//                   admin-nav-users, admin-nav-audit-log, admin-nav-settings (links to /settings)
//   Users         : admin-users-page, admin-user-row (data-user-id), user-avatar (initials),
//                   user-name (placeholder), user-email, user-role (Capitalized), user-joined,
//                   user-last-active (placeholder), user-enrollments (Certs column), user-search,
//                   user-invite-btn (disabled placeholder), user-summary (`N users · M admins`),
//                   promote-user-btn OR demote-user-btn (single contextual toggle, never both),
//                   user-remove-btn (disabled placeholder), demote-error;
//                   user-delete-btn MUST be absent (removal is the disabled user-remove-btn)
//   Audit Log     : admin-audit-log-page, audit-log-row, audit-actor (actorEmail / System
//                   fallback, NOT a raw UUID), audit-target (targetLabel), audit-change (scalar
//                   `before → after` diff, NOT JSON.stringify), audit-action;
//                   audit-export-btn / audit-edit-btn MUST be absent
//   Sources       : admin-sources-page, source-cert-pill (data-cert-id, aria-pressed), source-row
//                   (data-source-id), source-enabled-toggle (aria-checked), source-last-ingested,
//                   source-chunk-count, source-status-pill, add-source-toggle (dashed affordance
//                   revealing the form), register-source-url-input, register-source-type-select,
//                   register-source-submit, source-reingest-btn, source-disable-btn,
//                   sources-empty-state (no certification selected); source-cert-select /
//                   source-cancel-btn / source-upload-input MUST be absent
//   Cert setup    : admin-cert-setup-page, discover-name-input, discover-code-input,
//                   discover-submit-btn, source-candidate (data-url), manual-url-input,
//                   confirm-source-btn, extraction-field-passingScore (grounded value + citation),
//                   extraction-field-questionCount (unverified — "confirm manually"),
//                   cert-name-input, cert-provider-input, cert-code-input, submit-draft-btn,
//                   cert-coverage (read-only); publish-cert-btn MUST be absent
//   Re-verify     : admin-certifications-page, due-reverification-row (data-cert-id),
//                   reverify-btn, reverify-diff, reverify-submit-btn
//   Review queue  : admin-review-queue-page, review-queue-item (data-item-id, selectable list row),
//                   review-queue-empty (no pending items left);
//                   review-queue-placeholder MUST be absent (queue is backed by the API)
//   Review detail : two-pane master-detail — selecting a review-queue-item loads its detail via
//                   GET /api/v1/admin/quarantine/:id and renders it in the right-hand pane.
//                   review-queue-detail (loaded pane root), review-queue-detail-empty (no selection —
//                   default state, and the state Approve/Reject return to on success),
//                   review-queue-detail-loading (fetch in flight),
//                   review-queue-detail-no-content (content: null graceful-degradation state),
//                   review-queue-question, review-queue-option (data-answer-key="true" on the option
//                   matching the stored answer key), review-queue-answer-key,
//                   review-queue-verdict (HUMAN-FORMATTED pass/fail label + score % + reason — no raw
//                   JSON anywhere in the DOM), review-queue-reason, review-queue-provenance,
//                   approve-item-btn, reject-item-btn (both live in the detail pane, not the row)
// ============================================================================

test.describe('web-admin — admin console', () => {
  test('admin opens the console: sidebar nav + section routing render', async ({ page }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin')

    await expect(page.getByTestId('admin-console')).toBeVisible()
    await expect(page.getByTestId('admin-sidebar')).toBeVisible()
    await expect(page.getByTestId('admin-nav-certifications')).toBeVisible()
    await expect(page.getByTestId('admin-nav-review-queue')).toBeVisible()
    await expect(page.getByTestId('admin-nav-sources')).toBeVisible()
    await expect(page.getByTestId('admin-nav-users')).toBeVisible()
    await expect(page.getByTestId('admin-nav-audit-log')).toBeVisible()
    await expect(page.getByTestId('admin-nav-settings')).toHaveAttribute('href', '/settings')
  })

  test('role gate: a signed-in non-admin is bounced off /admin/** to /', async ({ page }) => {
    mockAdmin(page, { role: 'user' })

    await gotoAuthenticated(page, '/admin/users')

    // Bounced off the admin area entirely (redirect target is '/').
    await expect(page).not.toHaveURL(/\/admin(\/|$)/)
    await expect(page.getByTestId('admin-console')).toHaveCount(0)
    await expect(page.getByTestId('admin-users-page')).toHaveCount(0)
  })

  test('users: promote a user, demote blocked on the last admin (409)', async ({ page }) => {
    const handles = mockAdmin(page)

    await gotoAuthenticated(page, '/admin/users')

    await expect(page.getByTestId('admin-users-page')).toBeVisible()
    // Search + Invite render as deferred placeholders (contract fields don't exist yet); no
    // stray user-delete-btn testid (removal is a disabled user-remove-btn, not a live action).
    await expect(page.getByTestId('user-search')).toBeVisible()
    await expect(page.getByTestId('user-invite-btn')).toBeDisabled()
    await expect(page.getByTestId('user-delete-btn')).toHaveCount(0)

    const promoteRow = page.locator(
      `[data-testid="admin-user-row"][data-user-id="${PROMOTE_USER_ID}"]`,
    )
    await expect(promoteRow.getByTestId('user-email')).toContainText('casey@org.io')
    await expect(promoteRow.getByTestId('user-avatar')).toBeVisible()
    await promoteRow.getByTestId('promote-user-btn').click()
    await expect.poll(() => handles.promotedUserIds.at(-1)).toBe(PROMOTE_USER_ID)

    const adminRow = page.locator(`[data-testid="admin-user-row"][data-user-id="${ADMIN_USER_ID}"]`)
    await adminRow.getByTestId('demote-user-btn').click()
    await expect.poll(() => handles.demotedUserIds.at(-1)).toBe(ADMIN_USER_ID)
    await expect(page.getByTestId('demote-error')).toBeVisible()
    // Last admin stays admin after the 409.
    await expect(adminRow.getByTestId('user-role')).toContainText('Admin')
  })

  test('audit log: read-only render, human-readable actor/target/diff, no edit/export', async ({
    page,
  }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin/audit-logs')

    await expect(page.getByTestId('admin-audit-log-page')).toBeVisible()
    const row = page.getByTestId('audit-log-row').first()
    await expect(row).toBeVisible()
    await expect(row.getByTestId('audit-action')).toContainText('user.promote')
    // Actor renders the resolved human email, never the raw actor UUID.
    await expect(row.getByTestId('audit-actor')).toContainText('root@readion.io')
    await expect(row.getByTestId('audit-actor')).not.toContainText(ADMIN_USER_ID)
    // Target renders the human label (the promoted user's email), not `targetType · uuid`.
    await expect(row.getByTestId('audit-target')).toContainText('casey@org.io')
    await expect(row.getByTestId('audit-target')).not.toContainText(PROMOTE_USER_ID)
    // Change renders a scalar before → after diff, never raw JSON.stringify braces.
    await expect(row.getByTestId('audit-change')).toContainText('user → admin')
    await expect(row.getByTestId('audit-change')).not.toContainText('{')
    await expect(page.getByTestId('audit-export-btn')).toHaveCount(0)
    await expect(page.getByTestId('audit-edit-btn')).toHaveCount(0)
  })

  test('sources: no cert selected shows empty state, no floating headers', async ({ page }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin/sources')

    await expect(page.getByTestId('admin-sources-page')).toBeVisible()
    await expect(page.getByTestId('sources-empty-state')).toContainText(
      'Select a certification to view its sources',
    )
    await expect(page.locator('table')).toHaveCount(0)
    // Certification pills still render so the user can pick one — not a <select>.
    await expect(page.getByTestId('source-cert-select')).toHaveCount(0)
    await expect(page.getByTestId('source-cert-pill').first()).toBeVisible()
  })

  test('sources: cert pills, add-source affordance, re-ingest, Enabled toggle disable', async ({
    page,
  }) => {
    const handles = mockAdmin(page)

    await gotoAuthenticated(page, `/admin/sources?certificationId=${CERT_ID}`)

    await expect(page.getByTestId('admin-sources-page')).toBeVisible()
    // Certification selection is a pill, not a <select>; the active cert's pill is pressed.
    await expect(page.getByTestId('source-cert-select')).toHaveCount(0)
    const activeCertPill = page.locator(
      `[data-testid="source-cert-pill"][data-cert-id="${CERT_ID}"]`,
    )
    await expect(activeCertPill).toHaveAttribute('aria-pressed', 'true')

    await expect(page.getByTestId('source-row').first()).toBeVisible()
    await expect(page.getByTestId('source-status-pill').first()).toBeVisible()
    // Real chunk counts and last-ingested dates render; no cancel, no upload — URL registration only.
    await expect(page.getByTestId('source-chunk-count').first()).toBeVisible()
    await expect(page.getByTestId('source-last-ingested').first()).toBeVisible()
    await expect(page.getByTestId('source-cancel-btn')).toHaveCount(0)
    await expect(page.getByTestId('source-upload-input')).toHaveCount(0)

    // Registration sits behind the dashed "Add source" affordance until activated.
    await expect(page.getByTestId('register-source-url-input')).toHaveCount(0)
    await page.getByTestId('add-source-toggle').click()
    await page.getByTestId('register-source-url-input').fill('https://example.com/study-guide')
    await page.getByTestId('register-source-type-select').selectOption('web')
    await page.getByTestId('register-source-submit').click()
    await expect
      .poll(() => handles.contentSourceCreates.at(-1))
      .toMatchObject({
        certificationId: CERT_ID,
        type: 'web',
        url: 'https://example.com/study-guide',
      })

    const enabledRow = page.locator(
      `[data-testid="source-row"][data-source-id="${SOURCE_ENABLED_ID}"]`,
    )
    await enabledRow.getByTestId('source-reingest-btn').click()
    await expect.poll(() => handles.reingestSourceIds.at(-1)).toBe(SOURCE_ENABLED_ID)

    // The Enabled toggle reflects `enabled` and disabling via it maps to POST :id/disable.
    await expect(enabledRow.getByTestId('source-enabled-toggle')).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await enabledRow.getByTestId('source-enabled-toggle').click()
    await expect.poll(() => handles.disabledSourceIds.at(-1)).toBe(SOURCE_ENABLED_ID)

    await enabledRow.getByTestId('source-disable-btn').click()
    await expect.poll(() => handles.disabledSourceIds.at(-1)).toBe(SOURCE_ENABLED_ID)
  })

  test('cert setup wizard: identify → confirm source → grounded+unverified extraction → draft → coverage (5 steps)', async ({
    page,
  }) => {
    const handles = mockAdmin(page)

    await gotoAuthenticated(page, '/admin/certifications/new')

    await expect(page.getByTestId('admin-cert-setup-page')).toBeVisible()

    // Step 1 — standalone Identify certification screen: name, required mono code + hint,
    // certifying body, optional known URL, then "Search for sources →" kicks off discovery.
    await expect(page.getByTestId('cert-identify-step')).toBeVisible()
    await expect(page.getByTestId('setup-header-step-indicator')).toContainText('Step 1 of 5')
    await page
      .getByTestId('identify-name-input')
      .fill('AWS Certified Solutions Architect — Associate')
    await page.getByTestId('identify-code-input').fill('SAA-C03')
    await page.getByTestId('identify-provider-input').fill('Amazon Web Services')
    await expect(page.getByTestId('identify-code-hint')).toBeVisible()
    await expect(page.getByTestId('identify-search-btn')).toBeDisabled()
    await page.getByTestId('identify-provider-input').fill('Amazon Web Services')
    await expect(page.getByTestId('identify-search-btn')).toBeEnabled()
    await page.getByTestId('identify-search-btn').click()
    await expect
      .poll(() => handles.discoverBodies.at(-1))
      .toMatchObject({ name: 'AWS Certified Solutions Architect — Associate', code: 'SAA-C03' })

    // Step 2 — a SEPARATE source-confirmation step (not the identify screen).
    await expect(page.getByTestId('cert-confirm-step')).toBeVisible()
    await expect(page.getByTestId('cert-identify-step')).toHaveCount(0)
    await expect(page.getByTestId('setup-header-step-indicator')).toContainText('Step 2 of 5')
    const candidate = page.getByTestId('source-candidate').first()
    await expect(candidate).toBeVisible()
    await candidate.click()
    await page.getByTestId('confirm-source-btn').click()
    await expect
      .poll(() => handles.extractBodies.at(-1))
      .toMatchObject({
        name: 'AWS Certified Solutions Architect — Associate',
        confirmedSourceUrl:
          'https://aws.amazon.com/certification/certified-solutions-architect-associate/',
      })

    // Step 3 — field extraction (kept intact): one grounded field (passingScore) + one
    // unverified (questionCount).
    await expect(page.getByTestId('setup-header-step-indicator')).toContainText('Step 3 of 5')
    await expect(page.getByTestId('extraction-field-passingScore')).toContainText('67')
    await expect(page.getByTestId('extraction-field-questionCount')).toContainText(
      /confirm manually/i,
    )

    // Identity fields arrive pre-filled from step 1 (no re-entry needed); code stays untouched.
    await expect(page.getByTestId('cert-name-input')).toHaveValue(
      'AWS Certified Solutions Architect — Associate',
    )
    await expect(page.getByTestId('cert-provider-input')).toHaveValue('Amazon Web Services')
    await page.getByTestId('cert-provider-input').fill('AWS')

    // No Publish button — submitting creates a DRAFT only.
    await expect(page.getByTestId('publish-cert-btn')).toHaveCount(0)
    await page.getByTestId('submit-draft-btn').click()
    await expect
      .poll(() => handles.certificationCreates.at(-1))
      .toMatchObject({
        name: 'AWS Certified Solutions Architect — Associate',
        provider: 'AWS',
        code: 'SAA-C03',
      })

    // Coverage renders read-only after the draft is created — step 4 of 5.
    await expect(page.getByTestId('setup-header-step-indicator')).toContainText('Step 4 of 5')
    await expect(page.getByTestId('cert-coverage')).toBeVisible()
  })

  test('re-verification: pick a due cert, diff client-side, reverify', async ({ page }) => {
    const handles = mockAdmin(page)

    await gotoAuthenticated(page, '/admin/certifications')

    await expect(page.getByTestId('admin-certifications-page')).toBeVisible()
    const dueRow = page.locator(`[data-testid="due-reverification-row"][data-cert-id="${CERT_ID}"]`)
    await expect(dueRow).toBeVisible()
    await dueRow.getByTestId('reverify-btn').click()

    await expect(page.getByTestId('reverify-diff')).toBeVisible()
    await page.getByTestId('reverify-submit-btn').click()
    await expect.poll(() => handles.reverifyBodies.at(-1)?.id).toBe(CERT_ID)
  })

  test('review queue: two-pane master-detail — select an item, resolve it via Approve/Reject', async ({
    page,
  }) => {
    const handles = mockAdmin(page)

    await gotoAuthenticated(page, '/admin/review-queue')

    await expect(page.getByTestId('admin-review-queue-page')).toBeVisible()
    await expect(page.getByTestId('review-queue-placeholder')).toHaveCount(0)
    await expect(page.getByTestId('review-queue-item')).toHaveCount(2)

    // No item selected yet: the detail pane shows its empty prompt and no detail request is made.
    await expect(page.getByTestId('review-queue-detail-empty')).toBeVisible()
    await expect(page.getByTestId('review-queue-detail')).toHaveCount(0)
    expect(handles.quarantineDetailRequestedIds).toHaveLength(0)

    // Selecting item A loads its detail via GET /api/v1/admin/quarantine/:id.
    const rowA = page.locator(
      `[data-testid="review-queue-item"][data-item-id="${QUARANTINE_ITEM_A_ID}"]`,
    )
    await rowA.click()
    await expect.poll(() => handles.quarantineDetailRequestedIds.at(-1)).toBe(QUARANTINE_ITEM_A_ID)

    const detail = page.getByTestId('review-queue-detail')
    await expect(detail).toBeVisible()
    await expect(detail.getByTestId('review-queue-detail-empty')).toHaveCount(0)

    // The question + options + marked answer key render — the stacked-card UI rendered none of this.
    await expect(detail.getByTestId('review-queue-question')).toContainText(
      'Which AWS service provides scalable object storage?',
    )
    await expect(detail.getByTestId('review-queue-option')).toHaveCount(4)
    const markedOption = detail.locator(
      '[data-testid="review-queue-option"][data-answer-key="true"]',
    )
    await expect(markedOption).toHaveCount(1)
    await expect(markedOption).toContainText('Amazon S3')
    await expect(detail.getByTestId('review-queue-answer-key')).toContainText('Amazon S3')

    // The verdict is human-formatted (pass/fail label + score % + reason) — never raw JSON.
    await expect(detail.getByTestId('review-queue-verdict')).toContainText(/fail/i)
    await expect(detail.getByTestId('review-queue-verdict')).toContainText('20%')
    await expect(detail.getByTestId('review-queue-verdict')).toContainText(
      'The answer key is incorrect',
    )
    await expect(detail.getByTestId('review-queue-provenance')).toContainText('chunk-1')
    await expect(page.locator('body')).not.toContainText('{"pass":false')
    await expect(page.locator('body')).not.toContainText('"score":0.2')

    // Approve item A from the detail pane — it leaves the pending queue and the pane resets to empty.
    await detail.getByTestId('approve-item-btn').click()
    await expect.poll(() => handles.approvedQuarantineIds.at(-1)).toBe(QUARANTINE_ITEM_A_ID)
    await expect(page.getByTestId('review-queue-item')).toHaveCount(1)
    await expect(page.getByTestId('review-queue-detail-empty')).toBeVisible()
    await expect(page.getByTestId('review-queue-detail')).toHaveCount(0)

    // Select and reject item B — the queue then empties.
    const rowB = page.locator(
      `[data-testid="review-queue-item"][data-item-id="${QUARANTINE_ITEM_B_ID}"]`,
    )
    await rowB.click()
    await expect.poll(() => handles.quarantineDetailRequestedIds.at(-1)).toBe(QUARANTINE_ITEM_B_ID)
    await expect(page.getByTestId('review-queue-detail')).toBeVisible()

    await page.getByTestId('reject-item-btn').click()
    await expect.poll(() => handles.rejectedQuarantineIds.at(-1)).toBe(QUARANTINE_ITEM_B_ID)
    await expect(page.getByTestId('review-queue-item')).toHaveCount(0)
    await expect(page.getByTestId('review-queue-empty')).toBeVisible()
    await expect(page.getByTestId('review-queue-detail-empty')).toBeVisible()
  })
})

// ============================================================================
// fix-web-admin-parity — acceptance test (outer-loop RED/GREEN).
//
// Section 0 of design.md: presentational + one flow-restructure fixes across the seven admin
// surfaces, reconciled against the app's real data (no API/DB changes). See design.md's
// reconciliation table for what's fixed here vs descoped to a named backend/contract follow-up.
// ============================================================================

test.describe('fix-web-admin-parity — acceptance', () => {
  test('certifications list: surface cards, error Retry, and the re-verify modal overlay', async ({
    page,
  }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin/certifications')

    await expect(page.getByTestId('admin-certifications-page')).toBeVisible()
    // Tables render inside surface cards, not bare <table> elements.
    await expect(page.getByTestId('admin-table-shell').first()).toBeVisible()
    await expect(page.getByTestId('existing-certs-section-label')).toContainText(
      'Existing certifications',
    )

    const dueRow = page.locator(`[data-testid="due-reverification-row"][data-cert-id="${CERT_ID}"]`)
    await dueRow.getByTestId('reverify-btn').click()

    // The diff opens as a CENTERED MODAL OVERLAY over a dimmed list, not an inline appended
    // section — the list stays present underneath the backdrop.
    await expect(page.getByTestId('reverify-diff-backdrop')).toBeVisible()
    await expect(page.getByTestId('reverify-diff-modal')).toBeVisible()
    await expect(page.getByTestId('admin-certifications-page')).toBeVisible()
  })

  test('cert-setup: a distinct Identify step with a certifying-body field and an upfront known URL', async ({
    page,
  }) => {
    const handles = mockAdmin(page)

    await gotoAuthenticated(page, '/admin/certifications/new')

    await expect(page.getByTestId('cert-identify-step')).toBeVisible()
    await expect(page.getByTestId('identify-provider-input')).toBeVisible()
    await expect(page.getByTestId('identify-known-url-input')).toBeVisible()

    await page.getByTestId('identify-name-input').fill('Certified Kubernetes Security Specialist')
    await page.getByTestId('identify-code-input').fill('CKS')
    await page.getByTestId('identify-provider-input').fill('CNCF / Linux Foundation')
    await page
      .getByTestId('identify-known-url-input')
      .fill('https://training.linuxfoundation.org/certification/cks/')
    await page.getByTestId('identify-search-btn').click()

    await expect
      .poll(() => handles.discoverBodies.at(-1))
      .toMatchObject({ name: 'Certified Kubernetes Security Specialist', code: 'CKS' })

    // Advances to a SEPARATE source-confirmation step — 5 steps total.
    await expect(page.getByTestId('cert-identify-step')).toHaveCount(0)
    await expect(page.getByTestId('cert-confirm-step')).toBeVisible()
    await expect(page.getByTestId('setup-header-step-indicator')).toContainText('of 5')
  })

  test('cert re-verification: the dedicated route renders a full-height screen with the stale pill and a colored diff', async ({
    page,
  }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, `/admin/certifications/${CERT_CODE}/re-verify`)

    await expect(page.getByTestId('admin-cert-reverify-page')).toBeVisible()
    await expect(page.getByTestId('reverify-stale-pill')).toContainText(/stale/i)
    await expect(page.getByTestId('reverify-breadcrumb')).toContainText(CERT_CODE)

    const changedRow = page.getByTestId(/^reverify-diff-row-/).first()
    await expect(changedRow).toBeVisible()
    await expect(page.getByTestId('reverify-col-current')).toContainText(/outdated/i)
    await expect(page.getByTestId('reverify-col-proposed')).toContainText(/new guide/i)
    // The stray extraction-step "(unverified)" annotation does not leak into this diff.
    await expect(page.locator('body')).not.toContainText('(unverified)')
  })

  test('review queue: the detail pane renders source evidence quoted from supportingSpans', async ({
    page,
  }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin/review-queue')

    const rowA = page.locator(
      `[data-testid="review-queue-item"][data-item-id="${QUARANTINE_ITEM_A_ID}"]`,
    )
    await rowA.click()

    const evidence = page.getByTestId('review-queue-evidence-card')
    await expect(evidence).toBeVisible()
    await expect(evidence).toContainText('Amazon EC2 provides scalable computing capacity')
    // The list row shows the question-text snippet, not the domain tag.
    await expect(rowA).toContainText('Which AWS service provides scalable object storage?')
  })

  test('sources: the running-job banner renders live percentage and ETA from the progress field', async ({
    page,
  }) => {
    mockAdmin(page, { activeIngestion: true })

    await gotoAuthenticated(page, `/admin/sources?certificationId=${CERT_ID}`)

    const banner = page.getByTestId('source-jobs-banner')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('72%')
  })

  test('users: the search field filters the loaded list client-side', async ({ page }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin/users')

    await expect(page.getByTestId('admin-user-row')).toHaveCount(3)
    await page.getByTestId('user-search').fill('casey')
    await expect(page.getByTestId('admin-user-row')).toHaveCount(1)
    await expect(page.getByTestId('user-email')).toContainText('casey@org.io')
  })

  test('audit log: separate Before/After columns and the append-only caption', async ({ page }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin/audit-logs')

    await expect(page.getByTestId('admin-audit-log-caption')).toContainText('Append-only')
    const row = page.locator(
      `[data-testid="audit-log-row"][data-audit-id="${AUDIT_LOG_ROLE_CHANGE_ID}"]`,
    )
    await expect(row.getByTestId('audit-before')).toContainText('user')
    await expect(row.getByTestId('audit-after')).toContainText('admin')
  })
})
