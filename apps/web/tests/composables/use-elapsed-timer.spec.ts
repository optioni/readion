import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { elapsedMs, formatElapsed, useElapsedTimer } from '~/composables/useElapsedTimer'
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

  it('reports the elapsed time since startedAt and ticks forward for an active session', async () => {
    const startedAt = ref<string | null>('2026-06-29T00:00:00.000Z')
    const endedAt = ref<string | null>(null)
    const { result, wrapper } = renderComposable(() => useElapsedTimer(startedAt, endedAt))

    expect(result.elapsed.value).toBe('02:05')

    await vi.advanceTimersByTimeAsync(60_000)
    expect(result.elapsed.value).toBe('03:05')

    wrapper.unmount()
  })

  it('reports zero when startedAt is null or unparseable', () => {
    const startedAt = ref<string | null>(null)
    const endedAt = ref<string | null>(null)
    const { result, wrapper } = renderComposable(() => useElapsedTimer(startedAt, endedAt))
    expect(result.elapsed.value).toBe('00:00')

    startedAt.value = 'not-a-date'
    expect(result.elapsed.value).toBe('00:00')

    wrapper.unmount()
  })

  it('freezes elapsed at endedAt - startedAt for an ended session and never ticks', async () => {
    const startedAt = ref<string | null>('2026-06-29T00:00:00.000Z')
    const endedAt = ref<string | null>('2026-06-29T00:01:30.000Z')
    const { result, wrapper } = renderComposable(() => useElapsedTimer(startedAt, endedAt))

    expect(result.elapsed.value).toBe('01:30')

    await vi.advanceTimersByTimeAsync(5_000)
    expect(result.elapsed.value).toBe('01:30')

    wrapper.unmount()
  })

  it('does not leave a running interval for an ended session', () => {
    const startedAt = ref<string | null>('2026-06-29T00:00:00.000Z')
    const endedAt = ref<string | null>('2026-06-29T00:01:30.000Z')
    const { wrapper } = renderComposable(() => useElapsedTimer(startedAt, endedAt))

    expect(vi.getTimerCount()).toBe(0)

    wrapper.unmount()
  })

  it('never displays the now - startedAt runaway value for a 49h-old ended session (2910:42 repro)', async () => {
    vi.setSystemTime(new Date('2026-07-01T01:00:00.000Z'))
    const startedAt = ref<string | null>('2026-06-29T00:00:00.000Z')
    const endedAt = ref<string | null>('2026-06-29T00:20:34.000Z')
    const { result, wrapper } = renderComposable(() => useElapsedTimer(startedAt, endedAt))

    expect(result.elapsed.value).toBe('20:34')
    expect(result.elapsed.value).not.toBe('2910:00')

    await vi.advanceTimersByTimeAsync(5_000)
    expect(result.elapsed.value).toBe('20:34')

    wrapper.unmount()
  })
})

describe('elapsedMs', () => {
  it('returns the millisecond delta between startedAt and endedAt', () => {
    expect(elapsedMs('2026-06-29T00:00:00.000Z', '2026-06-29T00:20:34.000Z')).toBe(1_234_000)
  })

  it('returns null when startedAt or endedAt is missing', () => {
    expect(elapsedMs(null, '2026-06-29T00:20:34.000Z')).toBeNull()
    expect(elapsedMs('2026-06-29T00:00:00.000Z', null)).toBeNull()
  })

  it('returns null for an invalid date or a negative delta', () => {
    expect(elapsedMs('not-a-date', '2026-06-29T00:20:34.000Z')).toBeNull()
    expect(elapsedMs('2026-06-29T00:20:34.000Z', '2026-06-29T00:00:00.000Z')).toBeNull()
  })
})
