import { expect, test } from '@playwright/test'
import {
  ADMIN_USER_ID,
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
//   POST /api/v1/admin/quarantine/:id/approve | :id/reject ({ data: { id, status } })
//   GET  /api/v1/certifications/:id  &  :id/coverage       (read-only)
//
// Key data-testids (the contract for the implementer groups)
//   Shell / nav   : admin-console, admin-sidebar,
//                   admin-nav-certifications, admin-nav-review-queue, admin-nav-sources,
//                   admin-nav-users, admin-nav-audit-log, admin-nav-settings (links to /settings)
//   Users         : admin-users-page, admin-user-row (data-user-id), user-avatar (initials),
//                   user-email, user-role, promote-user-btn, demote-user-btn, demote-error;
//                   user-search / user-invite / user-delete / user-last-active MUST be absent
//   Audit Log     : admin-audit-log-page, audit-log-row, audit-actor (userId, NOT email),
//                   audit-action; audit-export-btn / audit-edit-btn MUST be absent
//   Sources       : admin-sources-page, source-row (data-source-id), source-status-pill,
//                   register-source-url-input, register-source-type-select, register-source-submit,
//                   source-reingest-btn, source-disable-btn; source-chunk-count / source-cancel-btn /
//                   source-upload-input MUST be absent
//   Cert setup    : admin-cert-setup-page, discover-name-input, discover-code-input,
//                   discover-submit-btn, source-candidate (data-url), manual-url-input,
//                   confirm-source-btn, extraction-field-passingScore (grounded value + citation),
//                   extraction-field-questionCount (unverified — "confirm manually"),
//                   cert-name-input, cert-provider-input, cert-code-input, submit-draft-btn,
//                   cert-coverage (read-only); publish-cert-btn MUST be absent
//   Re-verify     : admin-certifications-page, due-reverification-row (data-cert-id),
//                   reverify-btn, reverify-diff, reverify-submit-btn
//   Review queue  : admin-review-queue-page, review-queue-item (data-item-id),
//                   review-queue-verdict, review-queue-reason, review-queue-provenance,
//                   approve-item-btn, reject-item-btn, review-queue-empty;
//                   review-queue-placeholder MUST be absent (queue is backed by the API)
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
    // No name/search/invite/delete controls — promote/demote only.
    await expect(page.getByTestId('user-search')).toHaveCount(0)
    await expect(page.getByTestId('user-invite-btn')).toHaveCount(0)
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
    await expect(adminRow.getByTestId('user-role')).toContainText('admin')
  })

  test('audit log: read-only render, actor shown as userId, no edit/export', async ({ page }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin/audit-logs')

    await expect(page.getByTestId('admin-audit-log-page')).toBeVisible()
    await expect(page.getByTestId('audit-log-row').first()).toBeVisible()
    await expect(page.getByTestId('audit-action').first()).toContainText('user.promote')
    await expect(page.getByTestId('audit-actor').first()).toContainText(ADMIN_USER_ID)
    await expect(page.getByTestId('audit-export-btn')).toHaveCount(0)
    await expect(page.getByTestId('audit-edit-btn')).toHaveCount(0)
  })

  test('sources: list per cert, register by URL, re-ingest, disable', async ({ page }) => {
    const handles = mockAdmin(page)

    await gotoAuthenticated(page, `/admin/sources?certificationId=${CERT_ID}`)

    await expect(page.getByTestId('admin-sources-page')).toBeVisible()
    await expect(page.getByTestId('source-row').first()).toBeVisible()
    await expect(page.getByTestId('source-status-pill').first()).toBeVisible()
    // No chunk count, no cancel, no upload — URL registration only.
    await expect(page.getByTestId('source-chunk-count')).toHaveCount(0)
    await expect(page.getByTestId('source-cancel-btn')).toHaveCount(0)
    await expect(page.getByTestId('source-upload-input')).toHaveCount(0)

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

    await enabledRow.getByTestId('source-disable-btn').click()
    await expect.poll(() => handles.disabledSourceIds.at(-1)).toBe(SOURCE_ENABLED_ID)
  })

  test('cert setup wizard: discover → confirm source → grounded+unverified extraction → draft → coverage', async ({
    page,
  }) => {
    const handles = mockAdmin(page)

    await gotoAuthenticated(page, '/admin/certifications/new')

    await expect(page.getByTestId('admin-cert-setup-page')).toBeVisible()

    // Step 1 — discover sources.
    await page
      .getByTestId('discover-name-input')
      .fill('AWS Certified Solutions Architect — Associate')
    await page.getByTestId('discover-code-input').fill('SAA-C03')
    await page.getByTestId('discover-submit-btn').click()
    await expect
      .poll(() => handles.discoverBodies.at(-1))
      .toMatchObject({ name: 'AWS Certified Solutions Architect — Associate', code: 'SAA-C03' })

    // Candidates render selectable; confirm exactly one (no confidence badge).
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

    // Step 2 — poll extraction: one grounded field (passingScore) + one unverified (questionCount).
    await expect(page.getByTestId('extraction-field-passingScore')).toContainText('67')
    await expect(page.getByTestId('extraction-field-questionCount')).toContainText(
      /confirm manually/i,
    )

    // Admin enters identity fields (no invented fields).
    await page.getByTestId('cert-name-input').fill('AWS Certified Solutions Architect — Associate')
    await page.getByTestId('cert-provider-input').fill('AWS')
    await page.getByTestId('cert-code-input').fill('SAA-C03')

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

    // Coverage renders read-only after the draft is created.
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

  test('review queue: lists quarantined items, approves one and rejects another', async ({
    page,
  }) => {
    const handles = mockAdmin(page)

    await gotoAuthenticated(page, '/admin/review-queue')

    await expect(page.getByTestId('admin-review-queue-page')).toBeVisible()
    await expect(page.getByTestId('review-queue-placeholder')).toHaveCount(0)
    await expect(page.getByTestId('review-queue-item')).toHaveCount(2)

    const rowA = page.locator(
      `[data-testid="review-queue-item"][data-item-id="${QUARANTINE_ITEM_A_ID}"]`,
    )
    await expect(rowA.getByTestId('review-queue-reason')).toContainText('The answer key is incorrect')
    await expect(rowA.getByTestId('review-queue-verdict')).toBeVisible()
    await expect(rowA.getByTestId('review-queue-provenance')).toContainText('chunk-1')

    // Approve item A — it leaves the pending queue on the refetch.
    await rowA.getByTestId('approve-item-btn').click()
    await expect.poll(() => handles.approvedQuarantineIds.at(-1)).toBe(QUARANTINE_ITEM_A_ID)
    await expect(page.getByTestId('review-queue-item')).toHaveCount(1)

    // Reject item B — the queue then empties.
    const rowB = page.locator(
      `[data-testid="review-queue-item"][data-item-id="${QUARANTINE_ITEM_B_ID}"]`,
    )
    await rowB.getByTestId('reject-item-btn').click()
    await expect.poll(() => handles.rejectedQuarantineIds.at(-1)).toBe(QUARANTINE_ITEM_B_ID)
    await expect(page.getByTestId('review-queue-item')).toHaveCount(0)
    await expect(page.getByTestId('review-queue-empty')).toBeVisible()
  })
})
