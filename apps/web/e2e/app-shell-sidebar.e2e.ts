import { expect, test } from '@playwright/test'
import { gotoAuthenticated, mockSessionLoop, SESSION_IDS } from './support/session-view-seed'
import { mockSettings } from './support/settings-seed'

// ============================================================================
// web-app-shell-sidebar — acceptance test (outer-loop RED).
//
// Drives the real apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil) — see
// design.md Test Boundaries. No running NestJS API or Postgres is required (frontend-only change).
//
// CONTRACT FOR LATER IMPLEMENTER GROUPS: the data-testids / roles asserted below are the contract
// the persistent left-sidebar shell must satisfy. Keep them in sync.
//
// Shell layout (default authenticated layout) renders a persistent LEFT SIDEBAR:
//   Sidebar root      : data-testid="app-sidebar"
//   Brand             : "Readion" wordmark inside the sidebar
//   Primary nav       : a <nav> landmark holding five items, each with data-active="true|false"
//                       and (when active) aria-current="page"
//                         app-nav-dashboard (/)        app-nav-sessions
//                         app-nav-progress             app-nav-agent (/agent)
//                         app-nav-settings (/settings)
//   Footer user block : data-testid="sidebar-user" (avatar/initials + name)
//   Relocated toggle  : the dark-mode toggle button (aria-label "Switch to light mode" /
//                       "Switch to dark mode") lives in the footer
//
// Focused full-screen flows stay BARE (minimal layout, NO sidebar): mock exam, quick-review run,
// in-session view, session start.
// ============================================================================

test.describe('web-app-shell-sidebar — persistent left sidebar shell', () => {
  test('an in-shell authenticated page renders the sidebar: brand, five nav items with correct active state, and a footer user block + dark toggle', async ({
    page,
  }) => {
    mockSettings(page)

    await gotoAuthenticated(page, '/settings')

    // The page itself loads (proves we reached an authenticated in-shell route).
    await expect(page.getByTestId('settings-page')).toBeVisible()

    // --- Sidebar root + brand ---
    const sidebar = page.getByTestId('app-sidebar')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.getByText('Readion')).toBeVisible()

    // --- Primary nav landmark with all five items ---
    const nav = sidebar.getByRole('navigation')
    await expect(nav).toBeVisible()

    const dashboard = sidebar.getByTestId('app-nav-dashboard')
    const sessions = sidebar.getByTestId('app-nav-sessions')
    const progress = sidebar.getByTestId('app-nav-progress')
    const agent = sidebar.getByTestId('app-nav-agent')
    const settings = sidebar.getByTestId('app-nav-settings')

    await expect(dashboard).toBeVisible()
    await expect(sessions).toBeVisible()
    await expect(progress).toBeVisible()
    await expect(agent).toBeVisible()
    await expect(settings).toBeVisible()

    // --- Active state: only Settings is active (data-active="true" + aria-current="page") ---
    await expect(settings).toHaveAttribute('data-active', 'true')
    await expect(settings).toHaveAttribute('aria-current', 'page')

    await expect(dashboard).toHaveAttribute('data-active', 'false')
    await expect(sessions).toHaveAttribute('data-active', 'false')
    await expect(progress).toHaveAttribute('data-active', 'false')
    await expect(agent).toHaveAttribute('data-active', 'false')

    // --- Footer: signed-in user block + relocated dark-mode toggle ---
    const userBlock = sidebar.getByTestId('sidebar-user')
    await expect(userBlock).toBeVisible()
    await expect(
      sidebar.getByRole('button', { name: /switch to (light|dark) mode/i }),
    ).toBeVisible()
  })

  test('on a phone viewport the persistent sidebar collapses to a drawer reachable via a toggle', async ({
    page,
  }) => {
    mockSettings(page)
    await page.setViewportSize({ width: 375, height: 812 })

    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()

    // No horizontal overflow at phone width — the collapsed sidebar must not push the layout.
    const noOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )
    expect(noOverflow).toBe(true)

    // The persistent sidebar is collapsed (off-canvas / not occupying the layout).
    const sidebar = page.getByTestId('app-sidebar')
    await expect(sidebar).toBeHidden()

    // A control is available to open the nav drawer.
    const toggle = page.getByTestId('sidebar-drawer-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-label', /open navigation/i)

    // After opening, the five nav items are reachable.
    await toggle.click()
    await expect(sidebar).toBeVisible()
    for (const testid of [
      'app-nav-dashboard',
      'app-nav-sessions',
      'app-nav-progress',
      'app-nav-agent',
      'app-nav-settings',
    ]) {
      await expect(sidebar.getByTestId(testid)).toBeVisible()
    }

    // The drawer can be dismissed again.
    await page.getByTestId('sidebar-drawer-close').click()
    await expect(sidebar).toBeHidden()
  })

  test('on a desktop viewport the left sidebar is visible without a toggle', async ({ page }) => {
    mockSettings(page)
    await page.setViewportSize({ width: 1440, height: 900 })

    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()

    await expect(page.getByTestId('app-sidebar')).toBeVisible()
    await expect(page.getByTestId('sidebar-drawer-toggle')).toBeHidden()
  })

  test('a focused full-screen flow renders WITHOUT the sidebar (bare chrome preserved)', async ({
    page,
  }) => {
    mockSessionLoop(page)

    await gotoAuthenticated(page, `/sessions/${SESSION_IDS.sessionId}`)

    // The focused session view loads under the bare minimal layout.
    await expect(page.getByTestId('session-view-page')).toBeVisible()

    // No persistent sidebar in focused flows.
    await expect(page.getByTestId('app-sidebar')).toHaveCount(0)
  })
})
