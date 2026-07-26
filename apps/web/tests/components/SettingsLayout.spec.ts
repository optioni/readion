import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SettingsLayout from '~/components/SettingsLayout.vue'

describe('SettingsLayout content column alignment', () => {
  it('left-aligns the contained column against the sidebar instead of centering it', () => {
    const wrapper = mount(SettingsLayout)

    const column = wrapper.find('[data-testid="account-panel"]').element.parentElement
    if (!column) {
      throw new Error('missing parent element for the account-panel content column')
    }
    const classList = Array.from(column.classList)

    // Settings.html centers the 580px column at the leading edge of the artboard (padding: 32px
    // 40px), not in the middle of the available width. `mx-auto` centers it instead, leaving a
    // large empty left gutter — remove it so the column sits flush against the design's inner
    // padding.
    expect(classList).not.toContain('mx-auto')
    expect(classList).toContain('max-w-[580px]')
  })

  it('keeps the design inner padding on the content column', () => {
    const wrapper = mount(SettingsLayout)

    const column = wrapper.find('[data-testid="account-panel"]').element.parentElement
    if (!column) {
      throw new Error('missing parent element for the account-panel content column')
    }
    const classList = Array.from(column.classList)

    expect(classList).toContain('px-4')
    expect(classList).toContain('py-8')
    expect(classList).toContain('sm:px-6')
    expect(classList).toContain('lg:px-8')
  })

  it('constrains the settings frame and tab strip without clipping phone content', () => {
    const wrapper = mount(SettingsLayout)
    const page = wrapper.get('[data-testid="settings-page"]')
    const column = wrapper.get('[data-testid="settings-content-column"]')

    expect(page.classes()).toEqual(expect.arrayContaining(['w-full', 'max-w-full', 'min-w-0']))
    expect(page.classes()).not.toContain('overflow-x-hidden')
    expect(column.classes()).toEqual(expect.arrayContaining(['w-full', 'max-w-full', 'min-w-0']))
  })
})
