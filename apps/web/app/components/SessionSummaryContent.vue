<script setup lang="ts">
import type { SessionSummaryResponse } from '@readion/shared'
import { computed } from 'vue'
import SessionSummaryBody from '~/components/SessionSummaryBody.vue'
import { useActivityStats } from '~/composables/useActivityStats'
import { useCertDetail } from '~/composables/useCertDetail'
import { useProgressData } from '~/composables/useProgressData'

const props = defineProps<{
  userCertificationId: string
  summary: SessionSummaryResponse
  timeLabel: string | null
  completedAt: string | null
  drillNoMisses: boolean
}>()

const emit = defineEmits<{
  drill: []
  'ask-agent': [responseId: string]
  back: []
}>()

// The enrollment id is only known once the session detail has loaded, so this component
// is only ever created (and useCertDetail/useProgressData only ever called) once it is a
// concrete, stable value — mirroring how SessionHeader.vue is gated by its parent.
const { code: certCode, name: certName } = useCertDetail(props.userCertificationId)
const { sessions, summariesMap } = useProgressData(props.userCertificationId)

const streakDays = computed<number | null>(() => {
  if (sessions.value.length === 0) {
    return null
  }
  return useActivityStats(sessions.value, summariesMap.value).currentStreakDays
})
</script>

<template>
  <SessionSummaryBody
    :summary="summary"
    :time-label="timeLabel"
    :drill-no-misses="drillNoMisses"
    :cert-code="certCode"
    :cert-name="certName"
    :completed-at="completedAt"
    :streak-days="streakDays"
    @drill="emit('drill')"
    @ask-agent="(responseId) => emit('ask-agent', responseId)"
    @back="emit('back')"
  />
</template>
