import { expect, type Locator, type Page, type Route, test } from '@playwright/test'
import {
  CERT_ID,
  mockAdmin,
  QUARANTINE_ITEM_A_ID,
  QUARANTINE_ITEM_B_ID,
} from './support/admin-seed'
import {
  CORS_HEADERS as AGENT_CORS_HEADERS,
  gotoAuthenticated as gotoAgentAuthenticated,
  mockAgentChat,
  mock as mockAgentRoute,
} from './support/agent-chat-seed'
import { CERT_DETAIL_MOCK_IDS, mockCertDetailTrajectory } from './support/cert-detail-mock-seed'
import { DASHBOARD_MOCK_IDS, mockDashboardHero } from './support/dashboard-mock-seed'
import { mockProgressLoop, PROGRESS_IDS } from './support/progress-seed'
import { mockReviewLoop, REVIEW_IDS } from './support/quick-review-seed'
import { CORS_HEADERS, fulfilJson, mock as mockRoute } from './support/route-mock'
import { gotoAuthenticated, mockSessionLoop, SESSION_IDS } from './support/session-view-seed'
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
  transitionDuration: string
  transform: string
}> {
  return control.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
      transitionDuration: style.transitionDuration,
      transform: style.transform,
    }
  })
}

async function reachWithKeyboard(page: Page, control: Locator, maxTabs = 60): Promise<void> {
  await page.locator('body').click({ position: { x: 1, y: 1 } })
  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab')
    if (await control.evaluate((element) => element === document.activeElement)) return
  }
  throw new Error(`Control was not reachable from the document body within ${maxTabs} Tab presses`)
}

async function attemptDisabledActivation(control: Locator): Promise<void> {
  await control.evaluate((element) => (element as HTMLButtonElement).click())
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
}

async function fulfilProblem(route: Route, detail: string) {
  await route.fulfill({
    status: 503,
    contentType: 'application/problem+json',
    headers: CORS_HEADERS,
    body: JSON.stringify({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      detail,
    }),
  })
}

function channelToLinear(channel: number): number {
  const normalized = channel / 255
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function luminance(color: string): number {
  const channels = color
    .match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number)
  if (channels?.length !== 3) throw new Error(`Unsupported rendered color: ${color}`)
  return (
    0.2126 * channelToLinear(channels[0] ?? 0) +
    0.7152 * channelToLinear(channels[1] ?? 0) +
    0.0722 * channelToLinear(channels[2] ?? 0)
  )
}

function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

async function renderedElementColors(
  element: Locator,
): Promise<{ background: string; foreground: string }> {
  return element.evaluate((target) => {
    const foreground = getComputedStyle(target).color
    let ancestor: Element | null = target
    while (ancestor) {
      const background = getComputedStyle(ancestor).backgroundColor
      if (background !== 'transparent' && !background.endsWith(', 0)')) {
        return { background, foreground }
      }
      ancestor = ancestor.parentElement
    }
    throw new Error('Rendered element has no opaque ancestor background')
  })
}

async function expectContainedLabels(container: Locator): Promise<void> {
  const containerBox = await container.boundingBox()
  expect(containerBox).not.toBeNull()
  const labels = container.locator('text:visible')
  for (let index = 0; index < (await labels.count()); index += 1) {
    const label = labels.nth(index)
    const box = await label.boundingBox()
    if (!box || !containerBox) continue
    expect(box.x).toBeGreaterThanOrEqual(containerBox.x - 1)
    expect(box.y).toBeGreaterThanOrEqual(containerBox.y - 1)
    expect(box.x + box.width).toBeLessThanOrEqual(containerBox.x + containerBox.width + 1)
    expect(box.y + box.height).toBeLessThanOrEqual(containerBox.y + containerBox.height + 1)
    expect(
      Number.parseFloat(await label.evaluate((element) => getComputedStyle(element).fontSize)),
    ).toBeLessThanOrEqual(12)
  }
}

test.describe('ui-interaction-state-parity — critical-flow browser matrix', () => {
  test('shared primary CTA exposes hover, active, keyboard focus, and action-specific busy state', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
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
    await expect
      .poll(async () => {
        const hover = await controlStyle(action)
        return (
          hover.backgroundColor !== rest.backgroundColor || hover.borderColor !== rest.borderColor
        )
      })
      .toBe(true)
    const hover = await controlStyle(action)
    const hoverBox = await action.boundingBox()

    await page.mouse.down()
    await expect
      .poll(async () => {
        const active = await controlStyle(action)
        return (
          active.transform !== hover.transform ||
          active.backgroundColor !== hover.backgroundColor ||
          active.borderColor !== hover.borderColor
        )
      })
      .toBe(true)
    const active = await controlStyle(action)
    const activeBox = await action.boundingBox()
    await page.mouse.move(0, 0)
    await page.mouse.up()
    expect(
      active.transform !== hover.transform ||
        active.backgroundColor !== hover.backgroundColor ||
        active.borderColor !== hover.borderColor,
    ).toBe(true)
    expect(active.transitionDuration.split(',').every((duration) => duration.trim() === '0s')).toBe(
      true,
    )
    expect((activeBox?.x ?? 0) + (activeBox?.width ?? 0) / 2).toBeCloseTo(
      (hoverBox?.x ?? 0) + (hoverBox?.width ?? 0) / 2,
      1,
    )
    expect((activeBox?.y ?? 0) + (activeBox?.height ?? 0) / 2).toBeCloseTo(
      (hoverBox?.y ?? 0) + (hoverBox?.height ?? 0) / 2,
      1,
    )

    await reachWithKeyboard(page, action)
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
    await attemptDisabledActivation(action)
    expect(patchRequests).toBe(1)

    patchGate.resolve()
    await expect(action).not.toHaveAttribute('aria-busy', 'true')
  })

  test('color mode persists across reload and every Settings tab stays contained at 375px', async ({
    page,
  }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()

    await expect(page.locator('html')).toHaveClass(/dark/)
    const darkColors = await renderedElementColors(page.getByTestId('account-email'))
    expect(contrastRatio(darkColors.foreground, darkColors.background)).toBeGreaterThanOrEqual(4.5)
    const colorModeToggle = page
      .locator(
        '[data-testid="color-mode-toggle"], button[aria-label*="theme" i], button[aria-label*="mode" i], button[title*="theme" i], button[title*="mode" i]',
      )
      .first()
    await expect(colorModeToggle).toBeVisible()
    await colorModeToggle.click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    await page.reload()
    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
    const lightColors = await renderedElementColors(page.getByTestId('account-email'))
    expect(contrastRatio(lightColors.foreground, lightColors.background)).toBeGreaterThanOrEqual(
      4.5,
    )
    expect(lightColors).not.toEqual(darkColors)
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
        await route.fallback()
        return
      }
      if (enrollmentReads <= 3) {
        if (enrollmentReads === 2) await firstReadGate.promise
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
    await expect.poll(() => enrollmentReads).toBe(2)

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
    await expect.poll(() => enrollmentReads).toBe(3)
    await expect(page.getByTestId('cert-card')).toHaveCount(0)

    await page.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => enrollmentReads).toBe(4)
    await expect(page.getByTestId('cert-card')).toHaveCount(1)
    await expect(page.getByText("Couldn't load your certifications")).toHaveCount(0)
    await page.setViewportSize({ width: 375, height: 812 })
    await expectNoDocumentOverflow(page)
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
    await page.setViewportSize({ width: 375, height: 812 })
    await expectNoDocumentOverflow(page)
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

    await attemptDisabledActivation(approve)
    expect(approvalRequests).toBe(1)

    approvalGate.resolve()
    await page.setViewportSize({ width: 375, height: 812 })
    await expectNoDocumentOverflow(page)
  })

  test('certification detail keeps reads honest and identifies each header launch', async ({
    page,
  }) => {
    mockCertDetailTrajectory(page, 3)

    const detailGate = deferred()
    let detailReads = 0
    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${CERT_DETAIL_MOCK_IDS.enrollmentId}(\\?|$)`),
      async (route) => {
        detailReads += 1
        await detailGate.promise
        await route.fallback()
      },
    )

    const sessionGate = deferred()
    const mockExamGate = deferred()
    let sessionStarts = 0
    let mockExamStarts = 0
    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${CERT_DETAIL_MOCK_IDS.enrollmentId}/sessions$`),
      async (route) => {
        sessionStarts += 1
        await sessionGate.promise
        await fulfilProblem(route, 'Session launch failed')
      },
    )
    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${CERT_DETAIL_MOCK_IDS.enrollmentId}/mock-exams$`),
      async (route) => {
        if (route.request().method() !== 'POST') {
          await route.fallback()
          return
        }
        mockExamStarts += 1
        await mockExamGate.promise
        await fulfilProblem(route, 'Mock exam launch failed')
      },
    )

    await gotoAuthenticated(page, `/user-certifications/${CERT_DETAIL_MOCK_IDS.enrollmentId}`)
    await expect.poll(() => detailReads).toBe(1)
    await expect(page.getByTestId('cert-detail-loading')).toBeVisible()
    await expect(page.getByTestId('cert-header-bar')).toHaveCount(0)

    detailGate.resolve()
    await expect(page.getByTestId('cert-header-bar')).toBeVisible()

    const startSession = page.getByTestId('cert-header-start-session')
    const startMockExam = page.getByTestId('cert-header-mock-exam')
    await startSession.click()
    await expect.poll(() => sessionStarts).toBe(1)
    await expect(startSession).toHaveAttribute('aria-busy', 'true')
    await expect(startSession).toContainText('Starting…')
    await expect(startMockExam).not.toHaveAttribute('aria-busy', 'true')
    await attemptDisabledActivation(startSession)
    expect(sessionStarts).toBe(1)
    sessionGate.resolve()
    await expect(page.getByRole('alert')).toContainText(/session/i)
    await expect(startSession).toBeEnabled()

    await startMockExam.click()
    await expect.poll(() => mockExamStarts).toBe(1)
    await expect(startMockExam).toHaveAttribute('aria-busy', 'true')
    await expect(startMockExam).toContainText('Starting…')
    await expect(startSession).not.toHaveAttribute('aria-busy', 'true')
    await expect(startMockExam).toBeDisabled()
    expect(mockExamStarts).toBe(1)
    mockExamGate.resolve()
    await expect(page.getByRole('alert')).toContainText(/mock exam/i)
    await expect(page).toHaveURL(
      new RegExp(`/user-certifications/${CERT_DETAIL_MOCK_IDS.enrollmentId}$`),
    )
  })

  test('dashboard session and mock-exam launches keep operation identity', async ({ page }) => {
    mockDashboardHero(page)
    const enrollmentId = DASHBOARD_MOCK_IDS.heroEnrollmentId

    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${enrollmentId}/review(\\?|$)`),
      async (route) => {
        await fulfilJson(route, 200, { items: [], meta: { dueCount: 3, total: 3 } })
      },
    )

    const sessionGate = deferred()
    const mockExamGate = deferred()
    let sessionStarts = 0
    let mockExamStarts = 0
    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${enrollmentId}/sessions$`),
      async (route) => {
        sessionStarts += 1
        await sessionGate.promise
        await fulfilProblem(route, 'Session launch failed')
      },
    )
    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${enrollmentId}/mock-exams$`),
      async (route) => {
        mockExamStarts += 1
        await mockExamGate.promise
        await fulfilProblem(route, 'Mock exam launch failed')
      },
    )
    await gotoAuthenticated(page, '/')
    const session = page.getByTestId('start-session-btn')
    const mockExam = page.getByTestId('mock-exam-btn')
    const review = page.getByTestId('review-start-btn')
    await expect(review).toBeVisible()

    await session.click()
    await expect.poll(() => sessionStarts).toBe(1)
    await expect(session).toHaveAttribute('aria-busy', 'true')
    await expect(session).toContainText('Starting…')
    await expect(mockExam).not.toHaveAttribute('aria-busy', 'true')
    await attemptDisabledActivation(session)
    expect(sessionStarts).toBe(1)
    sessionGate.resolve()
    await expect(session).toBeEnabled()

    await mockExam.click()
    await expect.poll(() => mockExamStarts).toBe(1)
    await expect(mockExam).toHaveAttribute('aria-busy', 'true')
    await expect(session).not.toHaveAttribute('aria-busy', 'true')
    await attemptDisabledActivation(mockExam)
    expect(mockExamStarts).toBe(1)
    mockExamGate.resolve()
    await expect(mockExam).toBeEnabled()
  })

  test('quick and custom session starts recover without losing configuration, and explanation Retry retains content', async ({
    page,
  }) => {
    mockSessionLoop(page)

    const quickGate = deferred()
    const customGate = deferred()
    let sessionCreates = 0
    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${SESSION_IDS.enrollmentId}/sessions$`),
      async (route) => {
        sessionCreates += 1
        await (sessionCreates === 1 ? quickGate.promise : customGate.promise)
        await fulfilProblem(route, 'Session creation failed')
      },
    )

    await gotoAuthenticated(page, `/user-certifications/${SESSION_IDS.enrollmentId}/session/start`)
    const quickStart = page.getByTestId('quick-start-button')
    await quickStart.click()
    await expect.poll(() => sessionCreates).toBe(1)
    await expect(quickStart).toHaveAttribute('aria-busy', 'true')
    await expect(quickStart).toContainText('Starting…')
    await attemptDisabledActivation(quickStart)
    expect(sessionCreates).toBe(1)
    quickGate.resolve()
    await expect(page.getByTestId('quick-start-error')).toBeVisible()

    await page.getByTestId('customise-link').click()
    const secureDomain = page.getByTestId('domain-toggle-Secure Architectures')
    const resilientDomain = page.getByTestId('domain-toggle-Resilient Architectures')
    await secureDomain.click()
    await resilientDomain.click()
    await page.getByTestId('duration-option-30').click()

    const customStart = page.getByTestId('custom-start-button')
    await customStart.click()
    await expect.poll(() => sessionCreates).toBe(2)
    await expect(customStart).toHaveAttribute('aria-busy', 'true')
    await attemptDisabledActivation(customStart)
    expect(sessionCreates).toBe(2)
    customGate.resolve()
    await expect(page.getByTestId('custom-start-error')).toContainText(/kept/i)
    await expect(secureDomain).toHaveAttribute('aria-pressed', 'true')
    await expect(resilientDomain).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('duration-option-30')).toHaveAttribute('aria-pressed', 'true')

    const explanationGate = deferred()
    let explanationReads = 0
    mockRoute(
      page,
      new RegExp(`/api/v1/sessions/${SESSION_IDS.sessionId}/items/0/go-deeper$`),
      async (route) => {
        explanationReads += 1
        if (explanationReads === 1) {
          await explanationGate.promise
          await fulfilProblem(route, 'Explanation generation failed')
          return
        }
        await route.fallback()
      },
    )

    await gotoAuthenticated(page, `/sessions/${SESSION_IDS.sessionId}`)
    const tldr = page.getByTestId('reading-tldr')
    const citations = page.getByTestId('citation-chip')
    const explanation = page.getByTestId('read-full-explanation-button')
    await expect(tldr).toContainText(/guardrails/i)
    await explanation.click()
    await expect.poll(() => explanationReads).toBe(1)
    await expect(explanation).toHaveAttribute('aria-busy', 'true')
    await expect(explanation).toContainText('Loading…')
    await expect(tldr).toBeVisible()
    await expect(citations.first()).toBeVisible()
    await attemptDisabledActivation(explanation)
    expect(explanationReads).toBe(1)

    explanationGate.resolve()
    await expect(page.getByTestId('reading-expansion-error')).toBeVisible()
    await expect(explanation).toContainText('Retry')
    await expect(tldr).toBeVisible()
    await explanation.click()
    await expect.poll(() => explanationReads).toBe(2)
    await expect(page.getByTestId('reading-expanded-content')).toBeVisible()
    await expect(tldr).toBeVisible()
  })

  test('Progress regions delay, fail, retry locally, and keep charts contained at 375px', async ({
    page,
  }) => {
    mockProgressLoop(page)

    const readinessGate = deferred()
    let readinessReads = 0
    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${PROGRESS_IDS.enrollmentId}/readiness(\\?|$)`),
      async (route) => {
        readinessReads += 1
        if (readinessReads === 1) {
          await readinessGate.promise
          await fulfilProblem(route, 'Readiness history failed')
          return
        }
        await route.fallback()
      },
    )

    await page.setViewportSize({ width: 375, height: 812 })
    await gotoAuthenticated(page, `/user-certifications/${PROGRESS_IDS.enrollmentId}/progress`)
    await expect.poll(() => readinessReads).toBe(1)
    const trendRegion = page.getByTestId('progress-trend-region')
    await expect(trendRegion).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByTestId('readiness-trend')).toHaveCount(0)
    await expect(page.getByText(/0 sessions total/i)).toHaveCount(0)

    readinessGate.resolve()
    await expect(trendRegion.getByText(/couldn’t load readiness history/i)).toBeVisible()
    await expect(page.getByTestId('progress-domain-row').first()).toBeVisible()
    await trendRegion.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => readinessReads).toBe(2)
    await expect(page.getByTestId('readiness-trend')).toBeVisible()
    await expect(page.getByTestId('progress-domain-row').first()).toBeVisible()

    await expectContainedLabels(page.getByTestId('readiness-trend'))
    await expectContainedLabels(page.getByTestId('accuracy-bars'))
    await expectNoDocumentOverflow(page)
  })

  test('Quick Review delays caught-up content, retries failure to due content, and fits at 375px', async ({
    page,
  }) => {
    mockReviewLoop(page)

    const queueGate = deferred()
    const reviewStartGate = deferred()
    let queueReads = 0
    let reviewStarts = 0
    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${REVIEW_IDS.enrollmentId}/review(\\?|$)`),
      async (route) => {
        queueReads += 1
        if (queueReads <= 2) {
          await queueGate.promise
          await fulfilProblem(route, 'Review queue failed')
          return
        }
        await route.fallback()
      },
    )
    mockRoute(
      page,
      new RegExp(`/api/v1/user-certifications/${REVIEW_IDS.enrollmentId}/review/start$`),
      async (route) => {
        reviewStarts += 1
        await reviewStartGate.promise
        await fulfilProblem(route, 'Review start failed')
      },
    )

    await page.setViewportSize({ width: 375, height: 812 })
    await gotoAuthenticated(page, `/user-certifications/${REVIEW_IDS.enrollmentId}/review`)
    await expect.poll(() => queueReads).toBe(2)
    const queueRegion = page.getByTestId('review-queue-region')
    await expect(queueRegion).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByTestId('review-all-caught-up')).toHaveCount(0)
    await expect(page.getByTestId('start-review-button')).toHaveCount(0)

    queueGate.resolve()
    await expect(page.getByTestId('review-queue-error')).toBeVisible()
    await expect(page.getByTestId('review-all-caught-up')).toHaveCount(0)
    await queueRegion.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => queueReads).toBe(3)
    await expect(page.getByTestId('review-due-count')).toContainText('5')
    const startReview = page.getByTestId('start-review-button')
    await startReview.click()
    await expect.poll(() => reviewStarts).toBe(1)
    await expect(startReview).toHaveAttribute('aria-busy', 'true')
    await expect(startReview).toContainText('Starting…')
    await attemptDisabledActivation(startReview)
    expect(reviewStarts).toBe(1)
    reviewStartGate.resolve()
    await expect(page.getByTestId('review-start-error')).toBeVisible()
    await expect(startReview).toBeEnabled()
    await expectNoDocumentOverflow(page)
  })

  test('Settings profile Retry, digest rollback, and deletion expose truthful operation state', async ({
    page,
  }) => {
    mockSettings(page)

    const profileGate = deferred()
    let profileReads = 0
    mockRoute(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback()
        return
      }
      profileReads += 1
      if (profileReads === 1) {
        await route.fallback()
        return
      }
      if (profileReads <= 3) {
        if (profileReads === 2) await profileGate.promise
        await fulfilProblem(route, 'Settings profile failed')
        return
      }
      await route.fallback()
    })

    await gotoAuthenticated(page, '/settings')
    await expect.poll(() => profileReads).toBe(2)
    const settingsRegion = page.getByTestId('settings-content-region')
    await expect(settingsRegion).toHaveAttribute('aria-busy', 'true')
    await expect(page.getByTestId('account-email')).toHaveCount(0)
    profileGate.resolve()
    await expect(page.getByText(/couldn’t load your settings/i)).toBeVisible()
    await expect.poll(() => profileReads).toBe(3)
    await settingsRegion.getByRole('button', { name: 'Retry' }).click()
    await expect.poll(() => profileReads).toBe(4)
    await expect(page.getByTestId('account-email')).toContainText(SETTINGS_PROFILE.email)

    const digestGate = deferred()
    let digestPatches = 0
    mockRoute(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
      if (
        route.request().method() !== 'PATCH' ||
        route.request().postDataJSON()?.digestOptOut === undefined
      ) {
        await route.fallback()
        return
      }
      digestPatches += 1
      await digestGate.promise
      await fulfilProblem(route, 'Digest preference failed')
    })

    await page.getByTestId('settings-tab-notifications').click()
    const digest = page.getByTestId('digest-toggle')
    await expect(digest).toHaveAttribute('aria-checked', 'true')
    await digest.click()
    await expect.poll(() => digestPatches).toBe(1)
    await expect(digest).toHaveAttribute('aria-busy', 'true')
    await attemptDisabledActivation(digest)
    expect(digestPatches).toBe(1)
    digestGate.resolve()
    await expect(page.getByTestId('digest-error')).toBeVisible()
    await expect(digest).toHaveAttribute('aria-checked', 'true')

    const deleteGate = deferred()
    let deletes = 0
    mockRoute(page, /\/api\/v1\/users\/me(\?|$)/, async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.fallback()
        return
      }
      deletes += 1
      await deleteGate.promise
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' })
    })

    await page.getByTestId('settings-tab-account').click()
    await page.getByTestId('delete-account-btn').click()
    await page.getByTestId('delete-password-input').fill('correct horse battery staple')
    const confirmDelete = page.getByTestId('confirm-delete-btn')
    await confirmDelete.click()
    await expect.poll(() => deletes).toBe(1)
    await expect(confirmDelete).toHaveAttribute('aria-busy', 'true')
    await expect(confirmDelete).toContainText('Deleting…')
    await attemptDisabledActivation(confirmDelete)
    expect(deletes).toBe(1)
    deleteGate.resolve()
    await expect(page).toHaveURL(/\/login/)
  })

  test('Admin Reject, Re-verify, and Create identify only their initiating operation', async ({
    page,
  }) => {
    mockAdmin(page)

    const rejectGate = deferred()
    const reverifyGate = deferred()
    const createGate = deferred()
    let rejects = 0
    let reverifications = 0
    let creates = 0
    mockRoute(
      page,
      new RegExp(`/api/v1/admin/quarantine/${QUARANTINE_ITEM_B_ID}/reject$`),
      async (route) => {
        rejects += 1
        await rejectGate.promise
        await fulfilJson(route, 200, { data: { id: QUARANTINE_ITEM_B_ID, status: 'rejected' } })
      },
    )
    mockRoute(
      page,
      new RegExp(`/api/v1/admin/certifications/${CERT_ID}/reverify$`),
      async (route) => {
        reverifications += 1
        await reverifyGate.promise
        await fulfilJson(route, 200, { data: { id: CERT_ID } })
      },
    )
    mockRoute(page, /\/api\/v1\/admin\/certifications(\?|$)/, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback()
        return
      }
      creates += 1
      await createGate.promise
      await fulfilJson(route, 201, { data: { id: CERT_ID, state: 'draft' } })
    })

    await gotoAuthenticated(page, '/admin/review-queue')
    await page
      .locator(`[data-testid="review-queue-item"][data-item-id="${QUARANTINE_ITEM_B_ID}"]`)
      .click()
    const reject = page.getByTestId('reject-item-btn')
    const approve = page.getByTestId('approve-item-btn')
    await reject.click()
    await expect.poll(() => rejects).toBe(1)
    await expect(reject).toHaveAttribute('aria-busy', 'true')
    await expect(reject).toContainText('Rejecting…')
    await expect(approve).toBeDisabled()
    await expect(approve).not.toContainText('Rejecting…')
    await attemptDisabledActivation(reject)
    expect(rejects).toBe(1)
    rejectGate.resolve()
    await expect(page.getByTestId('review-queue-detail-empty')).toBeVisible()

    await gotoAuthenticated(page, '/admin/certifications')
    await page
      .locator(`[data-testid="due-reverification-row"][data-cert-id="${CERT_ID}"]`)
      .getByTestId('reverify-btn')
      .click()
    const reverify = page.getByTestId('reverify-submit-btn')
    await reverify.click()
    await expect.poll(() => reverifications).toBe(1)
    await expect(reverify).toHaveAttribute('aria-busy', 'true')
    await expect(reverify).toContainText('Re-verifying…')
    await attemptDisabledActivation(reverify)
    expect(reverifications).toBe(1)
    reverifyGate.resolve()
    await expect(page.getByTestId('reverify-diff-modal')).toHaveCount(0)

    await gotoAuthenticated(page, '/admin/certifications/new')
    await page
      .getByTestId('identify-name-input')
      .fill('AWS Certified Solutions Architect — Associate')
    await page.getByTestId('identify-code-input').fill('SAA-C03')
    await page.getByTestId('identify-provider-input').fill('Amazon Web Services')
    await page.getByTestId('identify-search-btn').click()
    await page.getByTestId('source-candidate').first().click()
    await page.getByTestId('confirm-source-btn').click()
    await expect(page.getByTestId('cert-provider-input')).toHaveValue('Amazon Web Services')

    const create = page.getByTestId('submit-draft-btn')
    await create.click()
    await expect.poll(() => creates).toBe(1)
    await expect(create).toHaveAttribute('aria-busy', 'true')
    await expect(create).toContainText('Creating…')
    await attemptDisabledActivation(create)
    expect(creates).toBe(1)
    createGate.resolve()
    await expect(page.getByTestId('cert-coverage')).toBeVisible()
  })

  test('Add Certification preserves options through delayed failure/Retry and traps/restores keyboard focus', async ({
    page,
  }) => {
    mockDashboardHero(page)

    const availableCertification = {
      id: '44444444-dddd-dddd-dddd-dddddddddddd',
      name: 'Azure Administrator Associate',
      provider: 'Azure',
      code: 'AZ-104',
      domains: [{ name: 'Manage Azure identities and governance', weight: 100 }],
      questionCount: 60,
      passingScore: 70,
      timeLimitMinutes: 120,
      state: 'live',
    }
    const catalog = {
      data: [
        {
          ...availableCertification,
          id: DASHBOARD_MOCK_IDS.heroCertificationId,
          name: 'AWS Certified Solutions Architect — Associate',
          provider: 'AWS',
          code: 'SAA-C03',
        },
        availableCertification,
      ],
      meta: { total: 2, page: 1, limit: 20 },
    }

    const refreshGate = deferred()
    let catalogReads = 0
    mockRoute(page, /\/api\/v1\/certifications(\?|$)/, async (route) => {
      catalogReads += 1
      if (catalogReads <= 2) {
        await fulfilJson(route, 200, catalog)
        return
      }
      if (catalogReads <= 4) {
        if (catalogReads === 3) await refreshGate.promise
        await fulfilProblem(route, 'Certification catalog failed')
        return
      }
      await fulfilJson(route, 200, catalog)
    })

    await gotoAuthenticated(page, '/')
    const opener = page.getByTestId('add-cert')
    await expect(opener).toBeVisible()
    await expect.poll(() => catalogReads).toBe(2)
    await page.evaluate(() => {
      const staleNow = Date.now() + 31_000
      Date.now = () => staleNow
    })
    await reachWithKeyboard(page, opener)
    await page.keyboard.press('Enter')

    const modal = page.getByTestId('add-cert-modal')
    const close = page.getByTestId('add-cert-close-dialog')
    const option = page
      .getByTestId('add-cert-option')
      .filter({ hasText: availableCertification.name })
    await expect(modal).toBeVisible()
    await expect(close).toBeFocused()
    await expect.poll(() => catalogReads).toBe(3)
    await expect(option).toBeVisible()
    await expect(modal.getByText(/refreshing available certifications/i)).toBeVisible()

    refreshGate.resolve()
    await expect.poll(() => catalogReads).toBe(4)
    await expect(page.getByTestId('add-cert-list-refresh-error')).toBeVisible()
    await expect(option).toBeVisible()
    await page
      .getByTestId('add-cert-list-refresh-error')
      .getByRole('button', { name: 'Retry' })
      .click()
    await expect.poll(() => catalogReads).toBe(5)
    await expect(page.getByTestId('add-cert-list-refresh-error')).toHaveCount(0)
    await expect(option).toBeVisible()

    await close.press('Shift+Tab')
    await expect(option).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)
    await expect(opener).toBeFocused()
  })
})
