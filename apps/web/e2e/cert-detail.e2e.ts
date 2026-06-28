import { type APIRequestContext, expect, type Page, request, test } from '@playwright/test'
import { type SeededCertDetailUser, seedCertDetailUser } from './support/cert-detail-seed'

const apiBaseUrl = process.env.READION_E2E_API_BASE_URL ?? 'http://127.0.0.1:3001'
const mailpitBaseUrl = process.env.READION_E2E_MAILPIT_BASE_URL ?? 'http://127.0.0.1:8025'

// Drives the /login UI as the seeded user. Waiting for network idle ensures the Nuxt app has
// hydrated before we interact — otherwise the submit fires a native form GET and never authes.
async function signIn(page: Page, user: SeededCertDetailUser): Promise<void> {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: /sign in/i }).click()
}

// Navigates from the dashboard into the cert-detail page by clicking the seeded enrollment's card
// title, which the design promotes to a link to /user-certifications/:id.
async function openCertDetail(page: Page, user: SeededCertDetailUser): Promise<void> {
  await signIn(page, user)
  await expect(page).toHaveURL('/')

  const card = page.getByTestId('cert-card').filter({ hasText: user.certName })
  await card.getByTestId('cert-title').click()

  await expect(page).toHaveURL(`/user-certifications/${user.enrollmentId}`)
  await expect(page.getByTestId('cert-detail-page')).toBeVisible()
}

// Acceptance test for the web-cert-detail change: a tabbed enrollment detail page reachable from
// the dashboard. Browser-driven against the real Nuxt app + real NestJS API + mailpit, mirroring
// dashboard.e2e.ts. Seeds via the same running API at :3001 plus direct-DB FK chains.
test.describe('web-cert-detail — tabbed enrollment detail (Overview, Sessions, Exam History)', () => {
  let api: APIRequestContext
  let mailpit: APIRequestContext
  let seed: SeededCertDetailUser

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: apiBaseUrl })
    mailpit = await request.newContext({ baseURL: mailpitBaseUrl })
    await mailpit.delete('/api/v1/messages')
    seed = await seedCertDetailUser(api, mailpit)
  })

  test.afterAll(async () => {
    await api?.dispose()
    await mailpit?.dispose()
  })

  test('clicks a dashboard cert card and lands on the enrollment detail Overview', async ({
    page,
  }) => {
    await openCertDetail(page, seed)

    // The detail header identifies the certification by name and provider (the enrollment row
    // itself carries only certificationId, so the page joins certificationsControllerDetail).
    await expect(page.getByTestId('cert-detail-page')).toContainText(seed.certName)
    await expect(page.getByTestId('cert-detail-page')).toContainText(seed.provider)

    // Overview is the default tab.
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /sessions/i })).toBeVisible()
    await expect(page.getByRole('tab', { name: /exam history/i })).toBeVisible()
  })

  test('Overview shows the readiness/trajectory stat row, domain breakdown, next focus, sessions', async ({
    page,
  }) => {
    await openCertDetail(page, seed)

    // Readiness + trajectory live in a stat row at the top of the Overview.
    await expect(page.getByTestId('cert-detail-stat-row')).toBeVisible()

    // Per-domain breakdown — one row per certification domain (every domain, answered or not).
    const domainRows = page.getByTestId('domain-score-row')
    await expect(domainRows).toHaveCount(seed.weakAreaDomains.length)
    const firstFocusDomain = seed.weakAreaDomains[0]
    if (firstFocusDomain !== undefined) {
      await expect(domainRows.first()).toContainText(firstFocusDomain)
    }

    // Suggested next focus surfaces the weakest domain.
    const nextFocus = page.getByTestId('suggested-next-focus')
    await expect(nextFocus).toBeVisible()
    if (firstFocusDomain !== undefined) {
      await expect(nextFocus).toContainText(firstFocusDomain)
    }

    // Recent sessions appear on the Overview.
    await expect(page.getByText(/recent sessions/i)).toBeVisible()
  })

  test('Sessions tab lists the full history and the Study/Review type filter narrows it', async ({
    page,
  }) => {
    await openCertDetail(page, seed)

    await page.getByRole('tab', { name: /sessions/i }).click()

    const table = page.getByTestId('sessions-history-table')
    await expect(table).toBeVisible()

    const rows = page.getByTestId('session-row')
    await expect(rows).toHaveCount(seed.totalSessionCount)

    // The type filter is client-side over SessionResponse.kind (no server param).
    await page.getByRole('button', { name: /^study$/i }).click()
    await expect(rows).toHaveCount(seed.studySessionCount)

    await page.getByRole('button', { name: /^review$/i }).click()
    await expect(rows).toHaveCount(seed.reviewSessionCount)
  })

  test('Exam History tab lists the mock attempt with its status and score', async ({ page }) => {
    await openCertDetail(page, seed)

    await page.getByRole('tab', { name: /exam history/i }).click()

    const examRows = page.getByTestId('exam-history-row')
    await expect(examRows).toHaveCount(1)
    await expect(examRows.first()).toContainText(/submitted/i)
    await expect(examRows.first()).toContainText(String(Math.round(seed.mockExam.score)))
  })

  test('shows a not-found state for an enrollment the signed-in user does not own', async ({
    page,
  }) => {
    await signIn(page, seed)
    await expect(page).toHaveURL('/')

    // Auth lives only in the client (the refresh-cookie bootstrap is a client plugin), so a full
    // page load of a protected route is redirected to /login by SSR middleware. We therefore reach
    // the route through an in-app (client-side) navigation, as the rest of this suite does via card
    // clicks. A well-formed but non-existent enrollment id makes the API answer 404, and the page
    // degrades to its not-found state instead of rendering the certification header.
    await page.evaluate((path) => {
      window.history.pushState({}, '', path)
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    }, '/user-certifications/00000000-0000-0000-0000-000000000000')

    await expect(page).toHaveURL(/00000000-0000-0000-0000-000000000000$/)
    await expect(page.getByTestId('cert-detail-not-found')).toBeVisible()
    await expect(page.getByTestId('cert-detail-name')).toHaveCount(0)
  })
})
