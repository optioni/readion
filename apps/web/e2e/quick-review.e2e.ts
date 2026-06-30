import { expect, test } from '@playwright/test'
import { mockReviewAllCaughtUp, mockReviewLoop, REVIEW_IDS } from './support/quick-review-seed'
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

    // Per-domain breakdown renders as CHIPS (pill: domain label + accent count), one chip per
    // distinct domain — NOT a plain row-per-domain list. Two seeded domains (Secure: 3, Resilient: 2).
    await expect(page.getByTestId('review-domain-breakdown')).toBeVisible()
    const domainChips = page.getByTestId('review-domain-chip')
    await expect(domainChips).toHaveCount(2)
    await expect(domainChips.filter({ hasText: /Secure Architectures/i })).toContainText('3')
    await expect(domainChips.filter({ hasText: /Resilient Architectures/i })).toContainText('2')

    // Single-entry model: there is NO separate self-grade entry button on the queue-entry scene.
    await expect(page.getByTestId('start-self-grade-button')).toHaveCount(0)

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

  test('single-entry model: chips + one Start review, no separate self-grade entry button', async ({
    page,
  }) => {
    // The self-grade entry button (start-self-grade-button) is removed: the Again/Hard/Good/Easy
    // self-grade rating is an in-flow revealed-card rating, NOT a parallel entry choice. The queue
    // entry exposes a single primary "Start review" affordance that reaches the review flow.
    mockReviewLoop(page)

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

    // The single Start review affordance reaches the review flow (quiz card appears).
    await page.getByTestId('start-review-button').click()
    await expect(page.getByTestId('quiz-card')).toBeVisible()
  })
})
