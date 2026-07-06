import { expect, test } from '@playwright/test'

// When signups are disabled the API answers register with 403 /errors/signups-disabled.
// A single shared backend can't toggle SIGNUPS_ENABLED per test, so we intercept the
// register call at the network boundary (sanctioned in design.md Test Boundaries) and
// assert the signup page renders the closed state instead of a generic error.
test.describe('signups disabled — registration is closed', () => {
  test('shows a closed message and creates no session when the API refuses signups', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/register', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: '/errors/signups-disabled',
          title: 'Forbidden',
          status: 403,
          detail: 'Registration is currently disabled',
        }),
      })
    })

    await page.goto('/register')
    // Wait for hydration before interacting — otherwise the submit fires a native form GET and
    // never reaches the fetch (same rationale as onboarding.e2e.ts / dashboard.e2e.ts).
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Email').fill(`closed.${Date.now()}@example.com`)
    await page.getByLabel('Password', { exact: true }).fill('correcthorse')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page.getByTestId('register-error')).toContainText(
      'Registration is currently closed',
    )

    // Still on the register page, unauthenticated — no redirect to the app.
    await expect(page).toHaveURL(/\/register$/)
  })
})
