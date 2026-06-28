import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { formatElapsed, useElapsedTimer } from '~/composables/useElapsedTimer'
import { renderComposable } from '../support/vue-query-harness'

describe('formatElapsed', () => {
  it('formats milliseconds as zero-padded mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00')
    expect(formatElapsed(65_000)).toBe('01:05')
    expect(formatElapsed(125_000)).toBe('02:05')
  })

  it('allows minutes beyond an hour and never goes negative', () => {
    expect(formatElapsed(75 * 60_000)).toBe('75:00')
    expect(formatElapsed(-5_000)).toBe('00:00')
  })
})

describe('useElapsedTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T00:02:05.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports the elapsed time since startedAt and ticks forward', async () => {
    const startedAt = ref<string | null>('2026-06-29T00:00:00.000Z')
    const { result, wrapper } = renderComposable(() => useElapsedTimer(startedAt))

    expect(result.elapsed.value).toBe('02:05')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(result.elapsed.value).toBe('03:05')

    wrapper.unmount()
  })

  it('reports zero when startedAt is null or unparseable', () => {
    const startedAt = ref<string | null>(null)
    const { result, wrapper } = renderComposable(() => useElapsedTimer(startedAt))
    expect(result.elapsed.value).toBe('00:00')

    startedAt.value = 'not-a-date'
    expect(result.elapsed.value).toBe('00:00')

    wrapper.unmount()
  })
})
