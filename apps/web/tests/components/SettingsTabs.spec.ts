import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SettingsTabs from '~/components/SettingsTabs.vue'

const mainCss = readFileSync(resolve(__dirname, '../../app/assets/css/main.css'), 'utf-8')

describe('SettingsTabs active-tab underline', () => {
  it('applies the accent-label underline class to the active tab only', () => {
    const wrapper = mount(SettingsTabs, { props: { active: 'account' } })

    const activeTab = wrapper.find('[data-testid="settings-tab-account"]')
    const inactiveTab = wrapper.find('[data-testid="settings-tab-study-defaults"]')

    expect(activeTab.classes()).toContain('border-readion-accent-label')
    expect(inactiveTab.classes()).not.toContain('border-readion-accent-label')
    expect(inactiveTab.classes()).toContain('border-transparent')
  })

  it('defines --color-readion-accent-label as the indigo accent token, not left undefined', () => {
    // SettingsTabs.vue applies `border-readion-accent-label` to the active tab, but Tailwind
    // only generates that utility if `--color-readion-accent-label` is defined in the `@theme`
    // block. Without it, the class resolves to no rule at all and the border falls back to
    // `currentColor` (near-white), not the design's indigo accent (Settings.html:
    // `var(--readion-accent-label)`, `#7c8cf8`).
    expect(mainCss).toContain('--color-readion-accent-label: var(--readion-accent-label);')
    expect(mainCss).toContain('--readion-accent-label: #7c8cf8;')
    expect(mainCss).toContain('--readion-accent-label: #4338ca;')
  })
})
