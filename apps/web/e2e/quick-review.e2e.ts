import { expect, test } from '@playwright/test'
import {
  mockReviewAllCaughtUp,
  mockReviewLoop,
  mockReviewSelfGrade,
  REVIEW_IDS,
} from './support/quick-review-seed'
import { gotoAuthenticated } from './support/session-view-seed'

// ============================================================================
// web-progress — 5-minute quick-review acceptance test (outer-loop RED).
//
// Drives the real apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil) — see
// design.md Test Boundaries. No running NestJS API or Postgres is required.
//
// CONTRACT FOR LATER IMPLEMENTER GROUPS (2–5): the routes and data-testids asserted below are the
// contract the implementation must satisfy. Keep them in sync.
//
// Route under test
//   Review run loop : /user-certifications/:id/review   (reviewRunPath in runnerRoutes.ts)
//
// Consumed endpoints (all already committed in apps/web/src/api/)
//   GET  /api/v1/user-certifications/:id/review         (queue entry + due count)
//   POST /api/v1/user-certifications/:id/review/start   (start the review session)
//   GET  /api/v1/sessions/:id?include=items             (load session items after start)
//   POST /api/v1/sessions/:id/end                       (end the review session)
//   GET  /api/v1/sessions/:id/summary                   (completion breakdown)
//   POST /api/v1/sessions/:id/drill                     (drill-my-misses follow-up)
//   POST /api/v1/quiz/:questionId/submit                (answer submission)
//   POST /api/v1/quiz/:questionId/explanation           (on-demand explanation)
//   POST /api/v1/quiz/:questionId/report                (report question)
//
// Key data-testids
//   Queue entry    : review-queue-entry, review-due-count, review-domain-breakdown,
//                    start-review-button
//   Quiz loop      : quiz-card (reused), quiz-option (reused), confidence-option-4 (reused),
//                    quiz-submit-button (reused), quiz-continue-button (reused),
//                    quiz-report-button (reused), citation-chip (reused)
//   Completion     : session-summary-page (reused), summary-accuracy (reused),
//                    drill-button (reused), summary-back-button
//   Empty state    : review-all-caught-up
// ============================================================================

test.describe('web-progress — 5-minute review loop', () => {
  test('queue entry shows due count + domain breakdown → start → quiz/confidence loop → completion → drill', async ({
    page,
  }) => {
    mockReviewLoop(page)

    await gotoAuthenticated(page, `/user-certifications/${REVIEW_IDS.enrollmentId}/review`)

    // --- Queue-entry scene ---
    await expect(page.getByTestId('review-queue-entry')).toBeVisible()

    // Due count drives the "Start review" CTA label and urgency badge.
    await expect(page.getByTestId('review-due-count')).toContainText('5')

    // Per-domain breakdown shows the two seeded domains (Secure: 3, Resilient: 2).
    await expect(page.getByTestId('review-domain-breakdown')).toBeVisible()
    await expect(page.getByTestId('review-domain-breakdown')).toContainText(/Secure Architectures/i)
    await expect(page.getByTestId('review-domain-breakdown')).toContainText(
      /Resilient Architectures/i,
    )

    // --- Start review → quiz/confidence loop ---
    await page.getByTestId('start-review-button').click()

    // The quiz card appears (reusing the web-session-view QuizCard surface).
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

    // The chosen option is coloured; the answer is accepted.
    await expect(
      quiz.getByTestId('quiz-option').filter({ hasText: /Glacier Flexible Retrieval/i }),
    ).toHaveAttribute('data-state', 'correct')

    // Advance to next item (or completion when this is the last item).
    await page.getByTestId('quiz-continue-button').click()

    // --- Completion scene: reused SessionSummaryBody ---
    await expect(page.getByTestId('session-summary-page')).toBeVisible()
    await expect(page.getByTestId('summary-accuracy')).toBeVisible()

    // Drill-my-misses CTA and a back button are present on the completion screen.
    await expect(page.getByTestId('drill-button')).toBeVisible()
    await expect(page.getByTestId('summary-back-button')).toBeVisible()

    // --- Drill my misses → drill session starts ---
    await page.getByTestId('drill-button').click()
    await expect(page.getByTestId('quiz-card')).toBeVisible()
  })

  test('all-caught-up empty state when nothing is due', async ({ page }) => {
    mockReviewAllCaughtUp(page)

    await gotoAuthenticated(page, `/user-certifications/${REVIEW_IDS.enrollmentId}/review`)

    // No due items — the page shows the all-caught-up empty state and hides the start CTA.
    await expect(page.getByTestId('review-all-caught-up')).toBeVisible()
    await expect(page.getByTestId('start-review-button')).toHaveCount(0)
  })

  test('self-grade loop: reveal → grade → advance through all items → completion with counts', async ({
    page,
  }) => {
    mockReviewSelfGrade(page)

    await gotoAuthenticated(page, `/user-certifications/${REVIEW_IDS.enrollmentId}/review`)

    // --- Queue-entry scene ---
    await expect(page.getByTestId('review-queue-entry')).toBeVisible()

    // --- Enter self-grade mode ---
    await page.getByTestId('start-self-grade-button').click()

    // --- Self-grade card loop: grade 5 items (good, again, hard, good, easy) ---
    // Each iteration: card visible → reveal → tap grade → next card (or completion).
    const gradeSequence = [
      'grade-good',
      'grade-again',
      'grade-hard',
      'grade-good',
      'grade-easy',
    ] as const

    for (const gradeTestId of gradeSequence) {
      await expect(page.getByTestId('self-grade-card')).toBeVisible()
      await page.getByTestId('reveal-button').click()
      await page.getByTestId(gradeTestId).click()
    }

    // --- Completion scene ---
    await expect(page.getByTestId('self-grade-completion')).toBeVisible()

    // Per-grade breakdown: good ×2, again ×1, hard ×1, easy ×1.
    await expect(page.getByTestId('self-grade-count-good')).toContainText('2')
    await expect(page.getByTestId('self-grade-count-again')).toContainText('1')
    await expect(page.getByTestId('self-grade-count-hard')).toContainText('1')
    await expect(page.getByTestId('self-grade-count-easy')).toContainText('1')
  })
})
