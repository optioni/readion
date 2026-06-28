import type { SessionItemResponse } from '@readion/shared'
import { computed, type Ref } from 'vue'

export function useSessionProgress(items: Ref<SessionItemResponse[]>) {
  const totalCount = computed(() => items.value.length)
  const completedCount = computed(() => items.value.filter((item) => item.completed).length)
  const percent = computed(() =>
    totalCount.value === 0 ? 0 : (completedCount.value / totalCount.value) * 100,
  )

  return { completedCount, totalCount, percent }
}
