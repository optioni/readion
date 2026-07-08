import { expect, test } from '@playwright/test'
import { MOCK_EXAM_IDS, mockMockExamLoop } from './support/mock-exam-seed'
import { gotoAuthenticated } from './support/session-view-seed'

// ============================================================================
// web-mock-exam — acceptance test (outer-loop RED).
//
// Like web-session-view, this suite drives the real apps/web against a FULLY MOCKED HTTP API
// (Playwright `route` fulfil) — see design.md Test Boundaries. No running NestJS API or Postgres is
// required. Generation stream-in is POLLING (vue-query refetchInterval on GET /mock-exams/:id), NOT SSE.
//
// CONTRACT FOR LATER IMPLEMENTER GROUPS (2–8): the routes and data-testids asserted below are the
// contract the implementation must satisfy. Keep them in sync.
//
// Route under test
//   Mock exam : /mock-exams/:id   (full-screen, minimal-chrome, agent-free — no app sidebar, no agent panel)
//
// Consumed endpoints (all already committed in apps/web/src/api/)
//   GET  /api/v1/mock-exams/:id                  — load / poll (preparing → ready) / resume / terminal
//   PUT  /api/v1/mock-exams/:id/answers/:index   — persist answer by ZERO-BASED index, body { answer }
//   POST /api/v1/mock-exams/:id/submit           — submit / auto-submit (terminal; 409 cron-race variant)
//   GET  /api/v1/mock-exams/:id/summary          — SessionSummaryResponse for the reused SessionSummaryBody
//   POST /api/v1/mock-exams/:id/drill            — { status: 'started' | 'no_misses', session? }
//
// Key data-testids
//   Page root   : mock-exam-page
//   Preparing   : exam-preparing-scene, exam-prepare-progress ("N / total ready"),
//                 exam-timer-paused (HH:MM:SS placeholder while deadline is null),
//                 exam-nav, exam-nav-square (one per question)
//   Active      : exam-active-scene, exam-header, exam-cert-chip, exam-timer (HH:MM:SS countdown),
//                 exam-question-counter ("Q N / T"), exam-domain-tag, exam-question-stem,
//                 exam-option (one per option; data-state rest|selected — NO correct/incorrect during exam),
//                 exam-prev-button, exam-skip-button, exam-next-button,
//                 exam-nav, exam-nav-square (data-state answered|current|unanswered),
//                 exam-answered-count, exam-submit-button,
//                 exam-submit-confirm, exam-submit-confirm-button
//   Results     : exam-results-scene, exam-score-hero, exam-score-value, exam-pass-badge (omitted when
//                 passed is null), exam-passing-score (e.g. "Passing score: 72%", resolved via the
//                 enrollment → certification two-hop lookup: GET /user-certifications/:enrollmentId then
//                 GET /certifications/:certificationId), exam-counts ("N correct · M incorrect ·
//                 K unanswered" — correct = Σ domainBreakdown.correct, unanswered = count of
//                 questions[].userAnswer == null, incorrect = total - correct - unanswered),
//                 exam-domain-breakdown, exam-domain-row, exam-domain-weight (per-row weight, e.g. "25%"),
//                 exam-domain-threshold-marker (per row, only when that domain's accuracy < passingScore),
//                 exam-below-threshold-note (per row, only when below threshold; text "Below passing
//                 threshold"), exam-review-button
//                 + reused SessionSummaryBody: summary-accuracy, summary-readiness, summary-domains,
//                   weak-area-delta, summary-strongest, summary-weakest, drill-button, summary-back-button
//                 (the body's ask-agent affordance is suppressed in the agent-free mock context)
//   Review      : exam-review-scene, exam-option (data-state correct|incorrect|dim revealed),
//                 exam-explanation, citation-chip, exam-nav-square (correct|incorrect|skipped),
//                 exam-review-back-button
// ============================================================================

test.describe('web-mock-exam — full timed-exam loop', () => {
  test('preparing → active → answer → submit → results → review → back', async ({ page }) => {
    mockMockExamLoop(page)

    // --- Preparing scene: poll streams questions into the nav, timer paused ---
    await gotoAuthenticated(page, `/mock-exams/${MOCK_EXAM_IDS.examId}`)

    await expect(page.getByTestId('mock-exam-page')).toBeVisible()
    await expect(page.getByTestId('exam-preparing-scene')).toBeVisible()
    await expect(page.getByTestId('exam-prepare-progress')).toContainText(/\/ 65 ready/i)
    await expect(page.getByTestId('exam-timer-paused')).toBeVisible()

    // --- Ready transitions to the active timed exam ---
    await expect(page.getByTestId('exam-active-scene')).toBeVisible()
    await expect(page.getByTestId('exam-question-counter')).toContainText(/Q 1 \/ 65/i)
    // Countdown is seeded from server remainingSeconds (6443 ≈ 01:47:23), not paused.
    await expect(page.getByTestId('exam-timer')).toContainText(/\d\d:\d\d:\d\d/)

    // --- Answer the current question (persisted by zero-based index 0); no correctness revealed ---
    const multiAz = page.getByTestId('exam-option').filter({ hasText: /multi-az/i })
    await multiAz.click()
    await expect(multiAz).toHaveAttribute('data-state', 'selected')
    await expect(page.getByTestId('exam-nav-square').first()).toHaveAttribute(
      'data-state',
      'answered',
    )

    // --- Submit warns about unanswered questions, then advances to results ---
    await page.getByTestId('exam-submit-button').click()
    await expect(page.getByTestId('exam-submit-confirm')).toContainText(/unanswered/i)
    await page.getByTestId('exam-submit-confirm-button').click()

    // --- Results: exam-faithful score hero + per-domain breakdown + reused summary body ---
    await expect(page.getByTestId('exam-results-scene')).toBeVisible()
    // score is the raw 0..1 fraction (0.73) from the API; Math.round(0.73) === 1 today, so this renders
    // "1%" instead of "73%" until the results scene formats it as a percentage.
    await expect(page.getByTestId('exam-score-value')).toContainText('73%')
    await expect(page.getByTestId('exam-pass-badge')).toContainText(/pass/i)

    // --- Passing-score reference, resolved via the enrollment → certification two-hop lookup ---
    await expect(page.getByTestId('exam-passing-score')).toContainText(/passing score: 72%/i)

    // --- Counts line: correct = Σ domainBreakdown.correct (14+11+12+9=46), unanswered = count of
    // questions[].userAnswer == null (4, Q61-Q64), incorrect = 65 - 46 - 4 = 15 ---
    await expect(page.getByTestId('exam-counts')).toContainText(/46 correct/i)
    await expect(page.getByTestId('exam-counts')).toContainText(/15 incorrect/i)
    await expect(page.getByTestId('exam-counts')).toContainText(/4 unanswered/i)

    await expect(page.getByTestId('exam-domain-breakdown')).toBeVisible()
    await expect(page.getByTestId('exam-domain-row')).toHaveCount(4)

    // --- Per-domain table: weight column + below-passing-threshold marker/note ---
    await expect(page.getByTestId('exam-domain-weight').first()).toContainText('25%')

    const secureRow = page
      .getByTestId('exam-domain-row')
      .filter({ hasText: 'Secure Architectures' })
    await expect(secureRow.getByTestId('exam-domain-threshold-marker')).toBeVisible()
    await expect(secureRow.getByTestId('exam-below-threshold-note')).toContainText(
      /below passing threshold/i,
    )

    const costOptimizedRow = page
      .getByTestId('exam-domain-row')
      .filter({ hasText: 'Cost-Optimized Architectures' })
    await expect(costOptimizedRow.getByTestId('exam-domain-threshold-marker')).toBeVisible()
    await expect(costOptimizedRow.getByTestId('exam-below-threshold-note')).toContainText(
      /below passing threshold/i,
    )

    // Domains at/above the passing score must NOT show the below-threshold note.
    const resilientRow = page
      .getByTestId('exam-domain-row')
      .filter({ hasText: 'Resilient Architectures' })
    await expect(resilientRow.getByTestId('exam-below-threshold-note')).toHaveCount(0)

    // Reused SessionSummaryBody (from web-session-view) renders readiness / weak-area / drill.
    await expect(page.getByTestId('summary-readiness')).toContainText('74')
    await expect(page.getByTestId('summary-domains')).toBeVisible()
    await expect(page.getByTestId('weak-area-delta').first()).toBeVisible()
    await expect(page.getByTestId('summary-strongest')).toBeVisible()
    await expect(page.getByTestId('summary-weakest')).toBeVisible()
    await expect(page.getByTestId('drill-button')).toBeVisible()

    // --- Review mode reveals correct/incorrect + explanation + citations ---
    await page.getByTestId('exam-review-button').click()
    await expect(page.getByTestId('exam-review-scene')).toBeVisible()
    await expect(page.getByTestId('exam-option').filter({ hasText: /multi-az/i })).toHaveAttribute(
      'data-state',
      'correct',
    )
    await expect(
      page.getByTestId('exam-option').filter({ hasText: /cross-region read replica/i }),
    ).toHaveAttribute('data-state', 'incorrect')
    await expect(page.getByTestId('exam-explanation')).toContainText(/multi-az/i)
    await expect(page.getByTestId('citation-chip').first()).toBeVisible()

    // --- Return to results ---
    await page.getByTestId('exam-review-back-button').click()
    await expect(page.getByTestId('exam-results-scene')).toBeVisible()
  })
})
