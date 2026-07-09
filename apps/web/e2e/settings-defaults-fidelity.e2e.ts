import { expect, test } from '@playwright/test'
import { gotoAuthenticated } from './support/session-view-seed'
import { mockSettings } from './support/settings-seed'

// ============================================================================
// web-settings — Study defaults design-fidelity acceptance test (outer-loop RED).
//
// Companion to settings.e2e.ts / settings-fidelity.e2e.ts. This spec pins the remaining
// fix-web-settings-agent-parity deviations from openspec/design/Settings.html per design.md /
// specs/web-settings/spec.md:
//   (a) Difficulty/Content mix/Learning style render raw enum slugs ("beginner", "reading-heavy",
//       "weak-area-focus") instead of human-readable labels
//   (b) Session length renders as a row of duration pill buttons instead of a slider with a live
//       "N min" readout
//   (c) the tab is missing the "Session preferences" section title and the adaptive-defaults intro
//       copy
//   (d) all five fields (incl. Focus area) must remain present and editable
//
// Route-mock style per design.md Test Boundaries: drives the real apps/web against a fully mocked
// HTTP API — no running NestJS API or Postgres required.
// ============================================================================

test.describe('web-settings — Study defaults design fidelity (Settings.html)', () => {
  test('difficulty, content-mix, and learning-style options render human-readable labels, not raw slugs', async ({
    page,
  }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')

    await page.getByTestId('settings-tab-study-defaults').click()
    await expect(page.getByTestId('study-defaults-panel')).toBeVisible()

    // RED: the current markup renders the raw enum slug as the button's visible text.
    await expect(page.getByTestId('difficulty-intermediate')).toHaveText('Intermediate')
    await expect(page.getByTestId('difficulty-intermediate')).not.toHaveText('intermediate')

    await expect(page.getByTestId('content-mix-reading-heavy')).toHaveText('Reading-heavy')
    await expect(page.getByTestId('content-mix-reading-heavy')).not.toHaveText('reading-heavy')

    await expect(page.getByTestId('learning-style-weak-area-focus')).toHaveText('Weak-area focus')
    await expect(page.getByTestId('learning-style-weak-area-focus')).not.toHaveText(
      'weak-area-focus',
    )
  })

  test('session length renders as a slider with a live "N min" readout', async ({ page }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')

    await page.getByTestId('settings-tab-study-defaults').click()
    await expect(page.getByTestId('study-defaults-panel')).toBeVisible()

    // RED: no slider input exists yet — Session length currently renders as a row of pill buttons.
    const slider = page.getByTestId('duration-slider')
    await expect(slider).toBeVisible()
    await expect(slider).toHaveAttribute('type', 'range')

    // Seeded profile default is 30 minutes (settings-seed.ts).
    await expect(page.getByTestId('duration-readout')).toHaveText('30 min')

    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByTestId('duration-readout')).toHaveText('60 min')
  })

  test('all five session defaults are present, including Focus area', async ({ page }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')

    await page.getByTestId('settings-tab-study-defaults').click()
    await expect(page.getByTestId('study-defaults-panel')).toBeVisible()

    await expect(page.getByTestId('duration-slider')).toBeVisible()
    await expect(page.getByTestId('content-mix-balanced')).toBeVisible()
    await expect(page.getByTestId('difficulty-intermediate')).toBeVisible()
    await expect(page.getByTestId('focus-area-auto')).toBeVisible()
    await expect(page.getByTestId('learning-style-weak-area-focus')).toBeVisible()
  })

  test('section title and adaptive-defaults intro copy render', async ({ page }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')

    await page.getByTestId('settings-tab-study-defaults').click()
    await expect(page.getByTestId('study-defaults-panel')).toBeVisible()

    // RED: neither the section title nor the intro copy exist yet.
    await expect(page.getByTestId('study-defaults-title')).toHaveText('Session preferences')
    await expect(page.getByTestId('study-defaults-intro')).toContainText('default starting values')
  })
})
