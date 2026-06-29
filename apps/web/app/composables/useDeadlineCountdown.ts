import { computed, onUnmounted, type Ref, ref, watch } from 'vue'

const PAUSED_PLACEHOLDER = '--:--:--'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatCountdown(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`
}

export function useDeadlineCountdown(
  deadline: Ref<string | null>,
  remainingSeconds: Ref<number | null>,
  onZero?: () => void,
) {
  const seededAt = Date.now()
  const now = ref(seededAt)
  const interval = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  onUnmounted(() => clearInterval(interval))

  // Anchor to the wall-clock deadline so time elapsed while the tab is away is honoured; fall
  // back to a relative anchor from `remainingSeconds` only when the deadline is absent.
  const endMs = computed<number | null>(() => {
    if (deadline.value) {
      const parsed = new Date(deadline.value).getTime()
      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
    if (remainingSeconds.value !== null) {
      return seededAt + remainingSeconds.value * 1000
    }
    return null
  })

  const paused = computed(() => endMs.value === null)

  const secondsLeft = computed(() => {
    if (endMs.value === null) {
      return null
    }
    return Math.floor((endMs.value - now.value) / 1000)
  })

  const remaining = computed(() => {
    if (secondsLeft.value === null) {
      return PAUSED_PLACEHOLDER
    }
    return formatCountdown(secondsLeft.value)
  })

  const reachedZero = ref(false)
  watch(
    secondsLeft,
    (value) => {
      if (value !== null && value <= 0 && !reachedZero.value) {
        reachedZero.value = true
        onZero?.()
      }
    },
    { immediate: true },
  )

  return { remaining, reachedZero, paused }
}
