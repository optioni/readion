import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ReadionButton from '~/components/ReadionButton.vue'

describe('ReadionButton', () => {
  it.each([
    'primary',
    'secondary',
    'destructive',
    'icon',
  ] as const)('exposes the complete interaction recipe for the %s variant', (variant) => {
    const wrapper = mount(ReadionButton, {
      props: {
        variant,
        ...(variant === 'icon' ? { ariaLabel: 'Open actions' } : {}),
      },
      slots: { default: variant === 'icon' ? '⋯' : 'Continue' },
    })

    const button = wrapper.get('button')
    const classes = button.classes().join(' ')

    expect(button.attributes('data-variant')).toBe(variant)
    expect(classes).toContain('transition-[color,background-color,border-color,opacity,transform]')
    expect(classes).toContain('duration-150')
    expect(classes).toContain('active:scale-[0.98]')
    expect(classes).toContain('focus-visible:ring-2')
    expect(classes).toContain('focus-visible:ring-readion-focus')
    expect(classes).toContain('motion-reduce:transform-none')
    expect(classes).toContain('motion-reduce:transition-none')
    expect(classes).toMatch(/hover:/)
    expect(classes).toMatch(/active:bg-/)
  })

  it('distinguishes disabled from busy', () => {
    const disabled = mount(ReadionButton, {
      props: { disabled: true },
      slots: { default: 'Start session' },
    })
    const busy = mount(ReadionButton, {
      props: { busy: true, busyLabel: 'Starting…' },
      slots: { default: 'Start session' },
    })

    expect(disabled.get('button').attributes('disabled')).toBeDefined()
    expect(disabled.get('button').attributes('aria-busy')).toBeUndefined()
    expect(disabled.find('[data-testid="readion-button-spinner"]').exists()).toBe(false)
    expect(disabled.text()).toContain('Start session')

    expect(busy.get('button').attributes('disabled')).toBeDefined()
    expect(busy.get('button').attributes('aria-busy')).toBe('true')
    expect(busy.find('[data-testid="readion-button-spinner"]').exists()).toBe(true)
    expect(busy.text()).toContain('Starting…')
  })

  it('keeps the resting and progressive labels in one stable grid footprint', () => {
    const wrapper = mount(ReadionButton, {
      props: { busy: true, busyLabel: 'Approving…' },
      slots: { default: 'Approve' },
    })

    const labelSlot = wrapper.get('[data-testid="readion-button-label-slot"]')
    expect(labelSlot.classes()).toContain('grid')
    expect(wrapper.get('[data-testid="readion-button-rest-label"]').classes()).toContain(
      'invisible',
    )
    expect(wrapper.get('[data-testid="readion-button-busy-label"]').text()).toContain('Approving…')
  })

  it('rejects duplicate activation while busy', async () => {
    const wrapper = mount(ReadionButton, {
      props: { busy: true, busyLabel: 'Saving…' },
      slots: { default: 'Save' },
    })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('click')).toBeUndefined()
  })

  it('exposes an accessible name for an icon control', () => {
    const wrapper = mount(ReadionButton, {
      props: { variant: 'icon', ariaLabel: 'Close dialog' },
      slots: { default: '×' },
    })

    expect(wrapper.get('button').attributes('aria-label')).toBe('Close dialog')
  })

  it('exposes toggle selection through aria-pressed', async () => {
    const wrapper = mount(ReadionButton, {
      props: { variant: 'toggle', selected: false },
      slots: { default: 'Quiz-heavy' },
    })

    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
    await wrapper.setProps({ selected: true })
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('button').classes()).toContain('bg-readion-primary')
  })

  it.each([
    ['polite', 'status'],
    ['assertive', 'alert'],
  ] as const)('announces a %s operation result with the appropriate role', (tone, role) => {
    const wrapper = mount(ReadionButton, {
      props: {
        statusMessage: tone === 'polite' ? 'Defaults saved.' : 'Could not delete account.',
        statusTone: tone,
      },
      slots: { default: 'Save' },
    })

    expect(wrapper.get(`[role="${role}"]`).classes()).toContain('sr-only')
  })
})
