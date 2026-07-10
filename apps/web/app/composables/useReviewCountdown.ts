import { computed, onUnmounted, ref } from 'vue'

const TOTAL_SECONDS = 300
const URGENT_THRESHOLD_SECONDS = 30

function formatMinSec(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(clamped / 60)
  const secs = clamped % 60
  return `${minutes}:${String(secs).padStart(2, '0')}`
}

// A client-side 5-minute countdown for the five-minute review loop — there is no server-seeded
// deadline for review sessions, so this ticks down locally from the moment the page mounts and
// never goes negative.
export function useReviewCountdown(totalSeconds: number = TOTAL_SECONDS) {
  const remainingSeconds = ref(totalSeconds)

  const interval = setInterval(() => {
    remainingSeconds.value = Math.max(0, remainingSeconds.value - 1)
  }, 1000)
  onUnmounted(() => clearInterval(interval))

  const timeStr = computed(() => formatMinSec(remainingSeconds.value))
  const timeUrgent = computed(() => remainingSeconds.value <= URGENT_THRESHOLD_SECONDS)

  return { remainingSeconds, timeStr, timeUrgent }
}
