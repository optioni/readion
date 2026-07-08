import { expect, test } from '@playwright/test'
import {
  CERT_DETAIL_MOCK_IDS,
  mockCertDetailTrajectory,
  mockCertDetailZeroQuestions,
} from './support/cert-detail-mock-seed'
import { HERO_CERT_NAME, mockDashboardHero } from './support/dashboard-mock-seed'
import { mockProgressLoop, PROGRESS_IDS } from './support/progress-seed'
import { gotoAuthenticated } from './support/session-view-seed'

// ============================================================================
// fix-learner-surfaces-fidelity — outer-loop RED (tasks 0.1–0.5).
//
// Drives the real apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil), per
// design.md Test Boundaries: the regression states this change targets — trajectory.weeksToReady
// === 1, a single-day current streak, and a completed-session summary reporting
// questionsAnswered === 0 — are hard/flaky to reach deterministically through the real
// readiness/summary computation path locally (it depends on the LLM-backed quiz/answer path), so
// this suite is fully standalone: no running NestJS API or Postgres is required.
//
// See also:
//   apps/web/e2e/dashboard.e2e.ts   — 0.5 dashboard PageHeader / hero-name anchors (real API)
//   apps/web/e2e/cert-detail.e2e.ts — 0.5 cert-detail header-bar / tab-casing anchors (real API)
// ============================================================================

test.describe('fix-learner-surfaces-fidelity — outer-loop acceptance (RED)', () => {
  test('0.2 — cert-detail trajectory reads "exam-ready in ~1 week" (singular) for weeksToReady === 1', async ({
    page,
  }) => {
    mockCertDetailTrajectory(page, 1)

    await gotoAuthenticated(page, `/user-certifications/${CERT_DETAIL_MOCK_IDS.enrollmentId}`)

    await expect(page.getByTestId('cert-detail-page')).toBeVisible()

    const trajectory = page.getByTestId('stat-trajectory')
    await expect(trajectory).toBeVisible()
    // Must read "exam-ready in ~1 week" — the singular form. The `(?!s)` guards against a false
    // pass on the current bug's "~1 weeks" (a plural match would satisfy a plain substring check).
    await expect(trajectory).toContainText(/exam-ready in ~1 week(?!s)/i)
  })

  test('0.4 — cert-detail suppresses accuracy (no "0%") when questionsAnswered === 0', async ({
    page,
  }) => {
    mockCertDetailZeroQuestions(page)

    await gotoAuthenticated(page, `/user-certifications/${CERT_DETAIL_MOCK_IDS.enrollmentId}`)

    await expect(page.getByTestId('cert-detail-page')).toBeVisible()

    const questionsStat = page.getByTestId('cert-detail-questions-stat')
    await expect(questionsStat).toBeVisible()
    await expect(questionsStat).toContainText('0')
    // No "%" accuracy figure at all — a neutral placeholder/em dash instead of a fabricated "0%".
    await expect(questionsStat).not.toContainText('%')
  })

  test('0.3 — progress Current streak reads "1 day" (singular) for a one-day streak', async ({
    page,
  }) => {
    mockProgressLoop(page)

    await gotoAuthenticated(page, `/user-certifications/${PROGRESS_IDS.enrollmentId}/progress`)

    await expect(page.getByTestId('progress-page')).toBeVisible()

    const streakCard = page.getByTestId('progress-stat-card').filter({ hasText: /current streak/i })
    await expect(streakCard).toBeVisible()
    // Must read "1 day" — the singular form. The `(?!s)` guards against a false pass on the
    // current bug's hardcoded "1 days" (a plain substring check for "day" would still pass).
    await expect(streakCard).toContainText(/1\s*day(?!s)/i)
  })

  test('0.5 — progress session-history table renders a visible column-header row', async ({
    page,
  }) => {
    mockProgressLoop(page)

    await gotoAuthenticated(page, `/user-certifications/${PROGRESS_IDS.enrollmentId}/progress`)

    await expect(page.getByTestId('progress-page')).toBeVisible()

    // Column-header row: Date / Type / Duration / Questions / Accuracy / Readiness — matching
    // openspec/design/Progress.html. None of these labels are rendered by the current table (it
    // starts straight into data rows with no header row at all).
    for (const label of ['Date', 'Type', 'Duration', 'Questions', 'Accuracy', 'Readiness']) {
      await expect(page.getByText(label, { exact: true })).toBeVisible()
    }
  })

  test('0.5 — cert-detail renders a Dashboard breadcrumb and sentence-case Exam history tab', async ({
    page,
  }) => {
    mockCertDetailTrajectory(page, 3)

    await gotoAuthenticated(page, `/user-certifications/${CERT_DETAIL_MOCK_IDS.enrollmentId}`)

    await expect(page.getByTestId('cert-detail-page')).toBeVisible()

    // Full-bleed certification header bar with a "← Dashboard / CODE" breadcrumb. Scoped to the
    // page body (not the persistent app-shell sidebar, which also has an unrelated "Dashboard" nav
    // link) — the current header has no breadcrumb at all.
    await expect(page.getByTestId('cert-detail-page').getByText(/^←\s*Dashboard/)).toBeVisible()

    // Tab casing must be the exact sentence case "Exam history", not the current "Exam History".
    await expect(page.getByRole('tab', { name: 'Exam history', exact: true })).toBeVisible()
  })

  test('0.5 — dashboard renders the shared PageHeader and the hero card heading is the cert name', async ({
    page,
  }) => {
    mockDashboardHero(page)

    await gotoAuthenticated(page, '/')

    // Shared PageHeader: eyebrow "DASHBOARD", h1 "Your certifications", "1 active" indicator.
    // None of this exists today — the page renders a plain "My certifications" label instead.
    await expect(page.getByRole('heading', { level: 1, name: 'Your certifications' })).toBeVisible()
    await expect(page.getByText('DASHBOARD', { exact: true })).toBeVisible()
    await expect(page.getByText('1 active')).toBeVisible()

    // Hero card hierarchy: the certification NAME is the primary heading, introduced by a
    // "NEEDS ATTENTION" eyebrow — the readiness percentage MUST NOT be the card's heading.
    const hero = page.getByTestId('cert-card-hero')
    await expect(hero.getByRole('heading', { name: HERO_CERT_NAME })).toBeVisible()
    await expect(hero.getByText('NEEDS ATTENTION', { exact: true })).toBeVisible()
  })
})
