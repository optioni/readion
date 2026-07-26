import { expect, type Locator, type Page, test } from '@playwright/test'
import { mockAdmin, QUARANTINE_ITEM_A_ID } from './support/admin-seed'
import {
  CORS_HEADERS as AGENT_CORS_HEADERS,
  gotoAuthenticated as gotoAgentAuthenticated,
  mockAgentChat,
  mock as mockAgentRoute,
} from './support/agent-chat-seed'
import { mockDashboardHero } from './support/dashboard-mock-seed'
import { CORS_HEADERS, fulfilJson, mock as mockRoute } from './support/route-mock'
import { gotoAuthenticated } from './support/session-view-seed'
import { mockSettings, SETTINGS_PROFILE } from './support/settings-seed'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = () => done()
  })
  return { promise, resolve }
}

async function controlStyle(control: Locator): Promise<{
  backgroundColor: string
  borderColor: string
  boxShadow: string
  outline: string
  transform: string
}> {
  return control.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
      transform: style.transform,
    }
  })
}

async function focusWithKeyboard(page: Page, control: Locator): Promise<void> {
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press('Tab')
    if (await control.evaluate((element) => element === document.activeElement)) {
      return
    }
  }
  throw new Error('Control was not reachable by keyboard')
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
}

test.describe('ui-interaction-state-parity — representative outer loop', () => {
  test('shared primary CTA exposes hover, active, keyboard focus, and action-specific busy state', async ({
    page,
  }) => {
    mockSettings(page)

    const patchGate = deferred()
    let patchRequests = 0
    mockRoute(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.fallback()
        return
      }
      patchRequests += 1
      await patchGate.promise
      await fulfilJson(route, 200, { data: SETTINGS_PROFILE })
    })

    await gotoAuthenticated(page, '/settings')
    await page.getByTestId('settings-tab-study-defaults').click()

    const action = page.getByTestId('save-defaults-btn')
    await expect(action).toBeVisible()

    const rest = await controlStyle(action)
    await action.hover()
    const hover = await controlStyle(action)
    const hoverBox = await action.boundingBox()
    expect(
      hover.backgroundColor !== rest.backgroundColor || hover.borderColor !== rest.borderColor,
    ).toBe(true)

    await page.mouse.down()
    const active = await controlStyle(action)
    const activeBox = await action.boundingBox()
    await page.mouse.up()
    expect(
      active.transform !== hover.transform ||
        active.backgroundColor !== hover.backgroundColor ||
        active.borderColor !== hover.borderColor,
    ).toBe(true)
    expect(activeBox?.x).toBe(hoverBox?.x)
    expect(activeBox?.y).toBe(hoverBox?.y)

    await focusWithKeyboard(page, action)
    const focused = await controlStyle(action)
    expect(
      focused.outline !== rest.outline ||
        (focused.boxShadow !== rest.boxShadow && focused.boxShadow !== 'none'),
    ).toBe(true)

    await action.click()
    await expect.poll(() => patchRequests).toBe(1)
    await expect(action).toHaveAttribute('aria-busy', 'true')
    await expect(action).toContainText('Saving…')
    await expect(action.locator('[role="progressbar"], svg[aria-hidden="true"]')).toBeVisible()
    await action.click({ force: true })
    expect(patchRequests).toBe(1)

    patchGate.resolve()
    await expect(action).not.toHaveAttribute('aria-busy', 'true')
  })

  test('color mode persists across reload and every Settings tab stays contained at 375px', async ({
    page,
  }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')

    await expect(page.locator('html')).toHaveClass(/dark/)
    const colorModeToggle = page
      .locator(
        '[data-testid="color-mode-toggle"], button[aria-label*="theme" i], button[aria-label*="mode" i], button[title*="theme" i], button[title*="mode" i]',
      )
      .first()
    await expect(colorModeToggle).toBeVisible()
    await colorModeToggle.click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.reload()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    await page.setViewportSize({ width: 375, height: 812 })
    await gotoAuthenticated(page, '/settings')

    for (const tab of ['account', 'study-defaults', 'notifications']) {
      await page.getByTestId(`settings-tab-${tab}`).click()
      await expectNoDocumentOverflow(page)
    }

    const action = page.getByTestId('save-timezone-btn')
    await page.getByTestId('settings-tab-account').click()
    const actionBox = await action.boundingBox()
    expect(actionBox).not.toBeNull()
    expect((actionBox?.x ?? 0) + (actionBox?.width ?? 0)).toBeLessThanOrEqual(375)
  })

  test('dashboard delayed enrollment read never flashes empty and failure retries to content', async ({
    page,
  }) => {
    mockDashboardHero(page)

    const firstReadGate = deferred()
    let enrollmentReads = 0
    mockRoute(page, /\/api\/v1\/user-certifications(\?|$)/, async (route) => {
      enrollmentReads += 1
      if (enrollmentReads === 1) {
        await firstReadGate.promise
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          headers: CORS_HEADERS,
          body: JSON.stringify({
            type: 'about:blank',
            title: 'Service Unavailable',
            status: 503,
            detail: 'Enrollment service is temporarily unavailable',
          }),
        })
        return
      }
      await route.fallback()
    })

    await gotoAuthenticated(page, '/')
    await expect.poll(() => enrollmentReads).toBe(1)

    const certificationRegion = page
      .locator('[data-testid="dashboard-certifications"], [aria-label*="certification" i]')
      .first()
    await expect.soft(certificationRegion).toHaveAttribute('aria-busy', 'true')
    await expect.soft(page.getByTestId('cert-card-skeleton').first()).toBeVisible()
    await expect.soft(page.getByTestId('cert-card')).toHaveCount(0)
    await expect
      .soft(page.getByText(/no certifications|add your first certification/i))
      .toHaveCount(0)

    firstReadGate.resolve()
    await expect(page.getByText("Couldn't load your certifications")).toBeVisible()
    await expect(page.getByTestId('cert-card')).toHaveCount(0)

    await page.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => enrollmentReads).toBe(2)
    await expect(page.getByTestId('cert-card')).toHaveCount(1)
    await expect(page.getByText("Couldn't load your certifications")).toHaveCount(0)
  })

  test('standalone Agent initialization has no false empty state and retries once after failure', async ({
    page,
  }) => {
    mockAgentChat(page)

    const firstCreateGate = deferred()
    let createRequests = 0
    let initializationCanSucceed = false
    mockAgentRoute(page, /\/api\/v1\/agent-conversations$/, async (route) => {
      createRequests += 1
      if (!initializationCanSucceed) {
        await firstCreateGate.promise
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          headers: AGENT_CORS_HEADERS,
          body: JSON.stringify({
            type: 'about:blank',
            title: 'Service Unavailable',
            status: 503,
            detail: 'Conversation initialization failed',
          }),
        })
        return
      }
      await route.fallback()
    })

    await gotoAgentAuthenticated(page, '/agent')
    await expect.poll(() => createRequests).toBeGreaterThanOrEqual(1)

    const conversationRegion = page
      .locator('[data-testid="agent-chat-page"], [aria-label*="conversation" i]')
      .first()
    await expect.soft(conversationRegion).toHaveAttribute('aria-busy', 'true')
    await expect.soft(page.getByTestId('agent-empty-state')).toHaveCount(0)
    await expect.soft(page.getByTestId('agent-suggestion')).toHaveCount(0)

    firstCreateGate.resolve()
    await expect(
      page.getByText(/couldn't (start|load)|initialization failed|try again/i),
    ).toBeVisible()
    const readsBeforeRetry = createRequests
    initializationCanSucceed = true
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => createRequests).toBe(readsBeforeRetry + 1)
    await expect(page.getByTestId('agent-empty-state')).toBeVisible()
    await expect(page.getByTestId('agent-suggestion').first()).toBeVisible()
  })

  test('admin Approve identifies only the operation in flight and rejects duplicates', async ({
    page,
  }) => {
    mockAdmin(page)

    const approvalGate = deferred()
    let approvalRequests = 0
    mockRoute(
      page,
      new RegExp(`/api/v1/admin/quarantine/${QUARANTINE_ITEM_A_ID}/approve$`),
      async (route) => {
        approvalRequests += 1
        await approvalGate.promise
        await fulfilJson(route, 200, {
          data: { id: QUARANTINE_ITEM_A_ID, status: 'approved' },
        })
      },
    )

    await gotoAuthenticated(page, '/admin/review-queue')
    await page
      .locator(`[data-testid="review-queue-item"][data-item-id="${QUARANTINE_ITEM_A_ID}"]`)
      .click()

    const approve = page.getByTestId('approve-item-btn')
    const reject = page.getByTestId('reject-item-btn')
    await expect(approve).toBeVisible()
    await approve.click()
    await expect.poll(() => approvalRequests).toBe(1)

    await expect(approve).toHaveAttribute('aria-busy', 'true')
    await expect(approve).toContainText('Approving…')
    await expect(approve.locator('[role="progressbar"], svg[aria-hidden="true"]')).toBeVisible()
    await expect(reject).toBeDisabled()
    await expect(reject).not.toContainText('Approving…')

    await approve.click({ force: true })
    expect(approvalRequests).toBe(1)

    approvalGate.resolve()
  })
})
