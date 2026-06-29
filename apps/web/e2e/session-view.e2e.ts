import { expect, test } from '@playwright/test'
import { gotoAuthenticated, mockSessionLoop, SESSION_IDS } from './support/session-view-seed'

// ============================================================================
// web-session-view — acceptance test (outer-loop RED).
//
// Unlike the other e2e suites, this one drives the real apps/web against a FULLY MOCKED HTTP API
// (Playwright `route` fulfil + a `text/event-stream` agent mock) — see design.md Test Boundaries.
// No running NestJS API or Postgres is required.
//
// CONTRACT FOR LATER IMPLEMENTER GROUPS (2/4/6): the routes and data-testids asserted below are the
// contract the implementation must satisfy. Keep them in sync.
//
// Routes
//   Session start : /user-certifications/:enrollmentId/session/start   (minimal-chrome start screen)
//   Session view  : /sessions/:id
//   Summary       : /sessions/:id/summary
//
// Key data-testids
//   Start screen : session-start-page, quick-start-panel, quick-start-defaults,
//                  suggested-focus-banner, quick-start-button, customise-link
//   Session view : session-view-page, session-split-panel, session-header, session-timer,
//                  session-progress, end-session-button, session-content,
//                  reading-block, reading-tldr, read-full-explanation-button, citation-chip,
//                  advance-item-button,
//                  quiz-card, quiz-option, confidence-rating, confidence-option-4,
//                  quiz-submit-button, quiz-continue-button, quiz-report-button,
//                  agent-panel, agent-input, agent-send-button, agent-message, tool-result-card
//   Summary      : session-summary-page, summary-accuracy, summary-readiness, summary-domains,
//                  weak-area-delta, summary-strongest, summary-weakest, drill-button
// ============================================================================

test.describe('web-session-view — full study-session loop', () => {
  test('quick-start → session view → quiz + agent → end → summary → drill', async ({ page }) => {
    mockSessionLoop(page)

    // --- Session start (quick start) ---
    await gotoAuthenticated(page, `/user-certifications/${SESSION_IDS.enrollmentId}/session/start`)

    await expect(page.getByTestId('session-start-page')).toBeVisible()
    await expect(page.getByTestId('quick-start-panel')).toBeVisible()
    await expect(page.getByTestId('quick-start-defaults')).toBeVisible()
    await expect(page.getByTestId('suggested-focus-banner')).toContainText(/secure architectures/i)

    // Quick start posts an empty body; both 201 (new) and 200 (resume) navigate to the session view.
    await page.getByTestId('quick-start-button').click()
    await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_IDS.sessionId}$`))

    // --- Split-panel session view loads items ---
    await expect(page.getByTestId('session-view-page')).toBeVisible()
    await expect(page.getByTestId('session-split-panel')).toBeVisible()
    await expect(page.getByTestId('session-header')).toBeVisible()
    await expect(page.getByTestId('session-timer')).toBeVisible()
    await expect(page.getByTestId('session-progress')).toBeVisible()

    // Reading block: TL;DR, go-deeper, citation chip, then advance (marks the item complete).
    const reading = page.getByTestId('reading-block')
    await expect(reading).toBeVisible()
    await expect(page.getByTestId('reading-tldr')).toContainText(/guardrails/i)
    await page.getByTestId('read-full-explanation-button').click()
    await expect(page.getByTestId('citation-chip').first()).toBeVisible()
    await page.getByTestId('advance-item-button').click()

    // Quiz card: choose an option + confidence, submit, see the chosen-option result, continue.
    const quiz = page.getByTestId('quiz-card')
    await expect(quiz).toBeVisible()
    await quiz
      .getByTestId('quiz-option')
      .filter({ hasText: /service control policies/i })
      .click()
    await page.getByTestId('confidence-option-4').click()
    await page.getByTestId('quiz-submit-button').click()
    await expect(
      quiz.getByTestId('quiz-option').filter({ hasText: /service control policies/i }),
    ).toHaveAttribute('data-state', 'correct')
    await page.getByTestId('quiz-continue-button').click()

    // --- Ask the agent → streamed reply with a tool-result card ---
    await expect(page.getByTestId('agent-panel')).toBeVisible()
    await page.getByTestId('agent-input').fill('Why is the answer SCPs?')
    await page.getByTestId('agent-send-button').click()
    await expect(page.getByTestId('agent-message').last()).toContainText(/permission guardrails/i)
    await expect(page.getByTestId('tool-result-card')).toBeVisible()

    // --- End session → summary ---
    await page.getByTestId('end-session-button').click()
    await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_IDS.sessionId}/summary$`))

    await expect(page.getByTestId('session-summary-page')).toBeVisible()
    await expect(page.getByTestId('summary-accuracy')).toContainText('75')
    await expect(page.getByTestId('summary-readiness')).toContainText('66')
    await expect(page.getByTestId('summary-domains')).toBeVisible()
    await expect(page.getByTestId('weak-area-delta').first()).toBeVisible()
    await expect(page.getByTestId('summary-strongest')).toBeVisible()
    await expect(page.getByTestId('summary-weakest')).toBeVisible()

    // --- Drill my misses → started → new drill session view ---
    await page.getByTestId('drill-button').click()
    await expect(page).toHaveURL(new RegExp(`/sessions/${SESSION_IDS.drillSessionId}$`))
    await expect(page.getByTestId('session-view-page')).toBeVisible()
  })
})
