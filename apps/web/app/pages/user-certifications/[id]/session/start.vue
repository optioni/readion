<script setup lang="ts">
import { computed, ref } from 'vue'
import SessionStartCustomConfig from '~/components/SessionStartCustomConfig.vue'
import SessionStartQuickStart from '~/components/SessionStartQuickStart.vue'

definePageMeta({ layout: 'minimal' })

const route = useRoute()
const enrollmentId = computed(() => String(route.params.id))

const mode = ref<'quick' | 'custom'>('quick')
</script>

<template>
  <section
    data-testid="session-start-page"
    class="flex flex-1 items-center justify-center px-8 py-8"
  >
    <SessionStartQuickStart
      v-if="mode === 'quick'"
      :enrollment-id="enrollmentId"
      @customise="mode = 'custom'"
    />
    <SessionStartCustomConfig
      v-else
      :enrollment-id="enrollmentId"
      @use-defaults="mode = 'quick'"
    />
  </section>
</template>
