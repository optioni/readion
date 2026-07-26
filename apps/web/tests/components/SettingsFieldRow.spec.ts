import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SettingsFieldRow from '~/components/SettingsFieldRow.vue'

const mainCss = readFileSync(resolve(__dirname, '../../app/assets/css/main.css'), 'utf-8')

describe('SettingsFieldRow responsive layout', () => {
  it('stacks on phones and restores the fixed-width label column from the small breakpoint', () => {
    const wrapper = mount(SettingsFieldRow, {
      props: { label: 'Display timezone', for: 'timezone-select' },
      slots: { default: '<select id="timezone-select" />' },
    })

    const row = wrapper.element
    expect(Array.from(row.classList)).toContain('flex')
    expect(Array.from(row.classList)).toContain('flex-col')
    expect(Array.from(row.classList)).toContain('sm:flex-row')
    expect(Array.from(row.classList)).toContain('items-start')

    const label = wrapper.find('label')
    expect(label.exists()).toBe(true)
    expect(label.text()).toBe('Display timezone')
    expect(label.attributes('for')).toBe('timezone-select')

    const labelClasses = label.classes()
    expect(labelClasses).not.toContain('uppercase')
    expect(labelClasses).not.toContain('font-mono')

    // Fixed-width label column beside the control — Settings.html: label column width 160px.
    const labelColumn = label.element.parentElement
    if (!labelColumn) {
      throw new Error('missing label column parent element')
    }
    expect(Array.from(labelColumn.classList)).toContain('w-full')
    expect(Array.from(labelColumn.classList)).toContain('sm:w-40')
    expect(Array.from(labelColumn.classList)).toContain('sm:shrink-0')

    const controlColumn = wrapper.get('[data-testid="settings-field-control"]')
    expect(controlColumn.classes()).toEqual(expect.arrayContaining(['w-full', 'min-w-0']))
  })

  it('renders an optional hint beneath the label in the muted token', () => {
    const wrapper = mount(SettingsFieldRow, {
      props: { label: 'Email', for: 'email-field', hint: 'Used for login and notifications' },
      slots: { default: '<span id="email-field">jamie@org.io</span>' },
    })

    const hint = wrapper.find('[data-testid="field-row-hint"]')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toBe('Used for login and notifications')
    expect(hint.classes()).toContain('text-readion-text-muted')
  })
})

describe('SettingsFieldRow label colour token', () => {
  it('resolves the label colour to the Readion secondary text token, not a raw text-slate-400 class', () => {
    const wrapper = mount(SettingsFieldRow, {
      props: { label: 'Email', for: 'email-field' },
      slots: { default: '<span id="email-field">jamie@org.io</span>' },
    })

    const label = wrapper.find('label')
    expect(label.classes()).toContain('text-readion-text-secondary')
    expect(label.classes()).not.toContain('text-slate-400')
  })

  it('defines --color-readion-text-secondary and --color-readion-text-muted, not left undefined', () => {
    // The label/hint tokens only resolve if `@theme` defines the matching --color-readion-*
    // custom property (same requirement Group 1 found for --color-readion-accent-label).
    expect(mainCss).toContain('--color-readion-text-secondary: var(--readion-text-secondary);')
    expect(mainCss).toContain('--color-readion-text-muted: var(--readion-text-muted);')
    expect(mainCss).toContain('--readion-text-secondary: #94a3b8;')
    expect(mainCss).toContain('--readion-text-muted: #64748b;')
    expect(mainCss).toContain('html.light {')
    expect(mainCss).toContain('--readion-text-secondary: #334155;')
  })
})
