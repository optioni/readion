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
import { sessionRunPath } from '~/composables/runnerRoutes'
import { createSession } from '~/composables/sessionViewApi'
import { statusColorForScore } from '~/composables/statusColor'
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

async function start() {
  if (isStarting.value) {
    return
  }
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
  } finally {
    isStarting.value = false
  }
}

const statusColorClass: Record<string, string> = {
  poor: 'text-readion-status-poor',
  warning: 'text-readion-status-warning',
  medium: 'text-readion-status-warning',
  good: 'text-readion-status-good',
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

        <button
          v-for="domain in domains"
          :key="domain.name"
          type="button"
          :data-testid="`domain-toggle-${domain.name}`"
          :aria-pressed="selected.has(domain.name)"
          class="flex w-full items-center gap-2.5 border-readion-border-default border-b py-2 text-left last:border-b-0"
          @click="toggleDomain(domain.name)"
        >
          <span
            class="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border"
            :class="
              selected.has(domain.name)
                ? 'border-readion-primary bg-readion-primary'
                : 'border-readion-border-strong'
            "
          >
            <svg
              v-if="selected.has(domain.name)"
              width="9"
              height="9"
              viewBox="0 0 9 9"
              fill="none"
            >
              <path
                d="M2 4.5l2 2 3-3"
                stroke="#fff"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
          <span
            class="flex-1 text-xs"
            :class="selected.has(domain.name) ? 'text-slate-100' : 'text-slate-300'"
          >
            {{ domain.name }}
          </span>
          <span
            v-if="scoreByDomain.has(domain.name)"
            class="font-medium text-[11px]"
            :class="statusColorClass[statusColorForScore(scoreByDomain.get(domain.name) ?? 0)]"
          >
            {{ scoreByDomain.get(domain.name) }}%
          </span>
        </button>
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
          <div class="flex flex-col gap-2">
            <span class="text-[11px] text-readion-text-muted uppercase tracking-wide">Duration</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="option in sessionDurationMinutes"
                :key="option"
                type="button"
                :data-testid="`duration-option-${option}`"
                :aria-pressed="duration === option"
                class="rounded-full border px-2.5 py-1 text-xs"
                :class="
                  duration === option
                    ? 'border-readion-primary bg-readion-primary text-white'
                    : 'border-readion-border-strong text-slate-300'
                "
                @click="duration = option"
              >
                {{ option }}m
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-[11px] text-readion-text-muted uppercase tracking-wide">
              Content mix
            </span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="option in sessionContentMixes"
                :key="option"
                type="button"
                :data-testid="`content-mix-${option}`"
                :aria-pressed="contentMix === option"
                class="rounded-full border px-2.5 py-1 text-xs"
                :class="
                  contentMix === option
                    ? 'border-readion-primary bg-readion-primary text-white'
                    : 'border-readion-border-strong text-slate-300'
                "
                @click="contentMix = option"
              >
                {{ option }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-[11px] text-readion-text-muted uppercase tracking-wide">
              Difficulty
            </span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="option in sessionDifficulties"
                :key="option"
                type="button"
                :data-testid="`difficulty-${option}`"
                :aria-pressed="difficulty === option"
                class="rounded-full border px-2.5 py-1 text-xs"
                :class="
                  difficulty === option
                    ? 'border-readion-primary bg-readion-primary text-white'
                    : 'border-readion-border-strong text-slate-300'
                "
                @click="difficulty = option"
              >
                {{ option }}
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span class="text-[11px] text-readion-text-muted uppercase tracking-wide">
              Learning style
            </span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="option in sessionLearningStyles"
                :key="option"
                type="button"
                :data-testid="`learning-style-${option}`"
                :aria-pressed="learningStyle === option"
                class="rounded-full border px-2.5 py-1 text-xs"
                :class="
                  learningStyle === option
                    ? 'border-readion-primary bg-readion-primary text-white'
                    : 'border-readion-border-strong text-slate-300'
                "
                @click="learningStyle = option"
              >
                {{ option }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <button
          type="button"
          data-testid="custom-start-button"
          :disabled="isStarting"
          class="mb-2.5 w-full rounded-md bg-readion-primary py-2.5 font-semibold text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:opacity-60"
          @click="start"
        >
          Start session &#8594;
        </button>
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
