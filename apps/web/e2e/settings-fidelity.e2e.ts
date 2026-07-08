import { expect, test } from '@playwright/test'
import { requireBoundingBoxes } from './support/fidelity-helpers'
import { gotoAuthenticated } from './support/session-view-seed'
import { mockSettings } from './support/settings-seed'

// ============================================================================
// web-settings — design-fidelity acceptance test (outer-loop RED).
//
// Companion to settings.e2e.ts (which covers the functional journey + the already-shipped
// right-aligned-actions polish). This spec pins the REMAINING fix-web-fidelity-polish deviations
// from openspec/design/Settings.html per design.md / specs/web-settings/spec.md:
//   (a) the contained content column is LEFT-ALIGNED against the sidebar, not centered with a
//       large left gutter (SettingsLayout.vue currently uses `mx-auto max-w-[580px]`)
//   (b) fields use the horizontal FieldRow pattern — a sentence-case label in a fixed-width column
//       to the LEFT of the control — not an uppercase font-mono label stacked above
//       (AccountTab.vue currently stacks `font-mono uppercase` labels above inputs)
//   (c) the password action reads "Update password" (AccountTab.vue currently says
//       "Change password")
//   (d) the active tab's underline uses the indigo accent token — SettingsTabs.vue already applies
//       the `border-readion-accent-label` class name, but `--color-readion-accent-label` is not
//       defined anywhere in app/assets/css/main.css, so the utility never resolves and the border
//       falls back to `currentColor` (near-white), matching proposal.md's "near-white instead of
//       indigo" description
//
// Route-mock style per design.md Test Boundaries: drives the real apps/web against a fully mocked
// HTTP API — no running NestJS API or Postgres required.
// ============================================================================

test.describe('web-settings — design fidelity (Settings.html)', () => {
  test('content column is left-aligned against the sidebar, not centered', async ({ page }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')

    await expect(page.getByTestId('settings-page')).toBeVisible()
    await expect(page.getByTestId('account-panel')).toBeVisible()

    const { contentArea, contentColumn } = await requireBoundingBoxes({
      contentArea: page.getByTestId('shell-container'),
      contentColumn: page.getByTestId('account-panel'),
    })

    // Left-aligned against the sidebar means the column's left edge sits at the content area's
    // leading padding (Settings.html: `padding: 32px 40px`) — a small, fixed gap. Centering via
    // `mx-auto` instead leaves a gap of roughly (contentArea.width - 580) / 2, which is far larger
    // than any reasonable leading padding on a real (non-mobile) viewport.
    const leftGutter = contentColumn.x - contentArea.x
    expect(leftGutter).toBeLessThanOrEqual(60)
  })

  test('a field renders as a horizontal FieldRow: sentence-case label left of its control', async ({
    page,
  }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')

    await expect(page.getByTestId('account-panel')).toBeVisible()

    const label = page.locator('label[for="timezone-select"]')
    const control = page.getByTestId('timezone-select')

    const { labelBox, controlBox } = await requireBoundingBoxes({
      labelBox: label,
      controlBox: control,
    })

    // Horizontal FieldRow: label sits in a column to the LEFT of the control, on the same row (the
    // two boxes vertically overlap). The current stacked layout (`flex flex-col`) puts the label
    // fully above the control, so their vertical ranges do not overlap and the label never ends
    // before the control begins horizontally.
    const verticallyOverlaps =
      labelBox.y < controlBox.y + controlBox.height && labelBox.y + labelBox.height > controlBox.y
    expect(verticallyOverlaps).toBe(true)
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(controlBox.x)

    // Sentence-case label colour token, not the current raw `uppercase` transform.
    const textTransform = await label.evaluate((el) => getComputedStyle(el).textTransform)
    expect(textTransform).not.toBe('uppercase')
  })

  test('password action reads "Update password"', async ({ page }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')

    await expect(page.getByTestId('account-panel')).toBeVisible()
    await expect(page.getByTestId('change-password-btn')).toHaveText('Update password')
  })

  test('regression guard: active tab underline uses the indigo accent token', async ({ page }) => {
    mockSettings(page)
    await gotoAuthenticated(page, '/settings')

    const activeTab = page.getByTestId('settings-tab-account')
    await expect(activeTab).toHaveAttribute('aria-selected', 'true')

    const borderColor = await activeTab.evaluate((el) => getComputedStyle(el).borderBottomColor)
    // --readion-accent-label / --color-readion-accent-label resolves to indigo-400 (#818cf8).
    expect(borderColor).toBe('rgb(129, 140, 248)')
  })
})
