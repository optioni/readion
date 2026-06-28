import { computed, onUnmounted, type Ref, ref } from 'vue'

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function useElapsedTimer(startedAt: Ref<string | null>) {
  const now = ref(Date.now())
  const interval = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  onUnmounted(() => clearInterval(interval))

  const elapsed = computed(() => {
    if (!startedAt.value) {
      return formatElapsed(0)
    }
    const start = new Date(startedAt.value).getTime()
    if (Number.isNaN(start)) {
      return formatElapsed(0)
    }
    return formatElapsed(now.value - start)
  })

  return { elapsed }
}
