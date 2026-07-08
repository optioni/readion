import { computed, onUnmounted, type Ref, ref, watch } from 'vue'

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function elapsedMs(startedAt: string | null, endedAt: string | null): number | null {
  if (!startedAt || !endedAt) {
    return null
  }
  const start = new Date(startedAt).getTime()
  const end = new Date(endedAt).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null
  }
  const delta = end - start
  return delta < 0 ? null : delta
}

export function useElapsedTimer(startedAt: Ref<string | null>, endedAt: Ref<string | null>) {
  const now = ref(Date.now())
  let interval: ReturnType<typeof setInterval> | null = null

  function clearTick() {
    if (interval !== null) {
      clearInterval(interval)
      interval = null
    }
  }

  function startTick() {
    if (interval !== null) {
      return
    }
    interval = setInterval(() => {
      now.value = Date.now()
    }, 1000)
  }

  watch(
    endedAt,
    (value) => {
      if (value === null) {
        startTick()
      } else {
        clearTick()
      }
    },
    { immediate: true },
  )

  onUnmounted(clearTick)

  const elapsed = computed(() => {
    const frozen = elapsedMs(startedAt.value, endedAt.value)
    if (frozen !== null) {
      return formatElapsed(frozen)
    }
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
