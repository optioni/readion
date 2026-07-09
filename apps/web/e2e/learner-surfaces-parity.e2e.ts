import { expect, test } from '@playwright/test'
import { CERT_DETAIL_MOCK_IDS, mockCertDetailTrajectory } from './support/cert-detail-mock-seed'
import { mockDashboardHero } from './support/dashboard-mock-seed'
import { mockProgressLoop, PROGRESS_IDS } from './support/progress-seed'
import { gotoAuthenticated } from './support/session-view-seed'

// ============================================================================
// fix-web-learner-surfaces-parity — outer-loop RED (tasks 0.1-0.4).
//
// Drives the real apps/web against a fully mocked HTTP API (Playwright `route` fulfil), matching
// the pattern already used by learner-surfaces-fidelity.e2e.ts / progress-seed.ts / cert-detail-
// mock-seed.ts / dashboard-mock-seed.ts. No running NestJS API or Postgres is required.
// ============================================================================

test.describe('fix-web-learner-surfaces-parity — outer-loop acceptance (RED)', () => {
  test('0.1 — dashboard cert card shows a ReadinessBar, standard content width, hairline sections, and the code pill', async ({
    page,
  }) => {
    mockDashboardHero(page)

    await gotoAuthenticated(page, '/')

    const hero = page.getByTestId('cert-card-hero')
    await expect(hero).toBeVisible()

    // ReadinessBar track under the readiness percentage — does not exist on the current card.
    await expect(hero.getByTestId('readiness-bar')).toBeVisible()

    // Content column uses the manifest `standard` (~1100px) width, not the narrow max-w-[720px].
    const dashboardList = page.getByTestId('dashboard-list')
    const box = await dashboardList.boundingBox()
    expect(box?.width ?? 0).toBeGreaterThan(900)

    // Flat hairline-divided sections (not the boxed two-column CardPanel grid).
    await expect(hero.getByTestId('card-section-divider').first()).toBeVisible()
    expect(await hero.getByTestId('card-section-divider').count()).toBeGreaterThanOrEqual(2)

    // Cert code pill beside the vendor name.
    await expect(hero.getByTestId('cert-code-pill')).toContainText('SAA-C03')

    // Sentence-case "Mock exam" quick-start copy (currently "Mock Exam").
    await expect(hero.getByRole('button', { name: 'Mock exam', exact: true })).toBeVisible()
  })

  test('0.2 — cert-detail recent sessions show a delta badge, stats are bordered cards with sub-captions, "View all sessions" links out, and the extra "View progress" link is gone', async ({
    page,
  }) => {
    mockCertDetailTrajectory(page, 3)

    await gotoAuthenticated(page, `/user-certifications/${CERT_DETAIL_MOCK_IDS.enrollmentId}`)

    const overview = page.getByTestId('cert-detail-tab-overview')
    await expect(overview).toBeVisible()

    // Every recent-session row shows a delta badge — OverviewTab currently never passes one.
    await expect(overview.getByTestId('recent-session-row').first().getByTestId('delta-badge')).toBeVisible()

    // Sub-captions ("completed"/"answered"/"per session") on the bordered stat cards.
    await expect(overview.getByText('completed', { exact: true })).toBeVisible()
    await expect(overview.getByText('answered', { exact: true })).toBeVisible()
    await expect(overview.getByText('per session', { exact: true })).toBeVisible()

    // "View all sessions →" link below the recent-sessions card.
    await expect(overview.getByText(/View all sessions/)).toBeVisible()

    // "Domain scores" label, not "Domain Breakdown".
    await expect(overview.getByText('Domain scores', { exact: true })).toBeVisible()

    // No extra "View progress" link between the header and the tab bar.
    await expect(page.getByTestId('view-progress-link')).toHaveCount(0)
  })

  test('0.3 — progress trajectory callout sits below the chart, the chart is enriched, "This month" cards render, and mastering a domain persists across a reload', async ({
    page,
  }) => {
    mockProgressLoop(page)

    await gotoAuthenticated(page, `/user-certifications/${PROGRESS_IDS.enrollmentId}/progress`)

    const progressPage = page.getByTestId('progress-page')
    await expect(progressPage).toBeVisible()

    // Trajectory callout renders AFTER the readiness chart (design: bottom of the section), not
    // before the stat summary as it does today.
    const html = await progressPage.innerHTML()
    const trajectoryIndex = html.indexOf('trajectory-callout')
    const chartIndex = html.indexOf('readiness-trend')
    const statsIndex = html.indexOf('progress-stat-card')
    expect(trajectoryIndex).toBeGreaterThan(chartIndex)
    expect(trajectoryIndex).toBeGreaterThan(statsIndex)

    // Chart X-axis date labels + area fill.
    expect(await progressPage.getByTestId('readiness-x-label').count()).toBeGreaterThanOrEqual(3)
    await expect(progressPage.getByTestId('readiness-area-fill')).toBeVisible()

    // "This month" section label over the per-stat bordered cards.
    await expect(progressPage.getByText('This month', { exact: true })).toBeVisible()

    // Mastering a domain persists across a reload — derived from fetched data, not a local ref.
    const domainRow = progressPage.getByTestId('progress-domain-row').first()
    await domainRow.getByTestId('mark-mastered-button').click()
    await expect(domainRow).toHaveAttribute('data-state', 'mastered')

    await page.reload()
    await expect(page.getByTestId('progress-page')).toBeVisible()
    const reloadedRow = page.getByTestId('progress-domain-row').first()
    await expect(reloadedRow).toHaveAttribute('data-state', 'mastered')
    // Design treatment: struck-through name, "Mastered" pill, no functional Unretire control.
    await expect(reloadedRow.getByTestId('mastered-pill')).toBeVisible()
    await expect(reloadedRow.getByTestId('unretire-button')).toHaveCount(0)
  })
})
