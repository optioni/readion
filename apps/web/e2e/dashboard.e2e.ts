import { type APIRequestContext, expect, type Page, request, test } from '@playwright/test'
import { type SeededDashboardUser, seedDashboardUser } from './support/dashboard-seed'

const apiBaseUrl = process.env.READION_E2E_API_BASE_URL ?? 'http://127.0.0.1:3001'
const mailpitBaseUrl = process.env.READION_E2E_MAILPIT_BASE_URL ?? 'http://127.0.0.1:8025'

// Drives the /login UI as the seeded user. Waiting for network idle ensures the Nuxt app has
// hydrated before we interact — otherwise the submit fires a native form GET (no SPA handler
// attached yet) and the page never authenticates.
async function signIn(page: Page, user: SeededDashboardUser): Promise<void> {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: /sign in/i }).click()
}

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
    await signIn(page, seed)

    // Lands authenticated on the dashboard home.
    await expect(page).toHaveURL('/')

    // The dashboard is a vertical list of certification cards under the shared PageHeader
    // (fix-learner-surfaces-fidelity replaces the old "My certifications" label with the
    // spec-mandated "Your certifications" h1 — see openspec/design/Dashboard.html).
    await expect(page.getByRole('heading', { level: 1, name: 'Your certifications' })).toBeVisible()

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
    await signIn(page, seed)
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
    await signIn(page, seed)
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

    // The 5-minute review quick-start appears only where reviews are due. The seed writes a
    // real due ReviewItem for one enrollment (seed.dueReviewEnrollment), so this exercises the
    // SPEC-mandated conditional control against a genuine dueCount > 0.
    await expect(page.getByRole('button', { name: /5-minute review/i }).first()).toBeVisible()

    // Each card offers the Start Session and Mock Exam quick-starts.
    await expect(heroCard.getByRole('button', { name: /start session/i })).toBeVisible()
    await expect(heroCard.getByRole('button', { name: /mock exam/i })).toBeVisible()
  })

  test('adds a certification via the modal and the new cert appears as a card', async ({
    page,
  }) => {
    await signIn(page, seed)
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
