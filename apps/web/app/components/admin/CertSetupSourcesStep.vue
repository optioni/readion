<script setup lang="ts">
import type { ContentSourceType, SuggestedContentSource } from '@readion/shared'
import { contentSourceTypes, registerSourceRequestSchema } from '@readion/shared'
import { useQueryClient } from '@tanstack/vue-query'
import { ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import type { CertSetupWizardState } from '~/composables/useCertSetupWizard'
import { contentControllerRegister } from '~~/src/api/content/content'

const props = defineProps<{ state: CertSetupWizardState; certId: string }>()

const jsonHeaders = { 'Content-Type': 'application/json' }
const SOURCE_TYPES: readonly ContentSourceType[] = contentSourceTypes

const queryClient = useQueryClient()

const suggestions = ref<SuggestedContentSource[]>([...props.state.suggestedContentSources])
const manualUrl = ref('')
const manualType = ref<ContentSourceType>('web')
const errorMessage = ref<string | null>(null)

function urlIsValid(url: string): boolean {
  return registerSourceRequestSchema.shape.url.safeParse(url).success
}

async function register(type: ContentSourceType, url: string): Promise<void> {
  await contentControllerRegister({
    headers: jsonHeaders,
    body: JSON.stringify({ certificationId: props.certId, type, url }),
  })
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.coverage(props.certId) })
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.contentSources(props.certId) })
}

async function approve(source: SuggestedContentSource): Promise<void> {
  errorMessage.value = null
  try {
    await register(source.type, source.url)
    discard(source)
  } catch (error) {
    errorMessage.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not register the source.'
  }
}

function discard(source: SuggestedContentSource): void {
  suggestions.value = suggestions.value.filter((candidate) => candidate.url !== source.url)
}

async function addManual(): Promise<void> {
  errorMessage.value = null
  if (!urlIsValid(manualUrl.value.trim())) {
    errorMessage.value = 'Enter a valid URL.'
    return
  }
  try {
    await register(manualType.value, manualUrl.value.trim())
    manualUrl.value = ''
  } catch (error) {
    errorMessage.value =
      error instanceof ReadionProblemDetailsError
        ? (error.detail ?? error.title)
        : 'Could not register the source.'
  }
}
</script>

<template>
  <div data-testid="cert-sources-step" class="flex flex-col gap-4">
    <header class="flex flex-col gap-1">
      <h2 class="font-semibold text-base text-white">Content sources</h2>
      <p class="text-slate-400 text-xs">Approve suggested sources or register one by URL.</p>
    </header>

    <ul v-if="suggestions.length" class="flex flex-col gap-2">
      <li
        v-for="source in suggestions"
        :key="source.url"
        data-testid="suggested-source"
        :data-url="source.url"
        class="flex items-center justify-between gap-3 rounded-lg border border-readion-background-surface px-4 py-3"
      >
        <div class="flex min-w-0 flex-col">
          <span class="break-all text-slate-100 text-sm">{{ source.url }}</span>
          <span class="font-mono text-slate-400 text-xs uppercase">{{ source.type }}</span>
        </div>
        <div class="flex shrink-0 gap-2">
          <button
            type="button"
            data-testid="approve-source-btn"
            class="rounded-lg bg-readion-primary px-3 py-1.5 font-medium text-white text-xs hover:bg-readion-primary/90"
            @click="approve(source)"
          >
            Approve
          </button>
          <button
            type="button"
            data-testid="reject-source-btn"
            class="rounded-lg border border-readion-background-surface px-3 py-1.5 text-slate-300 text-xs hover:bg-readion-background-surface"
            @click="discard(source)"
          >
            Reject
          </button>
        </div>
      </li>
    </ul>

    <form
      data-testid="cert-source-add-btn"
      class="flex flex-col gap-2 sm:flex-row sm:items-center"
      @submit.prevent="addManual"
    >
      <input
        v-model="manualUrl"
        data-testid="cert-source-url-input"
        placeholder="https://…"
        class="flex-1 rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
      />
      <select
        v-model="manualType"
        data-testid="cert-source-type-select"
        class="rounded-lg border border-readion-background-surface bg-readion-background-elevated px-3 py-2 text-slate-100 text-sm"
      >
        <option v-for="type in SOURCE_TYPES" :key="type" :value="type">{{ type }}</option>
      </select>
      <button
        type="submit"
        class="rounded-lg bg-readion-primary px-4 py-2 font-medium text-sm text-white hover:bg-readion-primary/90"
      >
        Add source
      </button>
    </form>

    <p v-if="errorMessage" data-testid="cert-source-error" class="text-red-400 text-sm">
      {{ errorMessage }}
    </p>
  </div>
</template>
