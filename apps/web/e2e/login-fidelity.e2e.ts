import { expect, test } from '@playwright/test'
import { requireBoundingBoxes } from './support/fidelity-helpers'

// ============================================================================
// web-auth — Login design-fidelity acceptance test (outer-loop RED).
//
// Companion to the "web-ui-polish — login contained-card placement" describe block in
// auth-flow.e2e.ts (which pins the contained-width + no-SSO invariants). This spec pins the
// REMAINING fix-web-fidelity-polish deviations from openspec/design/Login.html per design.md /
// specs/web-auth/spec.md:
//   (a) the right form pane fills the full height with the `background-surface` treatment and the
//       form is vertically centered and LEFT-aligned — NOT a bordered card floating in a
//       `background-base` void (apps/web/app/layouts/auth.vue currently wraps the form in a
//       `bg-readion-background-surface` bordered `auth-card` div centered inside a
//       `bg-readion-background-base` `<main>`)
//   (b) the brand panel lists EXACTLY three feature items (the app currently renders four)
//   (c) each feature item carries a green check badge using the `status-good` token (the app
//       currently renders a plain indigo checkmark, no badge)
//   (d) the testimonial is a bordered box (the app currently renders only a `border-t` rule, not a
//       bordered container)
//
// `/login` is a PUBLIC route rendered with the `auth` layout, so a bare `page.goto('/login')`
// reaches it without any auth mocking. Per the guardrails, SSO / the `or` divider are a deliberate,
// preserved omission — this spec does not assert their presence, only (elsewhere, already covered
// by auth-flow.e2e.ts) their absence.
// ============================================================================

test.describe('web-auth — Login design fidelity (Login.html)', () => {
  test('form pane fills the surface (not a bordered card in a background-base void)', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const pane = page.locator('main')
    const form = page.locator('form')
    await expect(form).toBeVisible()

    const { paneBox, formBox } = await requireBoundingBoxes({
      paneBox: pane,
      formBox: form,
    })

    // RED: the design's pane background is `background-surface` (#1e293b). The current `<main>`
    // is `bg-readion-background-base` (#0f172a) with a separately-surfaced bordered card floating
    // inside it.
    const paneBackground = await pane.evaluate((el) => getComputedStyle(el).backgroundColor)
    expect(paneBackground).toBe('rgb(30, 41, 59)')

    // RED: left-aligned means the form sits close to the pane's leading edge (Login.html:
    // `padding: 40px 36px`), not centered as a floating card. Centering (the current
    // `items-center justify-center` treatment) leaves a gap of roughly
    // (paneBox.width - formBox.width) / 2, far larger than any reasonable leading padding.
    const leftGap = formBox.x - paneBox.x
    expect(leftGap).toBeLessThanOrEqual(80)
  })

  test('brand panel lists exactly three feature items, each with a green check badge', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const features = page.locator('aside li')

    // RED: the app currently renders four feature items (including "Covers AWS, Azure,
    // Kubernetes, and AI/ML certs", which the design's three-item list omits).
    await expect(features).toHaveCount(3)

    // RED: each feature's check icon should use the `status-good` token (#34d399), not the
    // current indigo (`text-indigo-400`, #818cf8).
    const iconColor = await features
      .first()
      .locator('svg')
      .first()
      .evaluate((el) => getComputedStyle(el).color)
    expect(iconColor).toBe('rgb(52, 211, 153)')
  })

  test('testimonial is rendered as a bordered box, not a border-top rule', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    const testimonial = page.locator('aside blockquote')
    await expect(testimonial).toBeVisible()

    const borders = await testimonial.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        left: style.borderLeftWidth,
        right: style.borderRightWidth,
        top: style.borderTopWidth,
        bottom: style.borderBottomWidth,
      }
    })

    // RED: the current markup only sets a `border-t` rule — left/right/bottom compute to 0px. A
    // bordered overlay box has a border on all four sides.
    expect(borders.left).not.toBe('0px')
    expect(borders.right).not.toBe('0px')
    expect(borders.bottom).not.toBe('0px')
  })
})
