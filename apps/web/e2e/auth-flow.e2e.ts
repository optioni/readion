import { type APIRequestContext, expect, request, test } from '@playwright/test'
import { captureVerificationToken } from './support/mailpit-helpers'

const apiBaseUrl = process.env.READION_E2E_API_BASE_URL ?? 'http://127.0.0.1:3001'
const mailpitBaseUrl = process.env.READION_E2E_MAILPIT_BASE_URL ?? 'http://127.0.0.1:8025'

test.describe('J1 auth flow — register → verify → protected → reload → logout', () => {
  let api: APIRequestContext
  let mailpit: APIRequestContext

  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: apiBaseUrl })
    mailpit = await request.newContext({ baseURL: mailpitBaseUrl })
    await mailpit.delete('/api/v1/messages')
  })

  test.afterAll(async () => {
    await api?.dispose()
    await mailpit?.dispose()
  })

  test('registers, verifies email via captured token, lands authenticated, reaches protected route, hard-reloads session, and logs out', async ({
    page,
  }) => {
    const email = `auth-flow.${Date.now()}@example.com`
    const password = 'correcthorse'

    // Register via the UI
    await page.goto('/register')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: /create account/i }).click()

    // Capture the verification token from email and visit the verify URL
    const verificationToken = await captureVerificationToken(mailpit, email)
    await page.goto(`/verify-email?token=${verificationToken}`)

    // Should land authenticated (verify success → redirect to home)
    await expect(page).toHaveURL('/')

    // Navigate to a protected route — no redirect because we're authenticated
    await page.goto('/')
    await expect(page).toHaveURL('/')

    // Hard reload — session must be restored from cookie (silent refresh bootstrap)
    await page.reload()
    await expect(page).toHaveURL('/')

    // Logout via the shell
    await page.getByRole('button', { name: /log out/i }).click()
    await expect(page).toHaveURL('/login')
  })
})
