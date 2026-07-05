import { expect, test } from '@playwright/test'
import { gotoAuthenticated, mockSessionLoop, SESSION_IDS } from './support/session-view-seed'
import {
  installUmamiRecorder,
  readUmamiEvents,
  readUmamiIdentify,
  umamiScriptCount,
} from './support/umami-e2e'

// ============================================================================
// web-analytics — acceptance test (outer-loop RED → GREEN).
//
// Drives the real apps/web against the fully-mocked session-view HTTP API (see design.md Test
// Boundaries). A recording `window.umami` stub is installed before app boot and the tracker
// `/script.js` request is fulfilled inert, so no real analytics host is contacted and every
// track()/identify() call is captured for assertion.
//
// Covers spec scenarios: config-gated bootstrap (script injected), automatic page-view wiring
// (single persistent script across navigation), UUID-only identify (never email), and the
// session-flow slice of the event catalog.
// ============================================================================

test.describe('web-analytics — user-flow tracking', () => {
  test('identifies by UUID and tracks the study-session funnel without leaking email', async ({
    page,
  }) => {
    await installUmamiRecorder(page)
    mockSessionLoop(page)

    // --- Authenticated dashboard entry: tracker injected + identify(UUID) ---
    await gotoAuthenticated(page, `/user-certifications/${SESSION_IDS.enrollmentId}/session/start`)
    await expect(page.getByTestId('session-start-page')).toBeVisible()

    // Config-gated bootstrap: exactly one tracker script is injected (proves page-view wiring).
    expect(await umamiScriptCount(page)).toBe(1)

    // Identify uses the user UUID only — never the email.
    const identifies = await readUmamiIdentify(page)
    expect(identifies).toContainEqual({ userId: SESSION_IDS.userId })

    // --- Quick start → session view ---
    await page.getByTestId('quick-start-button').click()
    await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_IDS.sessionId}$`))
    await expect(page.getByTestId('session-view-page')).toBeVisible()

    // The tracker script must not be re-injected on client-side navigation.
    expect(await umamiScriptCount(page)).toBe(1)

    // --- Answer a quiz item ---
    await page.getByTestId('advance-item-button').click()
    await expect(page.getByTestId('quiz-card')).toBeVisible()
    await page.getByTestId('quiz-option').first().click()
    await page.getByTestId('confidence-option-4').click()
    await page.getByTestId('quiz-submit-button').click()

    // --- End the session → summary ---
    await page.getByTestId('quiz-continue-button').click()
    await page.getByTestId('end-session-button').click()
    await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_IDS.sessionId}/summary$`))
    await expect(page.getByTestId('session-summary-page')).toBeVisible()

    // --- Assert the recorded funnel ---
    const events = await readUmamiEvents(page)
    const names = events.map((e) => e.event)
    expect(names).toContain('session_started')
    expect(names).toContain('quiz_answer_submitted')
    expect(names).toContain('session_ended')
    expect(names).toContain('session_completed')

    const started = events.find((e) => e.event === 'session_started')
    expect(started?.props).toMatchObject({ enrollmentId: SESSION_IDS.enrollmentId })

    // Hard privacy invariant: no event or identify payload carries the user's email.
    const allPayloads = JSON.stringify([events, await readUmamiIdentify(page)])
    expect(allPayloads).not.toContain('learner@example.com')
  })
})
