import { expect, test } from '@playwright/test'
import {
  mockProgressLoop,
  mockProgressNotCalibrated,
  mockProgressNotFound,
  NOT_OWNED_ENROLLMENT_ID,
  PROGRESS_IDS,
} from './support/progress-seed'
import { gotoAuthenticated } from './support/session-view-seed'

// ============================================================================
// web-progress — acceptance test (outer-loop RED).
//
// Drives the real apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil) — see
// design.md Test Boundaries. No running NestJS API or Postgres is required.
//
// CONTRACT FOR LATER IMPLEMENTER GROUPS (2–5): the routes and data-testids asserted below are the
// contract the implementation must satisfy. Keep them in sync.
//
// Route under test
//   Progress page : /user-certifications/:id/progress
//
// Consumed endpoints (all already committed in apps/web/src/api/)
//   GET  /api/v1/user-certifications/:id/readiness
//   GET  /api/v1/user-certifications/:id/weak-areas
//   GET  /api/v1/user-certifications         (list — cert-switcher)
//   GET  /api/v1/user-certifications/:id     (detail)
//   GET  /api/v1/certifications/:id
//   GET  /api/v1/sessions?certificationId=…  (history table — study/review rows)
//   GET  /api/v1/sessions/:id/summary        (fan-out for trend + accuracy derivation)
//   GET  /api/v1/user-certifications/:id/mock-exams  (history table — mock/diagnostic rows)
//   POST /api/v1/user-certifications/:id/review/suppress-domain  (mark-as-mastered)
//
// Key data-testids
//   Page root           : progress-page, progress-cert-name
//   Charts              : readiness-trend, accuracy-bars
//   Trajectory          : trajectory-callout (hidden when not calibrated)
//   Not calibrated      : progress-not-calibrated
//   Domain rows         : progress-domain-row (one per certification.domains entry),
//                         domain-delta (visible for domains in latest summary.weakAreaDeltas),
//                         mark-mastered-button (one-way; triggers suppress-domain)
//   Session history     : progress-session-row (merged study/review + mock rows)
//   Cert switcher       : cert-switcher
//   Not found           : progress-not-found (no cert-detail-name visible)
// ============================================================================

test.describe('web-progress — progress page', () => {
  test('calibrated enrollment renders trend + accuracy + domain rows with deltas + trajectory + merged session history', async ({
    page,
  }) => {
    mockProgressLoop(page)

    await gotoAuthenticated(page, `/user-certifications/${PROGRESS_IDS.enrollmentId}/progress`)

    await expect(page.getByTestId('progress-page')).toBeVisible()
    await expect(page.getByTestId('progress-cert-name')).toContainText(/AWS/i)

    // Readiness trend and accuracy bar chart (derived from per-session summaries).
    await expect(page.getByTestId('readiness-trend')).toBeVisible()
    await expect(page.getByTestId('accuracy-bars')).toBeVisible()

    // Trajectory callout is visible and shows the weeks-to-ready derived from readiness.trajectory.
    await expect(page.getByTestId('trajectory-callout')).toBeVisible()
    await expect(page.getByTestId('trajectory-callout')).toContainText(/3\s*week/i)

    // Per-domain rows: one per certification.domains entry (CERTIFICATION1 has 4 domains).
    await expect(page.getByTestId('progress-domain-row')).toHaveCount(4)

    // Domain deltas are shown for domains present in the latest summary's weakAreaDeltas.
    // SUMMARY3 has deltas for Secure (+12 pp) and Resilient (-4 pp); the other two are absent.
    await expect(page.getByTestId('domain-delta').first()).toBeVisible()

    // Merged history table: 3 study sessions + 1 mock exam = 4 rows.
    await expect(page.getByTestId('progress-session-row')).toHaveCount(4)

    // Cert-switcher is visible (two enrollments seeded).
    await expect(page.getByTestId('cert-switcher')).toBeVisible()
  })

  test('cert-switcher re-scopes panels to the second enrollment', async ({ page }) => {
    mockProgressLoop(page)

    await gotoAuthenticated(page, `/user-certifications/${PROGRESS_IDS.enrollmentId}/progress`)

    await expect(page.getByTestId('progress-page')).toBeVisible()
    await expect(page.getByTestId('cert-switcher')).toBeVisible()

    // The switcher must list both enrollments. Clicking the Azure entry re-scopes the page.
    await page.getByTestId('cert-switcher').getByText(/Azure/i).click()

    // After switching, the page re-scopes: cert name changes and domain-row count drops to 2.
    await expect(page.getByTestId('progress-cert-name')).toContainText(/Azure/i)
    await expect(page.getByTestId('progress-domain-row')).toHaveCount(2)
  })

  test('not-yet-calibrated enrollment shows not-calibrated state and hides trajectory', async ({
    page,
  }) => {
    mockProgressNotCalibrated(page)

    await gotoAuthenticated(page, `/user-certifications/${PROGRESS_IDS.enrollmentId}/progress`)

    await expect(page.getByTestId('progress-page')).toBeVisible()

    // The not-calibrated state is shown (no score, no trend, informational message).
    await expect(page.getByTestId('progress-not-calibrated')).toBeVisible()

    // The trajectory callout must be absent when calibrated: false.
    await expect(page.getByTestId('trajectory-callout')).toHaveCount(0)
  })

  test('mark mastered calls suppress-domain and reflects the retired state; no un-retire control', async ({
    page,
  }) => {
    mockProgressLoop(page)

    await gotoAuthenticated(page, `/user-certifications/${PROGRESS_IDS.enrollmentId}/progress`)

    await expect(page.getByTestId('progress-page')).toBeVisible()

    // Click "Mark mastered" on the Secure Architectures domain row.
    const secureRow = page
      .getByTestId('progress-domain-row')
      .filter({ hasText: /Secure Architectures/i })
    await secureRow.getByTestId('mark-mastered-button').click()

    // The domain row updates to reflect the retired state.
    await expect(secureRow).toHaveAttribute('data-state', 'mastered')

    // No functional un-retire control is wired (suppress-domain is one-way).
    await expect(page.getByTestId('unretire-button')).toHaveCount(0)
  })

  test('non-owned enrollment returns not-found state without leaking resource existence', async ({
    page,
  }) => {
    mockProgressNotFound(page)

    // Navigate directly to the non-owned enrollment's progress page via the auth bootstrap path.
    await gotoAuthenticated(page, `/user-certifications/${NOT_OWNED_ENROLLMENT_ID}/progress`)

    // The page must render a not-found state that does not expose the resource.
    await expect(page.getByTestId('progress-not-found')).toBeVisible()

    // The cert name (which would leak the resource's existence) must not be rendered.
    await expect(page.getByTestId('progress-cert-name')).toHaveCount(0)
  })
})
