import { expect, type Page, type Route, test } from '@playwright/test'

// Regression guard for the "login advertisement stuck above the app nav" bug.
//
// In the deployed app the Nuxt server cannot see the client-only session, so SSR renders the `auth`
// (login) layout and 302s to /login; the client then authenticates via the async refresh and
// redirects into the app. In a PRODUCTION build that layout swap could leave the server-rendered
// `auth` layout stranded in the DOM above the real shell (two layout roots stacked). app.vue now
// keys <NuxtLayout> by the resolved layout name so the previous layout subtree is torn down.
//
// The stranded-DOM state only reproduces against a production build (Vue recovers hydration
// mismatches gracefully in dev), so the strongest form of this test runs with BASE_URL pointed at a
// `nuxt build` server. Against the dev server it still asserts the correct end state.

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:3000'

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': BASE,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-csrf-token',
}

const PROFILE = {
  id: '99999999-9999-9999-9999-999999999999',
  email: 'jamie@org.io',
  role: 'user',
  emailVerified: true,
  displayTimezone: 'Europe/Helsinki',
}

const AD_TEXT = /Exam-ready/

async function fulfilJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  })
}

// Playwright matches route handlers in reverse registration order, so the catch-all must be
// registered first for the specific mocks below to win.
function mock(page: Page, pattern: RegExp, handler: (route: Route) => Promise<void>): void {
  void page.route(pattern, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
      return
    }
    await handler(route)
  })
}

function mockCatchAll(page: Page): void {
  mock(page, /\/api\/v1\//, async (route) => {
    if (route.request().method() === 'GET') {
      await fulfilJson(route, 200, { data: [], meta: { total: 0, page: 1, limit: 20 } })
      return
    }
    await fulfilJson(route, 200, { data: {} })
  })
}

test('signing in replaces the auth advertisement layout with the app shell', async ({ page }) => {
  mockCatchAll(page)
  // Stay unauthenticated on /login: the client bootstrap refresh must fail.
  mock(page, /\/api\/v1\/auth\/refresh$/, async (route) => {
    await fulfilJson(route, 401, { title: 'Unauthorized', status: 401 })
  })
  mock(page, /\/api\/v1\/auth\/login$/, async (route) => {
    await fulfilJson(route, 200, { data: { accessToken: 'mock-access-token' } })
  })
  mock(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
    await fulfilJson(route, 200, { data: PROFILE })
  })
  // One active enrollment so the onboarding gate resolves to the dashboard (not /onboarding).
  mock(page, /\/api\/v1\/certifications(\?|$)/, async (route) => {
    await fulfilJson(route, 200, {
      data: [{ id: 'cert-1', name: 'AWS Solutions Architect', provider: 'AWS' }],
      meta: { total: 1, page: 1, limit: 20 },
    })
  })
  mock(page, /\/api\/v1\/user-certifications(\?|$)/, async (route) => {
    await fulfilJson(route, 200, {
      data: [
        {
          id: 'enr-1',
          certificationId: 'cert-1',
          readinessScore: null,
          enrolledAt: '2026-01-01T00:00:00.000Z',
          status: 'active',
        },
      ],
      meta: { total: 1, page: 1, limit: 20 },
    })
  })

  await page.goto(`${BASE}/login`)
  await expect(page.getByText(AD_TEXT)).toBeVisible()

  await page.locator('#login-email').fill('jamie@org.io')
  await page.locator('#login-password').fill('correcthorse')
  await page.getByRole('button', { name: /^sign in$/i }).click()

  // Generous timeout absorbs the dev server's on-demand route compile on a cold run.
  await expect(page.getByTestId('app-sidebar')).toBeVisible({ timeout: 15000 })
  // The auth advertisement layout must not linger once the app shell has taken over.
  await expect(page.getByText(AD_TEXT)).toHaveCount(0)
})

test('a hard load that bounces through /login lands in the app shell without the auth advertisement', async ({
  page,
}) => {
  mockCatchAll(page)
  // The client bootstrap refresh SUCCEEDS with realistic latency: the browser authenticates only
  // after initial hydration, matching a hard reload of a protected route in the deployed app where
  // the server render (which cannot see the session) has already bounced to /login.
  mock(page, /\/api\/v1\/auth\/refresh$/, async (route) => {
    await fulfilJson(route, 200, { data: { accessToken: 'mock-access-token' } })
  })
  // Admin with no certifications: the onboarding gate routes to /admin/certifications, producing the
  // multi-hop client redirect chain (/login -> / -> /admin/certifications) the deployed bug hit.
  mock(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
    await fulfilJson(route, 200, { data: { ...PROFILE, role: 'admin' } })
  })

  await page.goto(`${BASE}/admin/certifications`)

  await expect(page).toHaveURL(/\/admin\/certifications$/, { timeout: 15000 })
  await expect(page.getByTestId('app-sidebar')).toBeVisible({ timeout: 15000 })
  // No stranded auth advertisement, and exactly one layout root (not the auth shell above the app).
  await expect(page.getByText(AD_TEXT)).toHaveCount(0)
  const rootLayoutCount = await page.evaluate(
    () => document.querySelectorAll('#__nuxt > .min-h-screen').length,
  )
  expect(rootLayoutCount).toBe(1)
})
