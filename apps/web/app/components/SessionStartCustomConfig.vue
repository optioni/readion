<script setup lang="ts">
import type {
  CreateSessionRequest,
  SessionContentMix,
  SessionDifficulty,
  SessionDurationMinutes,
  SessionLearningStyle,
} from '@readion/shared'
import {
  sessionContentMixes,
  sessionDifficulties,
  sessionDurationMinutes,
  sessionLearningStyles,
} from '@readion/shared'
import { computed, reactive, ref } from 'vue'
import ReadionButton from '~/components/ReadionButton.vue'
import SessionDomainToggle from '~/components/SessionDomainToggle.vue'
import SessionOverrideControl from '~/components/SessionOverrideControl.vue'
import { sessionRunPath } from '~/composables/runnerRoutes'
import { createSession } from '~/composables/sessionViewApi'
import { useCertDetail } from '~/composables/useCertDetail'
import { useCertWeakAreas } from '~/composables/useCertWeakAreas'

const props = defineProps<{ enrollmentId: string }>()
defineEmits<{ 'use-defaults': [] }>()

const { domains } = useCertDetail(props.enrollmentId)
const { weakAreas } = useCertWeakAreas(props.enrollmentId)

const scoreByDomain = computed(
  () => new Map(weakAreas.value.map((area) => [area.domain, area.score])),
)

const selected = reactive(new Set<string>())

function toggleDomain(name: string) {
  if (selected.has(name)) {
    selected.delete(name)
  } else {
    selected.add(name)
  }
}

function selectAll() {
  for (const domain of domains.value) {
    selected.add(domain.name)
  }
}

function clear() {
  selected.clear()
}

const selectedCount = computed(() => `${selected.size} of ${domains.value.length} selected`)

const duration = ref<SessionDurationMinutes>()
const contentMix = ref<SessionContentMix>()
const difficulty = ref<SessionDifficulty>()
const learningStyle = ref<SessionLearningStyle>()

const isStarting = ref(false)
const startError = ref<string | null>(null)

async function start() {
  if (isStarting.value) {
    return
  }
  startError.value = null
  isStarting.value = true
  try {
    const overrides: CreateSessionRequest = {}
    if (duration.value !== undefined) {
      overrides.durationMinutes = duration.value
    }
    if (contentMix.value !== undefined) {
      overrides.contentMix = contentMix.value
    }
    if (difficulty.value !== undefined) {
      overrides.difficulty = difficulty.value
    }
    if (learningStyle.value !== undefined) {
      overrides.learningStyle = learningStyle.value
    }
    overrides.focusArea =
      selected.size > 0 ? { mode: 'domains', domains: [...selected] } : { mode: 'auto' }

    const session = await createSession(props.enrollmentId, overrides)
    await navigateTo(sessionRunPath(session.data.id))
  } catch {
    startError.value = 'Couldn’t start the session. Your selections have been kept.'
    isStarting.value = false
  }
}
</script>

<template>
  <div data-testid="custom-config-panel" class="mx-auto flex w-full max-w-[700px] gap-5">
    <div class="flex-1">
      <p class="mb-2.5 text-[11px] text-readion-text-muted uppercase tracking-wider">
        Domain focus
      </p>
      <div
        class="rounded-xl border border-readion-border-strong bg-readion-background-surface px-4 py-2"
      >
        <div class="mb-1 flex items-center justify-between py-1.5">
          <span data-testid="domain-selected-count" class="font-medium text-slate-200 text-xs">
            {{ selectedCount }}
          </span>
          <div class="flex gap-2.5">
            <button
              type="button"
              data-testid="domain-select-all"
              class="text-readion-accent-label text-xs hover:underline"
              @click="selectAll"
            >
              Select all
            </button>
            <button
              type="button"
              data-testid="domain-clear"
              class="text-readion-text-muted text-xs hover:underline"
              @click="clear"
            >
              Clear
            </button>
          </div>
        </div>

        <SessionDomainToggle
          v-for="domain in domains"
          :key="domain.name"
          :name="domain.name"
          :score="scoreByDomain.get(domain.name)"
          :selected="selected.has(domain.name)"
          @toggle="toggleDomain(domain.name)"
        />
        <div class="py-2" />
      </div>
    </div>

    <div class="flex w-[240px] flex-shrink-0 flex-col gap-4">
      <div>
        <p class="mb-2.5 text-[11px] text-readion-text-muted uppercase tracking-wider">
          Session settings
        </p>
        <div
          class="flex flex-col gap-4 rounded-xl border border-readion-border-strong bg-readion-background-surface p-4"
        >
          <SessionOverrideControl
            label="Duration"
            testid-prefix="duration-option"
            :options="sessionDurationMinutes"
            :model-value="duration"
            :format="(value) => `${value}m`"
            @update:model-value="duration = $event"
          />
          <SessionOverrideControl
            label="Content mix"
            testid-prefix="content-mix"
            :options="sessionContentMixes"
            :model-value="contentMix"
            @update:model-value="contentMix = $event"
          />
          <SessionOverrideControl
            label="Difficulty"
            testid-prefix="difficulty"
            :options="sessionDifficulties"
            :model-value="difficulty"
            @update:model-value="difficulty = $event"
          />
          <SessionOverrideControl
            label="Learning style"
            testid-prefix="learning-style"
            :options="sessionLearningStyles"
            :model-value="learningStyle"
            @update:model-value="learningStyle = $event"
          />
        </div>
      </div>

      <div>
        <ReadionButton
          data-testid="custom-start-button"
          class="mb-2.5 w-full py-2.5"
          :busy="isStarting"
          busy-label="Starting…"
          @click="start"
        >
          Start session &#8594;
        </ReadionButton>
        <p
          v-if="startError"
          data-testid="custom-start-error"
          class="mb-2.5 text-readion-status-poor text-xs"
          role="alert"
        >
          {{ startError }}
        </p>
        <div class="text-center">
          <button
            type="button"
            data-testid="use-defaults-link"
            class="text-readion-text-muted text-xs hover:underline"
            @click="$emit('use-defaults')"
          >
            Use defaults instead
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
