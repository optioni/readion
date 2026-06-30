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

    // web-progress-fidelity group 2 contract — ReadinessTrend enhancements:
    //   data-testid="readiness-point"  → <circle> marker per trend data point (one per session).
    //   Y-axis tick labels appear as SVG <text> or DOM text nodes inside the chart container.
    //   Current readiness value "66%" (seed score=66, trend 55→62→66) is shown.
    const readinessTrend = page.getByTestId('readiness-trend')
    await expect(readinessTrend.getByTestId('readiness-point').first()).toBeVisible()
    // Y-axis tick: implementer picks "nice" numbers on a 0-100 scale — 50 and 75 are common choices.
    await expect(readinessTrend).toContainText(/\b(50|75)\b/)
    // Current value always visible (seed score = 66).
    await expect(readinessTrend).toContainText('66%')

    // The accuracy chart must DRAW one bar per session, not just render axis/value labels.
    // The seeded enrollment has 3 completed sessions (accuracy 60/70/75 after the 0-100 scale),
    // so there must be exactly 3 bar columns AND each colored fill must have a measured,
    // non-zero rendered pixel height. A non-empty series that draws no bars (collapsed to 0px)
    // fails this contract.
    const accuracyBars = page.getByTestId('accuracy-bar')
    await expect(accuracyBars).toHaveCount(3)

    const barFills = page.getByTestId('accuracy-bar-fill')
    await expect(barFills).toHaveCount(3)
    const fillCount = await barFills.count()
    for (let i = 0; i < fillCount; i++) {
      const box = await barFills.nth(i).boundingBox()
      expect(box, `accuracy bar fill #${i} should have a bounding box`).not.toBeNull()
      expect(
        box?.height ?? 0,
        `accuracy bar fill #${i} should draw with a non-zero pixel height`,
      ).toBeGreaterThan(0)
    }

    // web-progress-fidelity group 1 contract — four stat cards:
    //   data-testid="progress-stat-card" on each card; count must be exactly 4.
    //   Labels: "Sessions", "Questions answered", "Study time", "Current streak".
    //   (Current page shows 2 unlabelled cards and uses "Questions" not "Questions answered".)
    await expect(page.getByTestId('progress-stat-card')).toHaveCount(4)
    await expect(page.getByTestId('progress-page')).toContainText('Sessions')
    await expect(page.getByTestId('progress-page')).toContainText('Questions answered')
    await expect(page.getByTestId('progress-page')).toContainText('Study time')
    await expect(page.getByTestId('progress-page')).toContainText('Current streak')

    // Trajectory callout is visible and shows the weeks-to-ready derived from readiness.trajectory.
    await expect(page.getByTestId('trajectory-callout')).toBeVisible()
    await expect(page.getByTestId('trajectory-callout')).toContainText(/3\s*week/i)

    // web-progress-fidelity group 3 contract — fuller pace copy in TrajectoryCallout:
    //   Must contain "recent pace" and "session avg" in addition to the week count.
    //   Current copy is terse: "Exam-ready in ~3 weeks" — lacks both phrases.
    await expect(page.getByTestId('trajectory-callout')).toContainText(/recent pace/i)
    await expect(page.getByTestId('trajectory-callout')).toContainText(/session avg/i)

    // Per-domain rows: one per certification.domains entry (CERTIFICATION1 has 4 domains).
    await expect(page.getByTestId('progress-domain-row')).toHaveCount(4)

    // Per-domain scores render as status-coloured horizontal progress bars (shared DomainScoreBar),
    // NOT text-only "NN%" rows. The bar's fill element carries an inline width proportional to the
    // score and a status-colour band class. The Secure Architectures domain has score 41 (sub-50 →
    // "poor"), so its fill must be visible, ~41% wide, and use the poor status colour.
    const secureBarRow = page
      .getByTestId('progress-domain-row')
      .filter({ hasText: /Secure Architectures/i })
    const secureBarFill = secureBarRow.getByTestId('domain-score-bar-fill')
    await expect(secureBarFill).toBeVisible()
    const secureBarStyle = await secureBarFill.getAttribute('style')
    expect(secureBarStyle, 'domain score bar fill must set a non-zero width').toMatch(
      /width:\s*41(\.0+)?%/,
    )
    await expect(secureBarFill).toHaveClass(/bg-readion-status-poor/)

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
