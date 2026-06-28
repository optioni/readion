import { type APIRequestContext, expect, request, test } from '@playwright/test'
import { type SeededDashboardUser, seedDashboardUser } from './support/dashboard-seed'

const apiBaseUrl = process.env.READION_E2E_API_BASE_URL ?? 'http://127.0.0.1:3001'
const mailpitBaseUrl = process.env.READION_E2E_MAILPIT_BASE_URL ?? 'http://127.0.0.1:8025'

// Acceptance test for SPEC → Layout Decisions → Dashboard (vertical cert list).
// Browser-driven against the real Nuxt app + real NestJS API + mailpit, following the
// auth-flow.e2e.ts pattern. Seeds via the same running API at :3001.
test.describe('web-dashboard — vertical cert list, hero, quick-starts, add certification', () => {
  let api: APIRequestContext
  let mailpit: APIRequestContext
  let seed: SeededDashboardUser

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: apiBaseUrl })
    mailpit = await request.newContext({ baseURL: mailpitBaseUrl })
    await mailpit.delete('/api/v1/messages')
    seed = await seedDashboardUser(api, mailpit)
  })

  test.afterAll(async () => {
    await api?.dispose()
    await mailpit?.dispose()
  })

  test('logs in, lands on the dashboard, and renders the seeded enrollments as cards', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(seed.email)
    await page.getByLabel('Password').fill(seed.password)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Lands authenticated on the dashboard home.
    await expect(page).toHaveURL('/')

    // The dashboard is a vertical list of certification cards under the section label.
    await expect(page.getByText(/my certifications/i)).toBeVisible()

    const cards = page.getByTestId('cert-card')
    await expect(cards).toHaveCount(seed.enrollments.length)

    // Each card shows its certification name and provider.
    for (const enrollment of seed.enrollments) {
      const card = page.getByTestId('cert-card').filter({ hasText: enrollment.name })
      await expect(card).toBeVisible()
      await expect(card).toContainText(enrollment.provider)
    }

    // The "+ Add certification" entry sits at the bottom of the list.
    await expect(page.getByRole('button', { name: /add certification/i })).toBeVisible()
  })

  test('promotes the lowest-readiness (or fallback) cert to the gradient hero at the top', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(seed.email)
    await page.getByLabel('Password').fill(seed.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/')

    // The hero card (gradient treatment) is the first card and shows the cert the SPEC rule
    // selects: lowest calibrated readiness, or most-recently-enrolled when none are calibrated.
    const hero = page.getByTestId('cert-card-hero')
    await expect(hero).toBeVisible()
    await expect(hero).toContainText(seed.heroEnrollment.name)

    const firstCard = page.getByTestId('cert-card').first()
    await expect(firstCard).toContainText(seed.heroEnrollment.name)
  })

  test('shows readiness state, weak areas, recent sessions, and the conditional review quick-start', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(seed.email)
    await page.getByLabel('Password').fill(seed.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/')

    // Not-yet-calibrated enrollments render the calibration message rather than a percentage.
    const uncalibrated = seed.enrollments.find((enrollment) => enrollment.readinessScore === null)
    if (uncalibrated) {
      const card = page.getByTestId('cert-card').filter({ hasText: uncalibrated.name })
      await expect(card.getByText(/not yet calibrated/i)).toBeVisible()
    }

    // Every card exposes the weak-areas (top 3 domains) and recent-sessions panels.
    const heroCard = page.getByTestId('cert-card-hero')
    await expect(heroCard.getByText(/weak areas/i)).toBeVisible()
    await expect(heroCard.getByText(/recent sessions/i)).toBeVisible()

    // The 5-minute review quick-start appears only where reviews are due.
    // TODO(web-dashboard group 7 — GREEN): the seed must produce an enrollment with
    // meta.dueCount > 0 (graded-answer + review-scheduling path) so this assertion exercises
    // real due reviews. The quick-start is the SPEC-mandated conditional control.
    await expect(page.getByRole('button', { name: /5-minute review/i }).first()).toBeVisible()

    // Each card offers the Start Session and Mock Exam quick-starts.
    await expect(heroCard.getByRole('button', { name: /start session/i })).toBeVisible()
    await expect(heroCard.getByRole('button', { name: /mock exam/i })).toBeVisible()
  })

  test('adds a certification via the modal and the new cert appears as a card', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(seed.email)
    await page.getByLabel('Password').fill(seed.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/')

    await expect(page.getByTestId('cert-card')).toHaveCount(seed.enrollments.length)

    await page.getByRole('button', { name: /add certification/i }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await modal.getByText(seed.addableCertification.name).click()

    // On success the dashboard refreshes and the newly enrolled cert appears as a card.
    const newCard = page.getByTestId('cert-card').filter({
      hasText: seed.addableCertification.name,
    })
    await expect(newCard).toBeVisible()
    await expect(page.getByTestId('cert-card')).toHaveCount(seed.enrollments.length + 1)
  })
})
