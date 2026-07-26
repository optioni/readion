import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReadionAsyncRegion from '~/components/ReadionAsyncRegion.vue'
import ReadionButton from '~/components/ReadionButton.vue'

function mountRegion(
  props: {
    loading?: boolean
    empty?: boolean
    error?: string
    refreshing?: boolean
    retrying?: boolean
  } = {},
) {
  return mount(ReadionAsyncRegion, {
    props: {
      loadingLabel: 'Loading study history…',
      refreshLabel: 'Refreshing study history…',
      emptyLabel: 'No study history yet.',
      ...props,
    },
    slots: {
      default: '<div data-testid="async-content">Loaded history</div>',
    },
    global: {
      components: { ReadionButton },
    },
  })
}

describe('ReadionAsyncRegion', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders only a structural loading presentation during the initial read', () => {
    const wrapper = mountRegion({
      loading: true,
      empty: true,
      error: 'Could not load study history.',
    })

    const region = wrapper.get('[data-testid="readion-async-region"]')
    expect(region.attributes('data-state')).toBe('loading')
    expect(region.attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[data-testid="readion-async-skeleton"]').attributes('aria-hidden')).toBe(
      'true',
    )
    expect(wrapper.get('[role="status"]').text()).toContain('Loading study history…')
    expect(wrapper.find('[data-testid="async-content"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="readion-async-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="readion-async-error"]').exists()).toBe(false)
  })

  it('renders loaded content without an empty or progress presentation', () => {
    const wrapper = mountRegion()

    const region = wrapper.get('[data-testid="readion-async-region"]')
    expect(region.attributes('data-state')).toBe('content')
    expect(region.attributes('aria-busy')).toBeUndefined()
    expect(wrapper.get('[data-testid="async-content"]').text()).toBe('Loaded history')
    expect(wrapper.find('[data-testid="readion-async-empty"]').exists()).toBe(false)
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it('renders the successful empty state only after loading has settled', () => {
    const wrapper = mountRegion({ empty: true })

    expect(wrapper.get('[data-testid="readion-async-region"]').attributes('data-state')).toBe(
      'empty',
    )
    expect(wrapper.get('[data-testid="readion-async-empty"]').text()).toContain(
      'No study history yet.',
    )
    expect(wrapper.find('[data-testid="async-content"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="readion-async-skeleton"]').exists()).toBe(false)
  })

  it('renders an accessible error and explicit Retry action instead of empty content', () => {
    const wrapper = mountRegion({
      empty: true,
      error: 'Could not load study history.',
    })

    expect(wrapper.get('[data-testid="readion-async-region"]').attributes('data-state')).toBe(
      'error',
    )
    expect(wrapper.get('[data-testid="readion-async-error"]').attributes('role')).toBe('alert')
    expect(wrapper.get('[data-testid="readion-async-error"]').text()).toContain(
      'Could not load study history.',
    )
    expect(wrapper.get('[data-testid="readion-async-retry"]').text()).toContain('Retry')
    expect(wrapper.find('[data-testid="readion-async-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="async-content"]').exists()).toBe(false)
  })

  it('preserves loaded content and announces non-blocking background refresh progress', () => {
    const wrapper = mountRegion({ refreshing: true })

    const region = wrapper.get('[data-testid="readion-async-region"]')
    expect(region.attributes('data-state')).toBe('refreshing')
    expect(region.attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[data-testid="async-content"]').text()).toBe('Loaded history')
    expect(wrapper.get('[data-testid="readion-async-refresh"]').attributes('role')).toBe('status')
    expect(wrapper.get('[data-testid="readion-async-refresh"]').text()).toContain(
      'Refreshing study history…',
    )
    expect(wrapper.find('[data-testid="readion-async-skeleton"]').exists()).toBe(false)
  })

  it('emits one retry per settled activation and rejects duplicate input while retrying', async () => {
    const wrapper = mountRegion({
      error: 'Could not load study history.',
    })
    const retry = wrapper.get('[data-testid="readion-async-retry"]')

    await retry.trigger('click')
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    expect(wrapper.get('[data-testid="readion-async-region"]').attributes('aria-busy')).toBe('true')

    await wrapper.setProps({ retrying: true })
    expect(retry.attributes('aria-busy')).toBe('true')
    expect(retry.text()).toContain('Retrying…')
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)

    await wrapper.setProps({ retrying: false })
    expect(
      wrapper.get('[data-testid="readion-async-region"]').attributes('aria-busy'),
    ).toBeUndefined()
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(2)
  })

  it('settles its retry latch after success when the consumer omits retrying', async () => {
    const wrapper = mountRegion({ error: 'Could not load study history.' })

    await wrapper.get('[data-testid="readion-async-retry"]').trigger('click')
    expect(wrapper.get('[data-testid="readion-async-region"]').attributes('aria-busy')).toBe('true')

    await wrapper.setProps({ error: undefined })

    expect(
      wrapper.get('[data-testid="readion-async-region"]').attributes('aria-busy'),
    ).toBeUndefined()
    expect(wrapper.get('[data-testid="async-content"]').text()).toBe('Loaded history')
  })

  it('settles its retry latch after a repeated failure when the consumer omits retrying', async () => {
    vi.useFakeTimers()
    const wrapper = mountRegion({ error: 'Could not load study history.' })
    const retry = wrapper.get('[data-testid="readion-async-retry"]')

    await retry.trigger('click')
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)

    await vi.runOnlyPendingTimersAsync()

    expect(retry.attributes('aria-busy')).toBeUndefined()
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(2)
  })

  it('never replays a failed read or mutation without explicit activation', async () => {
    const wrapper = mountRegion({ error: 'Could not load study history.' })

    expect(wrapper.emitted('retry')).toBeUndefined()
    await wrapper.setProps({ error: 'Still could not load study history.' })
    expect(wrapper.emitted('retry')).toBeUndefined()

    const mutation = mount(ReadionButton, {
      props: { busy: true, busyLabel: 'Saving…' },
      slots: { default: 'Save' },
    })
    await mutation.get('button').trigger('click')
    await mutation.get('button').trigger('click')
    expect(mutation.emitted('click')).toBeUndefined()
  })
})
