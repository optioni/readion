import { type APIRequestContext, expect, type Page, request, test } from '@playwright/test'
import {
  type OnboardingEnrolledUser,
  type OnboardingNewUser,
  seedOnboardingEnrolledUser,
  seedOnboardingNewUser,
  seedZeroCatalogUsers,
  type ZeroCatalogUsers,
} from './support/onboarding-seed'

const apiBaseUrl = process.env.READION_E2E_API_BASE_URL ?? 'http://127.0.0.1:3001'
const mailpitBaseUrl = process.env.READION_E2E_MAILPIT_BASE_URL ?? 'http://127.0.0.1:8025'

type Credentials = { email: string; password: string }

// Drives the /login UI as the seeded user. Waiting for network idle ensures the Nuxt app has
// hydrated before we interact — otherwise the submit fires a native form GET and never authes
// (same rationale as dashboard.e2e.ts / cert-detail.e2e.ts).
async function signIn(page: Page, user: Credentials): Promise<void> {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: /sign in/i }).click()
}

// Drives the onboarding cert-select + default session-prefs steps for a freshly-signed-in new user,
// stopping once the diagnostic offer (offer === 'onboarding') is on screen so each test can choose
// Take vs Skip. The duration/learning-style choices mirror SPEC step 2 (duration 60, spaced-
// repetition), which the implementation persists via PATCH /users/me before enrolling.
async function advanceToDiagnosticOffer(page: Page, user: OnboardingNewUser): Promise<void> {
  await signIn(page, user)

  // The gate routes a verified user with zero active enrollments and a live catalog to onboarding.
  await expect(page).toHaveURL('/onboarding')
  await expect(page.getByTestId('onboarding-page')).toBeVisible()

  // Step 1 — cert-select. Continue stays disabled until a certification is chosen; each option
  // shows the certification name and provider.
  const continueButton = page.getByRole('button', { name: /continue/i })
  await expect(continueButton).toBeDisabled()

  const certOption = page.getByTestId('cert-option').filter({ hasText: user.liveCert.name })
  await expect(certOption).toContainText(user.liveCert.provider)
  await certOption.click()

  await expect(continueButton).toBeEnabled()
  await continueButton.click()

  // Step 2 — default session preferences (duration 60, learning style spaced-repetition).
  await expect(page.getByTestId('onboarding-session-prefs')).toBeVisible()
  await page.getByTestId('duration-option-60').click()
  await page.getByTestId('learning-style-spaced-repetition').click()
  await page.getByRole('button', { name: /confirm|enroll/i }).click()

  // Step 3 — diagnostic offer card for a brand-new enrollment.
  const offer = page.getByTestId('diagnostic-offer')
  await expect(offer).toBeVisible()
  await expect(offer).toContainText(/2-minute diagnostic/i)
}

// Acceptance test for the web-onboarding change: a first-run onboarding flow at /onboarding for a
// user with no active enrollments. Browser-driven against the real Nuxt app + real NestJS API +
// mailpit, mirroring dashboard.e2e.ts / cert-detail.e2e.ts and seeding via the same running API
// at :3001 (plus direct-DB writes for catalog state / role).
//
// The empty-catalog gate cases below mutate shared, process-wide certification state (every live
// cert → draft and back). Run this spec single-worker (`--workers=1`) and in isolation so those
// drafts never overlap the live-catalog flows in this file or the live-catalog suites in others
// (dashboard/cert-detail). See onboarding-seed.ts for the full caveat.

test.describe('web-onboarding — first-run flow (cert-select, defaults, diagnostic offer)', () => {
  let api: APIRequestContext
  let mailpit: APIRequestContext
  let newUser: OnboardingNewUser
  let enrolledUser: OnboardingEnrolledUser

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: apiBaseUrl })
    mailpit = await request.newContext({ baseURL: mailpitBaseUrl })
    await mailpit.delete('/api/v1/messages')
    newUser = await seedOnboardingNewUser(api, mailpit)
    enrolledUser = await seedOnboardingEnrolledUser(api, mailpit)
  })

  test.afterAll(async () => {
    await api?.dispose()
    await mailpit?.dispose()
  })

  test('happy path: new user is routed to onboarding, enrolls, skips the diagnostic, lands on the dashboard', async ({
    page,
  }) => {
    await advanceToDiagnosticOffer(page, newUser)

    // Skip dismisses the offer and drops the user on the dashboard.
    await page.getByTestId('diagnostic-offer').getByRole('button', { name: /skip/i }).click()

    await expect(page).toHaveURL('/')
    const newCard = page.getByTestId('cert-card').filter({ hasText: newUser.liveCert.name })
    await expect(newCard).toBeVisible()
    await expect(newCard).toContainText(newUser.liveCert.provider)
  })

  test('diagnostic Take navigates to the mock-exam runner route', async ({ page }) => {
    // A second new user so this test does not depend on the happy-path enrollment having run.
    const taker = await seedOnboardingNewUser(api, mailpit)
    await advanceToDiagnosticOffer(page, taker)

    await page.getByTestId('diagnostic-offer').getByRole('button', { name: /take/i }).click()

    // POST /:id/diagnostic then navigation to the mock-exam runner placeholder (mockExamRunPath).
    await expect(page).toHaveURL(/\/mock-exams\/[0-9a-f-]{36}$/)
  })

  test('polish: step 1 renders a cert search that filters the catalog, and the route hides the global app chrome', async ({
    page,
  }) => {
    // Fresh user so this does not depend on (or mutate) the happy-path enrollment.
    const searcher = await seedOnboardingNewUser(api, mailpit)
    await signIn(page, searcher)

    await expect(page).toHaveURL('/onboarding')
    await expect(page.getByTestId('onboarding-page')).toBeVisible()

    // RED — standalone chrome: onboarding currently inherits the default sidebar shell, so the
    // global app sidebar wraps the wizard. The polish pass assigns a bare layout so it is absent.
    await expect(page.getByTestId('app-sidebar')).toHaveCount(0)

    // RED — cert search box above the list (`openspec/design/Onboarding.html` step 1). Absent today.
    const search = page.getByTestId('cert-search-input')
    await expect(search).toBeVisible()
    await expect(search).toHaveAttribute('placeholder', /search certifications/i)

    // The seeded live cert is listed before filtering.
    const liveOption = page.getByTestId('cert-option').filter({ hasText: searcher.liveCert.name })
    await expect(liveOption).toBeVisible()

    // Client-side filter over name/provider/code: a non-matching query empties the list; clearing
    // the query restores the full live-cert catalog (no extra GET /certifications request).
    await search.fill('zzz-no-such-certification')
    await expect(page.getByTestId('cert-option')).toHaveCount(0)

    await search.fill('')
    await expect(liveOption).toBeVisible()
  })

  test('already-enrolled user is redirected away from /onboarding to the dashboard', async ({
    page,
  }) => {
    await signIn(page, enrolledUser)
    await expect(page).toHaveURL('/')

    // Auth lives only in the client, so a full load of a protected route is bounced to /login by
    // SSR middleware. Reach /onboarding through an in-app (client-side) navigation, as cert-detail
    // does, and assert the gate redirects an already-enrolled user back to the dashboard.
    await page.evaluate(() => {
      window.history.pushState({}, '', '/onboarding')
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    })

    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('onboarding-page')).toHaveCount(0)
  })
})

test.describe('web-onboarding — empty-catalog gates', () => {
  let api: APIRequestContext
  let mailpit: APIRequestContext
  let seed: ZeroCatalogUsers

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: apiBaseUrl })
    mailpit = await request.newContext({ baseURL: mailpitBaseUrl })
    seed = await seedZeroCatalogUsers(api, mailpit)
  })

  test.afterAll(async () => {
    await seed?.restore()
    await api?.dispose()
    await mailpit?.dispose()
  })

  test('non-admin with zero certifications sees the empty state', async ({ page }) => {
    await signIn(page, seed.nonAdmin)

    await expect(page.getByText(/no certifications available yet/i)).toBeVisible()
  })

  test('admin with zero certifications is routed to the admin cert-setup placeholder route', async ({
    page,
  }) => {
    await signIn(page, seed.admin)

    await expect(page).toHaveURL(/\/admin\/certifications/)
  })
})
