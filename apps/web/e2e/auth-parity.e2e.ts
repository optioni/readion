import { expect, test } from '@playwright/test'
import { fulfilJson, mock } from './support/route-mock'

// Outer-loop acceptance tests for fix-web-auth-parity's two genuine fidelity gaps:
//   (a) Sign in — a failed login must style the credential fields with the Readion danger-token
//       border (matching openspec/design/SignIn.html) WITHOUT ever showing a per-field,
//       account-revealing message. The uniform banner remains the only textual error.
//   (b) Reset password — the new-password form must render a Confirm-password field with live
//       client-side match validation (matching openspec/design/ResetPassword.html).
// Both pages are public routes rendered with the `auth` layout, so a bare page.goto reaches them
// without any auth bootstrap mocking.

test.describe('web-auth — sign-in error styling (SignIn.html)', () => {
  test('a failed login styles the credential fields without revealing which one is wrong', async ({
    page,
  }) => {
    mock(page, /\/api\/v1\/auth\/login$/, async (route) => {
      await fulfilJson(route, 401, { title: 'Unauthorized', status: 401 })
    })

    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.locator('#login-email').fill('jamie@example.com')
    await page.locator('#login-password').fill('wrong-password')
    await page.getByRole('button', { name: /^sign in$/i }).click()

    const banner = page.getByTestId('login-error')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText(/incorrect email or password/i)

    // The credential inputs must render the errored (danger-token) styling — a red border, not the
    // neutral default.
    const emailBorder = await page
      .locator('#login-email')
      .evaluate((el) => getComputedStyle(el).borderColor)
    const passwordBorder = await page
      .locator('#login-password')
      .evaluate((el) => getComputedStyle(el).borderColor)
    expect(emailBorder).toBe('rgb(248, 113, 113)')
    expect(passwordBorder).toBe('rgb(248, 113, 113)')

    // No per-field, account-revealing message — the uniform banner is the only textual error.
    await expect(page.getByText(/no account found/i)).toHaveCount(0)
  })

  test('the credential fields render the neutral border before any failed submit', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const emailBorder = await page
      .locator('#login-email')
      .evaluate((el) => getComputedStyle(el).borderColor)
    expect(emailBorder).not.toBe('rgb(248, 113, 113)')
  })
})

test.describe('web-auth — reset-password confirm field (ResetPassword.html)', () => {
  test('renders a confirm-password field, blocks a mismatch, and allows a match', async ({
    page,
  }) => {
    mock(page, /\/auth\/reset-password/, async (route) => {
      if (route.request().method() === 'GET') {
        await fulfilJson(route, 200, {})
        return
      }
      await fulfilJson(route, 200, {})
    })

    await page.goto('/reset-password?token=valid-reset-token')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Confirm password')).toBeVisible()

    const passwordInput = page.locator('input[type="password"]').first()
    const confirmInput = page.getByTestId('confirm-password-input')

    await passwordInput.fill('correct-horse-battery')
    await confirmInput.fill('different-battery')

    await expect(page.getByTestId('confirm-password-mismatch')).toContainText(
      /passwords do not match/i,
    )

    // A mismatch blocks submission — the submit control is disabled.
    const submitButton = page.getByRole('button', { name: /set new password/i })
    await expect(submitButton).toBeDisabled()

    await confirmInput.fill('correct-horse-battery')
    await expect(page.getByTestId('confirm-password-mismatch')).toHaveCount(0)
    await expect(page.getByTestId('confirm-password-success')).toBeVisible()
    await expect(submitButton).toBeEnabled()

    await submitButton.click()
    await expect(page).toHaveURL(/\/login/)
  })
})
