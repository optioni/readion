import { expect, test } from '@playwright/test'
import {
  ADMIN_USER_ID,
  AUDIT_LOG_CERT_ACTION_ID,
  AUDIT_LOG_ROLE_CHANGE_ID,
  mockAdmin,
  PROMOTE_USER_ID,
} from './support/admin-seed'
import { gotoAuthenticated } from './support/session-view-seed'

// ============================================================================
// fix-admin-console — acceptance test (outer-loop RED).
//
// Drives the real apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil), mirroring
// admin.e2e.ts — see design.md Test Boundaries. No running NestJS API or Postgres is required for
// this frontend-only e2e; the audit-logs contract fields are pinned separately by the NestJS
// integration test (apps/api/src/admin/admin.acceptance.spec.ts).
//
// CONTRACT FOR LATER IMPLEMENTER GROUPS — pins the defects fixed by this change:
//   - Audit Log rows must render `actorEmail` (not the raw `userId`) and a human `targetLabel` (not
//     `targetType · targetId`), plus a scalar `before → after` diff (never raw `JSON.stringify`).
//   - The admin area renders inside the `AdminSidebar` chrome ONLY — no nested learner/study nav
//     (`app-sidebar` must not appear on an admin route). The chrome adds an `admin-sidebar-eyebrow`
//     reading "ADMIN", a per-item leading icon (svg) on every `admin-nav-*` item, a numeric
//     `admin-nav-review-queue-badge` equal to the pending quarantine count, and an `admin-session-card`
//     showing the signed-in admin's email.
//   - `/admin` redirects to `/admin/certifications` (no longer a bare stub).
//   - Users and Audit Log both render a pagination control (`admin-users-pagination` /
//     `admin-audit-log-pagination`) when `meta` reports more than one page.
// ============================================================================

test.describe('fix-admin-console — acceptance', () => {
  test('audit log: actor email, human target label, and scalar before → after (no raw JSON/UUIDs)', async ({
    page,
  }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin/audit-logs')

    await expect(page.getByTestId('admin-audit-log-page')).toBeVisible()
    await expect(page.getByTestId('audit-log-row')).toHaveCount(2)

    // Role-change entry: actor + target resolved to human email, scalar `user → admin` diff.
    const roleChangeRow = page.locator(
      `[data-testid="audit-log-row"][data-audit-id="${AUDIT_LOG_ROLE_CHANGE_ID}"]`,
    )
    await expect(roleChangeRow.getByTestId('audit-actor')).toContainText('root@readion.io')
    await expect(roleChangeRow.getByTestId('audit-actor')).not.toContainText(ADMIN_USER_ID)
    await expect(roleChangeRow.getByTestId('audit-target')).toContainText('casey@org.io')
    await expect(roleChangeRow.getByTestId('audit-target')).not.toContainText(PROMOTE_USER_ID)
    await expect(roleChangeRow.getByTestId('audit-target')).not.toContainText('user ·')
    await expect(roleChangeRow).toContainText('user → admin')
    await expect(roleChangeRow).not.toContainText('{')
    await expect(roleChangeRow).not.toContainText('}')

    // System-originated source/cert entry: null-actor fallback + a cert title target label + scalar
    // `draft → live` diff.
    const certActionRow = page.locator(
      `[data-testid="audit-log-row"][data-audit-id="${AUDIT_LOG_CERT_ACTION_ID}"]`,
    )
    await expect(certActionRow.getByTestId('audit-actor')).toContainText(/system|—/i)
    await expect(certActionRow.getByTestId('audit-target')).toContainText(
      'AWS Certified Solutions Architect',
    )
    await expect(certActionRow.getByTestId('audit-target')).not.toContainText('certification ·')
    await expect(certActionRow).toContainText('draft → live')
    await expect(certActionRow).not.toContainText('{')
    await expect(certActionRow).not.toContainText('}')
  })

  test('admin sidebar chrome: ADMIN eyebrow, per-item icons, review-queue badge, admin-session card, no duplicate nav', async ({
    page,
  }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin/users')

    await expect(page.getByTestId('admin-sidebar')).toHaveCount(1)
    await expect(page.getByTestId('admin-sidebar-eyebrow')).toHaveText(/ADMIN/)

    for (const item of [
      'certifications',
      'review-queue',
      'sources',
      'users',
      'audit-log',
      'settings',
    ]) {
      await expect(page.getByTestId(`admin-nav-${item}`).locator('svg')).toHaveCount(1)
    }

    // Both fixture quarantine items are pending — the badge must reflect that count.
    await expect(page.getByTestId('admin-nav-review-queue-badge')).toHaveText('2')
    await expect(page.getByTestId('admin-session-card')).toContainText('root@readion.io')

    // The admin console is the SOLE nav — no nested learner/study sidebar around it.
    await expect(page.getByTestId('app-sidebar')).toHaveCount(0)
  })

  test('/admin redirects to the certifications landing', async ({ page }) => {
    mockAdmin(page)

    await gotoAuthenticated(page, '/admin')

    await expect(page).toHaveURL(/\/admin\/certifications$/)
    await expect(page.getByTestId('admin-certifications-page')).toBeVisible()
  })

  test('pagination: Users and Audit Log render a pagination control when meta reports more than one page', async ({
    page,
  }) => {
    mockAdmin(page, { manyPages: true })

    await gotoAuthenticated(page, '/admin/users')
    await expect(page.getByTestId('admin-users-page')).toBeVisible()
    await expect(page.getByTestId('admin-users-pagination')).toBeVisible()

    await gotoAuthenticated(page, '/admin/audit-logs')
    await expect(page.getByTestId('admin-audit-log-page')).toBeVisible()
    await expect(page.getByTestId('admin-audit-log-pagination')).toBeVisible()
  })
})
