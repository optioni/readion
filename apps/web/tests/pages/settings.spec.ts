import { type DOMWrapper, mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SettingsPage from '~/pages/settings/index.vue'

function mountPage() {
  return mount(SettingsPage)
}

// happy-dom's getComputedStyle does not reflect v-show, so DOMWrapper.isVisible() is unreliable
// here. v-show toggles the inline `display: none` style directly, which is the dependable signal.
function panelShown(wrapper: VueWrapper, testid: string): boolean {
  const panel: DOMWrapper<Element> = wrapper.find(`[data-testid="${testid}"]`)
  return !(panel.attributes('style') ?? '').includes('display: none')
}

describe('Settings page shell', () => {
  it('renders the settings page root', () => {
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="settings-page"]').exists()).toBe(true)
  })

  it('renders exactly three tabs in order: Account, Study defaults, Notifications', () => {
    const wrapper = mountPage()
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((t) => t.attributes('data-testid'))).toEqual([
      'settings-tab-account',
      'settings-tab-study-defaults',
      'settings-tab-notifications',
    ])
    expect(tabs.map((t) => t.text())).toEqual(['Account', 'Study defaults', 'Notifications'])
  })

  it('selects the Account tab by default and shows only the account panel', () => {
    const wrapper = mountPage()
    expect(wrapper.find('[data-testid="settings-tab-account"]').attributes('aria-selected')).toBe(
      'true',
    )
    expect(
      wrapper.find('[data-testid="settings-tab-study-defaults"]').attributes('aria-selected'),
    ).toBe('false')
    expect(
      wrapper.find('[data-testid="settings-tab-notifications"]').attributes('aria-selected'),
    ).toBe('false')

    expect(panelShown(wrapper, 'account-panel')).toBe(true)
    expect(panelShown(wrapper, 'study-defaults-panel')).toBe(false)
    expect(panelShown(wrapper, 'notifications-panel')).toBe(false)
  })

  it('switches to the Study defaults tab and reveals only its panel', async () => {
    const wrapper = mountPage()
    await wrapper.find('[data-testid="settings-tab-study-defaults"]').trigger('click')

    expect(
      wrapper.find('[data-testid="settings-tab-study-defaults"]').attributes('aria-selected'),
    ).toBe('true')
    expect(wrapper.find('[data-testid="settings-tab-account"]').attributes('aria-selected')).toBe(
      'false',
    )

    expect(panelShown(wrapper, 'study-defaults-panel')).toBe(true)
    expect(panelShown(wrapper, 'account-panel')).toBe(false)
  })

  it('switches to the Notifications tab and reveals only its panel', async () => {
    const wrapper = mountPage()
    await wrapper.find('[data-testid="settings-tab-notifications"]').trigger('click')

    expect(
      wrapper.find('[data-testid="settings-tab-notifications"]').attributes('aria-selected'),
    ).toBe('true')
    expect(wrapper.find('[data-testid="settings-tab-account"]').attributes('aria-selected')).toBe(
      'false',
    )

    expect(panelShown(wrapper, 'notifications-panel')).toBe(true)
    expect(panelShown(wrapper, 'account-panel')).toBe(false)
  })
})
