import { expect, test } from '@playwright/test'
import {
  mockReviewAllCaughtUp,
  mockReviewLoop,
  mockReviewSelfGrade,
  REVIEW_IDS,
} from './support/quick-review-seed'
import { gotoAuthenticated } from './support/session-view-seed'

// ============================================================================
// web-progress — 5-minute quick-review acceptance test (outer loop).
//
// Drives the real apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil) — see
// design.md Test Boundaries. No running NestJS API or Postgres is required.
//
// CORRECTED CONTRACT (web-review-entry-polish): the design's single-entry model means the single
// primary "Start review" launches the SELF-GRADE flashcard flow, where the Again/Hard/Good/Easy
// rating is revealed IN-FLOW on the card — it is NOT a separate entry button. The quiz + confidence
// run loop stays reachable as a secondary in-flow rating mode (review-mode-toggle), never as the
// thing the single Start launches.
//
// Route under test
//   Review run loop : /user-certifications/:id/review   (reviewRunPath in runnerRoutes.ts)
//
// Key data-testids
//   Queue entry    : review-queue-entry, review-due-count, review-domain-breakdown,
//                    review-domain-chip, start-review-button, review-mode-toggle,
//                    review-mode-self-grade, review-mode-quiz
//   Self-grade     : self-grade-card, reveal-button, grade-again/hard/good/easy,
//                    self-grade-completion
//   Quiz loop      : quiz-card (reused), quiz-option (reused), confidence-option-4 (reused),
//                    quiz-submit-button (reused), quiz-continue-button (reused)
//   Completion     : session-summary-page (reused), summary-accuracy (reused),
//                    drill-button (reused), summary-back-button
//   Empty state    : review-all-caught-up
// ============================================================================

test.describe('web-progress — 5-minute review loop', () => {
  test('single Start review → self-grade flashcard flow (reveal → Again/Hard/Good/Easy in-flow) → completion', async ({
    page,
  }) => {
    mockReviewSelfGrade(page)

    await gotoAuthenticated(page, `/user-certifications/${REVIEW_IDS.enrollmentId}/review`)

    // --- Queue-entry scene ---
    await expect(page.getByTestId('review-queue-entry')).toBeVisible()
    await expect(page.getByTestId('review-due-count')).toContainText('5')

    // Per-domain breakdown renders as CHIPS (pill: domain label + accent count), one chip per
    // distinct domain. Two seeded domains (Secure: 3, Resilient: 2).
    await expect(page.getByTestId('review-domain-breakdown')).toBeVisible()
    const domainChips = page.getByTestId('review-domain-chip')
    await expect(domainChips).toHaveCount(2)
    await expect(domainChips.filter({ hasText: /Secure Architectures/i })).toContainText('3')
    await expect(domainChips.filter({ hasText: /Resilient Architectures/i })).toContainText('2')

    // Single-entry model: no separate self-grade entry button alongside "Start review".
    await expect(page.getByTestId('start-self-grade-button')).toHaveCount(0)

    // --- Start review → self-grade flow (self-grade is the default in-flow rating) ---
    await page.getByTestId('start-review-button').click()

    // Reveal the card, then rate it with the in-flow Again/Hard/Good/Easy self-grade. Repeat for all
    // five due items, after which the self-grade completion breakdown appears.
    for (let i = 0; i < 5; i += 1) {
      await expect(page.getByTestId('self-grade-card')).toBeVisible()
      await page.getByTestId('reveal-button').click()
      await page.getByTestId('grade-good').click()
    }

    await expect(page.getByTestId('self-grade-completion')).toBeVisible()
    await expect(page.getByTestId('self-grade-count-good')).toContainText('5')
  })

  test('all-caught-up empty state when nothing is due', async ({ page }) => {
    mockReviewAllCaughtUp(page)

    await gotoAuthenticated(page, `/user-certifications/${REVIEW_IDS.enrollmentId}/review`)

    // No due items — the page shows the all-caught-up empty state and hides the start CTA.
    await expect(page.getByTestId('review-all-caught-up')).toBeVisible()
    await expect(page.getByTestId('start-review-button')).toHaveCount(0)
  })

  test('single-entry model: chips + one Start review, no separate self-grade entry button', async ({
    page,
  }) => {
    // The self-grade entry button (start-self-grade-button) is removed: the Again/Hard/Good/Easy
    // self-grade rating is an in-flow revealed-card rating, NOT a parallel entry choice. The queue
    // entry exposes a single primary "Start review" affordance that reaches the self-grade flow.
    mockReviewSelfGrade(page)

    await gotoAuthenticated(page, `/user-certifications/${REVIEW_IDS.enrollmentId}/review`)

    // --- Queue-entry scene ---
    await expect(page.getByTestId('review-queue-entry')).toBeVisible()

    // Per-domain breakdown renders as CHIPS — one chip per distinct domain, label + count.
    const domainChips = page.getByTestId('review-domain-chip')
    await expect(domainChips).toHaveCount(2)
    await expect(domainChips.filter({ hasText: /Secure Architectures/i })).toContainText('3')
    await expect(domainChips.filter({ hasText: /Resilient Architectures/i })).toContainText('2')

    // No second "Self-grade flashcards" entry button — only the single primary "Start review".
    await expect(page.getByTestId('start-self-grade-button')).toHaveCount(0)
    await expect(page.getByTestId('start-review-button')).toHaveCount(1)

    // The single Start review affordance reaches the self-grade flow: the revealed-card rating, not
    // a parallel entry choice.
    await page.getByTestId('start-review-button').click()
    await expect(page.getByTestId('self-grade-card')).toBeVisible()
    await page.getByTestId('reveal-button').click()
    await expect(page.getByTestId('grade-good')).toBeVisible()
  })

  test('quiz + confidence loop stays reachable via the secondary in-flow rating mode toggle', async ({
    page,
  }) => {
    // The quiz + confidence run loop is not deleted: it remains selectable as a secondary in-flow
    // rating mode (NOT the thing the primary Start launches). Switching the mode toggle to "Quiz"
    // and starting the run loop reaches the reused QuizCard surface.
    mockReviewLoop(page)

    await gotoAuthenticated(page, `/user-certifications/${REVIEW_IDS.enrollmentId}/review`)

    await expect(page.getByTestId('review-queue-entry')).toBeVisible()

    // Opt into the quiz rating mode (secondary affordance), then start the run loop.
    await page.getByTestId('review-mode-quiz').click()
    await page.getByTestId('start-review-button').click()

    const quiz = page.getByTestId('quiz-card')
    await expect(quiz).toBeVisible()
    await expect(quiz).toContainText(/S3/i)

    // Answer: select an option, pick confidence 4, submit.
    await quiz
      .getByTestId('quiz-option')
      .filter({ hasText: /Glacier Flexible Retrieval/i })
      .click()
    await page.getByTestId('confidence-option-4').click()
    await page.getByTestId('quiz-submit-button').click()

    await expect(
      quiz.getByTestId('quiz-option').filter({ hasText: /Glacier Flexible Retrieval/i }),
    ).toHaveAttribute('data-state', 'correct')

    await page.getByTestId('quiz-continue-button').click()

    // --- Completion scene: reused SessionSummaryBody ---
    await expect(page.getByTestId('session-summary-page')).toBeVisible()
    await expect(page.getByTestId('summary-accuracy')).toBeVisible()
    await expect(page.getByTestId('drill-button')).toBeVisible()
    await expect(page.getByTestId('summary-back-button')).toBeVisible()

    // --- Drill my misses → drill session starts ---
    await page.getByTestId('drill-button').click()
    await expect(page.getByTestId('quiz-card')).toBeVisible()
  })
})
