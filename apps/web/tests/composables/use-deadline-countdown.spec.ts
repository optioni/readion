import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { formatCountdown, useDeadlineCountdown } from '~/composables/useDeadlineCountdown'
import { renderComposable } from '../support/vue-query-harness'

describe('formatCountdown', () => {
  it('formats seconds as zero-padded HH:MM:SS', () => {
    expect(formatCountdown(0)).toBe('00:00:00')
    expect(formatCountdown(6443)).toBe('01:47:23')
    expect(formatCountdown(3600)).toBe('01:00:00')
    expect(formatCountdown(59)).toBe('00:00:59')
  })

  it('allows hours beyond a day and clamps negatives to zero', () => {
    expect(formatCountdown(25 * 3600)).toBe('25:00:00')
    expect(formatCountdown(-5)).toBe('00:00:00')
  })
})

describe('useDeadlineCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('seeds from remainingSeconds and ticks down once per second', async () => {
    const deadline = ref<string | null>(null)
    const remainingSeconds = ref<number | null>(6443)
    const { result, wrapper } = renderComposable(() =>
      useDeadlineCountdown(deadline, remainingSeconds),
    )

    expect(result.remaining.value).toBe('01:47:23')
    expect(result.paused.value).toBe(false)

    await vi.advanceTimersByTimeAsync(1000)
    expect(result.remaining.value).toBe('01:47:22')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(result.remaining.value).toBe('01:46:22')

    wrapper.unmount()
  })

  it('anchors to the wall-clock deadline when present', async () => {
    const deadline = ref<string | null>('2026-06-29T01:47:23.000Z')
    const remainingSeconds = ref<number | null>(null)
    const { result, wrapper } = renderComposable(() =>
      useDeadlineCountdown(deadline, remainingSeconds),
    )

    expect(result.remaining.value).toBe('01:47:23')

    await vi.advanceTimersByTimeAsync(1000)
    expect(result.remaining.value).toBe('01:47:22')

    wrapper.unmount()
  })

  it('clamps at 00:00:00 and fires the zero-reached signal exactly once', async () => {
    const onZero = vi.fn()
    const deadline = ref<string | null>(null)
    const remainingSeconds = ref<number | null>(2)
    const { result, wrapper } = renderComposable(() =>
      useDeadlineCountdown(deadline, remainingSeconds, onZero),
    )

    expect(result.remaining.value).toBe('00:00:02')
    expect(result.reachedZero.value).toBe(false)

    await vi.advanceTimersByTimeAsync(2000)
    expect(result.remaining.value).toBe('00:00:00')
    expect(result.reachedZero.value).toBe(true)
    expect(onZero).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    expect(result.remaining.value).toBe('00:00:00')
    expect(onZero).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('shows the paused placeholder when there is no deadline or remaining', () => {
    const onZero = vi.fn()
    const deadline = ref<string | null>(null)
    const remainingSeconds = ref<number | null>(null)
    const { result, wrapper } = renderComposable(() =>
      useDeadlineCountdown(deadline, remainingSeconds, onZero),
    )

    expect(result.paused.value).toBe(true)
    expect(result.remaining.value).toBe('--:--:--')
    expect(result.reachedZero.value).toBe(false)
    expect(onZero).not.toHaveBeenCalled()

    wrapper.unmount()
  })
})
