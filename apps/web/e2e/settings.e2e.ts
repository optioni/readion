import { expect, test } from '@playwright/test'
import { gotoAuthenticated } from './support/session-view-seed'
import { mockSettings, SETTINGS_PROFILE } from './support/settings-seed'

// ============================================================================
// web-settings — acceptance test (outer-loop RED).
//
// Drives the real apps/web against a FULLY MOCKED HTTP API (Playwright `route` fulfil) — see
// design.md Test Boundaries. No running NestJS API or Postgres is required (frontend-only change).
//
// CONTRACT FOR LATER IMPLEMENTER GROUPS (1–7): the route and data-testids asserted below are the
// contract the implementation must satisfy. Keep them in sync.
//
// Route under test
//   Settings page : /settings   (authenticated; auth route middleware bounces anon → /login)
//
// Consumed endpoints (all already committed in apps/web/src/api/)
//   GET    /api/v1/users/me              (profile read — narrowed via userProfileResponseSchema)
//   PATCH  /api/v1/users/me              ({ displayTimezone } and/or { sessionDefaults } only)
//   DELETE /api/v1/users/me              ({ password } → 204 logout+redirect / 401 invalid)
//   POST   /api/v1/auth/change-password  ({ currentPassword, newPassword } → 200 / 401 wrong current)
//
// Key data-testids (the contract for groups 1–7)
//   Shell / layout : settings-page, app-nav-settings (data-active="true" when on /settings)
//   Tab bar        : settings-tab-account, settings-tab-study-defaults, settings-tab-notifications
//                    (active tab carries aria-selected="true"; Account selected by default)
//   Panels         : account-panel, study-defaults-panel, notifications-panel
//   Account        : account-email (read-only), account-avatar (derived initials),
//                    account-full-name (MUST be absent — User has no name attribute),
//                    timezone-select, save-timezone-btn,
//                    current-password-input, new-password-input, confirm-password-input,
//                    change-password-btn, change-password-confirmation,
//                    current-password-error, new-password-error, confirm-password-error,
//                    delete-account-btn, delete-account-modal, delete-password-input,
//                    confirm-delete-btn, delete-account-error
//   Study defaults : reuses OnboardingSessionPrefs option buttons (duration-option-60,
//                    learning-style-spaced-repetition, …) + save-defaults-btn
//   Notifications  : digest-opt-out-info (informational); NO toggles for review reminders /
//                    streak alerts / exam countdown / in-app (those testids MUST be absent)
// ============================================================================

test.describe('web-settings — settings page', () => {
  test('account → study-defaults → notifications journey: edit + save profile, change password, delete account', async ({
    page,
  }) => {
    const handles = mockSettings(page)

    await gotoAuthenticated(page, '/settings')

    // --- Shell: sidebar Settings active, three tabs, Account default ---
    await expect(page.getByTestId('settings-page')).toBeVisible()
    await expect(page.getByTestId('app-nav-settings')).toHaveAttribute('data-active', 'true')

    await expect(page.getByTestId('settings-tab-account')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('settings-tab-study-defaults')).toBeVisible()
    await expect(page.getByTestId('settings-tab-notifications')).toBeVisible()
    await expect(page.getByTestId('account-panel')).toBeVisible()

    // --- Account tab: read-only identity, no Full name field ---
    await expect(page.getByTestId('account-email')).toContainText(SETTINGS_PROFILE.email)
    await expect(page.getByTestId('account-avatar')).toBeVisible()
    await expect(page.getByTestId('account-full-name')).toHaveCount(0)

    // --- Notifications tab: digest opt-out only, no unbacked toggles, no profile mutation ---
    await page.getByTestId('settings-tab-notifications').click()
    await expect(page.getByTestId('settings-tab-notifications')).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await expect(page.getByTestId('settings-tab-account')).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByTestId('notifications-panel')).toBeVisible()
    await expect(page.getByTestId('digest-opt-out-info')).toBeVisible()
    await expect(page.getByTestId('notif-toggle-review-reminders')).toHaveCount(0)
    await expect(page.getByTestId('notif-toggle-streak-alerts')).toHaveCount(0)
    await expect(page.getByTestId('notif-toggle-exam-countdown')).toHaveCount(0)
    await expect(page.getByTestId('notif-toggle-in-app')).toHaveCount(0)

    // --- Study defaults tab: edit two of the five defaults and save ---
    await page.getByTestId('settings-tab-study-defaults').click()
    await expect(page.getByTestId('study-defaults-panel')).toBeVisible()

    // Profile-seeded defaults (settings-seed.ts fixture: duration 30, weak-area-focus) are pre-selected.
    await expect(page.getByTestId('duration-option-30')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('learning-style-weak-area-focus')).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await page.getByTestId('duration-option-60').click()
    await page.getByTestId('learning-style-spaced-repetition').click()
    await page.getByTestId('save-defaults-btn').click()

    await expect
      .poll(() => handles.profilePatches.at(-1))
      .toMatchObject({ sessionDefaults: { duration: 60, learningStyle: 'spaced-repetition' } })

    // --- Account tab: change display timezone and save (PATCH { displayTimezone } only) ---
    await page.getByTestId('settings-tab-account').click()
    await expect(page.getByTestId('account-panel')).toBeVisible()
    await page.getByTestId('timezone-select').selectOption('America/New_York')
    await page.getByTestId('save-timezone-btn').click()

    await expect
      .poll(() => handles.profilePatches.at(-1))
      .toEqual({ displayTimezone: 'America/New_York' })

    // --- Password: change password → POST /auth/change-password { currentPassword, newPassword } ---
    await page.getByTestId('current-password-input').fill('correcthorse')
    await page.getByTestId('new-password-input').fill('batterystaple9')
    await page.getByTestId('confirm-password-input').fill('batterystaple9')
    await page.getByTestId('change-password-btn').click()

    await expect(page.getByTestId('change-password-confirmation')).toBeVisible()
    await expect
      .poll(() => handles.changePasswordBodies.at(-1))
      .toEqual({ currentPassword: 'correcthorse', newPassword: 'batterystaple9' })

    // --- Delete account: confirm modal requires password → 204 → auth cleared + redirect ---
    await page.getByTestId('delete-account-btn').click()
    await expect(page.getByTestId('delete-account-modal')).toBeVisible()
    await page.getByTestId('delete-password-input').fill('correct-horse')
    await page.getByTestId('confirm-delete-btn').click()

    await expect.poll(() => handles.deletePayloads.at(-1)).toEqual({ password: 'correct-horse' })
    await expect(page).toHaveURL(/\/login(\?|$)/)
  })

  test('wrong current password blocks the change: 401 shows an inline error, form stays editable', async ({
    page,
  }) => {
    const handles = mockSettings(page, 204, 401)

    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()
    await expect(page.getByTestId('account-panel')).toBeVisible()

    await page.getByTestId('current-password-input').fill('wrongcurrent')
    await page.getByTestId('new-password-input').fill('batterystaple9')
    await page.getByTestId('confirm-password-input').fill('batterystaple9')
    await page.getByTestId('change-password-btn').click()

    await expect
      .poll(() => handles.changePasswordBodies.at(-1))
      .toEqual({ currentPassword: 'wrongcurrent', newPassword: 'batterystaple9' })

    await expect(page.getByTestId('current-password-error')).toBeVisible()
    await expect(page.getByTestId('change-password-confirmation')).toHaveCount(0)
    await expect(page.getByTestId('change-password-btn')).toBeEnabled()
    await expect(page).toHaveURL(/\/settings(\?|$)/)
  })

  test('delete account requires a password: empty confirm sends no DELETE request', async ({
    page,
  }) => {
    const handles = mockSettings(page)

    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()

    await page.getByTestId('delete-account-btn').click()
    await expect(page.getByTestId('delete-account-modal')).toBeVisible()

    // Confirm without entering a password — the action is disabled or rejected; no request fires.
    // A bounded timeout keeps this a best-effort click: the disabled button never becomes actionable,
    // so the attempt rejects fast and the catch swallows it instead of stalling the whole test.
    await page
      .getByTestId('confirm-delete-btn')
      .click({ trial: false, timeout: 2000 })
      .catch(() => undefined)

    await expect(page.getByTestId('delete-account-modal')).toBeVisible()
    expect(handles.deletePayloads).toHaveLength(0)
  })

  test('wrong password blocks deletion: 401 keeps the modal open, shows an error, no redirect', async ({
    page,
  }) => {
    const handles = mockSettings(page, 401)

    await gotoAuthenticated(page, '/settings')
    await expect(page.getByTestId('settings-page')).toBeVisible()

    await page.getByTestId('delete-account-btn').click()
    await expect(page.getByTestId('delete-account-modal')).toBeVisible()
    await page.getByTestId('delete-password-input').fill('wrong-password')
    await page.getByTestId('confirm-delete-btn').click()

    await expect.poll(() => handles.deletePayloads.at(-1)).toEqual({ password: 'wrong-password' })

    await expect(page.getByTestId('delete-account-modal')).toBeVisible()
    await expect(page.getByTestId('delete-account-error')).toBeVisible()
    await expect(page).toHaveURL(/\/settings(\?|$)/)
  })
})
