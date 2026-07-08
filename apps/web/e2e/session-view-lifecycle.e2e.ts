import { expect, test } from '@playwright/test'
import {
  gotoAuthenticated,
  mockActiveSessionWithCitationFixture,
  mockCompletedSessionView,
  mockZeroAnsweredSummary,
  SESSION_IDS,
} from './support/session-view-seed'

// ============================================================================
// web-session-view — lifecycle/fidelity acceptance tests (outer-loop RED).
//
// Companion to session-view.e2e.ts (the full happy-path loop). This file reproduces the specific
// defects from proposal.md: an ended session free-running its timer / still exposing live controls,
// a citation chip leaking a raw content-chunk UUID, a reading block missing its domain label, and a
// summary zero-state rendering misleading "0% / +0% / ↑0%" cards instead of an explicit empty state.
//
// Fully route-mocked per design.md → Test Boundaries — no running NestJS API or Postgres.
// ============================================================================

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

test.describe('web-session-view — ended-session lifecycle', () => {
  test('completed session hides the End session control, never free-runs the timer, and never ends itself again', async ({
    page,
  }) => {
    const { endCallCount } = mockCompletedSessionView(page)
    await gotoAuthenticated(page, `/sessions/${SESSION_IDS.sessionId}`)

    // Let the page settle into whichever branch it renders (active runner, summary, or a read-only
    // completed state) before asserting on control absence — asserting immediately after navigation
    // would race the loading spinner and pass for the wrong reason (nothing rendered yet).
    await expect(
      page
        .getByTestId('session-header')
        .or(page.getByTestId('session-summary-page'))
        .or(page.getByTestId('session-completed-state')),
    ).toBeVisible()

    // The active runner's live controls must not be present on an already-ended session.
    await expect(page.getByTestId('end-session-button')).toHaveCount(0)
    await expect(page.getByTestId('advance-item-button')).toHaveCount(0)

    // If a timer value is shown at all for an ended session it must be frozen at
    // `endedAt - startedAt` (~"20:00"), never a free-running `now - startedAt` value (~"2940:xx").
    const timer = page.getByTestId('session-timer')
    if ((await timer.count()) > 0) {
      const firstReading = await timer.textContent()
      await page.waitForTimeout(1300)
      const secondReading = await timer.textContent()

      expect(secondReading).toBe(firstReading)
      expect(secondReading ?? '').not.toMatch(/^\d{3,}:\d{2}$/)
    }

    expect(endCallCount()).toBe(0)
  })

  test('completed session routes to the summary or a read-only completed state instead of the live runner', async ({
    page,
  }) => {
    mockCompletedSessionView(page)
    await gotoAuthenticated(page, `/sessions/${SESSION_IDS.sessionId}`)

    await expect(
      page.getByTestId('session-summary-page').or(page.getByTestId('session-completed-state')),
    ).toBeVisible()
  })
})

test.describe('web-session-view — reading block fidelity', () => {
  test('reading block never renders a raw content-chunk UUID as a citation chip label', async ({
    page,
  }) => {
    const { citationId } = mockActiveSessionWithCitationFixture(page)
    await gotoAuthenticated(page, `/sessions/${SESSION_IDS.sessionId}`)

    const chips = page.getByTestId('citation-chip')
    await expect(chips.first()).toBeVisible()
    const chipTexts = await chips.allTextContents()

    for (const text of chipTexts) {
      expect(text).not.toMatch(UUID_PATTERN)
    }
    expect(chipTexts.join(' ')).not.toContain(citationId)
  })

  test('reading block shows the item domain label beside the Reading pill', async ({ page }) => {
    const { domain } = mockActiveSessionWithCitationFixture(page)
    await gotoAuthenticated(page, `/sessions/${SESSION_IDS.sessionId}`)

    await expect(page.getByTestId('reading-block')).toContainText(domain)
  })
})

test.describe('web-session-view — summary zero-state', () => {
  test('summary with zero answered questions shows the empty state and suppresses misleading cards', async ({
    page,
  }) => {
    mockZeroAnsweredSummary(page)
    await gotoAuthenticated(page, `/sessions/${SESSION_IDS.sessionId}/summary`)

    await expect(page.getByTestId('session-summary-page')).toBeVisible()
    await expect(page.getByText(/no questions answered this session/i)).toBeVisible()

    await expect(page.getByTestId('summary-accuracy')).toHaveCount(0)
    await expect(page.getByTestId('summary-readiness')).toHaveCount(0)
    await expect(page.getByTestId('summary-domains')).toHaveCount(0)
    await expect(page.getByTestId('weak-area-delta')).toHaveCount(0)

    await expect(page.getByTestId('summary-back-button')).toBeVisible()
  })
})
