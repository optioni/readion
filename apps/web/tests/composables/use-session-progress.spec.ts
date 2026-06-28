import type { SessionItemResponse } from '@readion/shared'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useSessionProgress } from '~/composables/useSessionProgress'

function item(index: number, completed: boolean): SessionItemResponse {
  return {
    index,
    type: 'reading',
    content: `r-${index}`,
    completed,
    sourceChunkIds: [],
    supportingSpans: [],
  }
}

describe('useSessionProgress', () => {
  it('counts completed items against the total and derives a percentage', () => {
    const items = ref<SessionItemResponse[]>([
      item(0, true),
      item(1, true),
      item(2, false),
      item(3, false),
    ])
    const { completedCount, totalCount, percent } = useSessionProgress(items)
    expect(completedCount.value).toBe(2)
    expect(totalCount.value).toBe(4)
    expect(percent.value).toBe(50)
  })

  it('reacts to completion changes', () => {
    const items = ref<SessionItemResponse[]>([item(0, false), item(1, false)])
    const { completedCount, percent } = useSessionProgress(items)
    expect(completedCount.value).toBe(0)
    expect(percent.value).toBe(0)

    items.value[0].completed = true
    expect(completedCount.value).toBe(1)
    expect(percent.value).toBe(50)
  })

  it('handles an empty session without dividing by zero', () => {
    const items = ref<SessionItemResponse[]>([])
    const { completedCount, totalCount, percent } = useSessionProgress(items)
    expect(completedCount.value).toBe(0)
    expect(totalCount.value).toBe(0)
    expect(percent.value).toBe(0)
  })
})
