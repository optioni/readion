<script setup lang="ts">
import { computed, watch } from 'vue'
import AdminAsyncMessage from '~/components/admin/AdminAsyncMessage.vue'
import { useCertReverifyFlow } from '~/composables/useCertReverifyFlow'
import { useDueForReverification } from '~/composables/useDueForReverification'

const props = defineProps<{ code: string }>()

const dueQuery = useDueForReverification()
const dueItem = computed(
  () => dueQuery.data.value?.find((item) => item.code === props.code) ?? null,
)

const { diff, reverifyError, submitting, start, submit } = useCertReverifyFlow()

watch(
  dueItem,
  (item) => {
    if (item) start(item)
  },
  { immediate: true },
)
</script>

<template>
  <section
    data-testid="admin-cert-reverify-page"
    class="flex h-full min-h-[calc(100vh-4rem)] flex-col"
  >
    <div
      v-if="dueItem"
      class="flex items-center justify-between border-readion-border-strong border-b bg-readion-background-elevated px-7 py-4"
    >
      <div>
        <nav data-testid="reverify-breadcrumb" class="flex items-center gap-1.5 text-slate-400 text-xs">
          <span>Certifications</span>
          <span class="text-slate-600">›</span>
          <span>{{ dueItem.code }}</span>
          <span class="text-slate-600">›</span>
          <span class="text-readion-status-warning">Re-verification required</span>
        </nav>
        <h1 class="mt-1 font-semibold text-base text-white">{{ dueItem.name }}</h1>
      </div>
      <span
        data-testid="reverify-stale-pill"
        class="rounded-full border border-readion-status-warning/25 bg-readion-status-warning/10 px-3 py-1 font-medium text-readion-status-warning text-xs"
      >
        Metadata stale · action required
      </span>
    </div>

    <div class="flex-1 overflow-y-auto px-9 py-6">
      <div v-if="!dueItem" data-testid="reverify-not-found" class="text-slate-400 text-sm">
        No certification is due for re-verification with this code.
      </div>

      <template v-else>
        <AdminAsyncMessage v-if="!diff && !reverifyError" kind="loading" message="Re-verifying against the latest source…" />
        <p v-if="reverifyError && !diff" data-testid="reverify-error" class="text-red-400 text-sm">
          {{ reverifyError }}
        </p>

        <template v-if="diff">
          <div class="mb-2.5 font-medium text-slate-400 text-xs uppercase tracking-widest">
            Field changes detected
          </div>
          <div class="overflow-hidden rounded-xl border border-readion-border-strong bg-readion-background-surface">
            <div class="flex bg-readion-background-elevated border-readion-border-strong border-b">
              <div class="w-40 shrink-0 px-3 py-2 font-medium text-[10px] text-slate-500 uppercase tracking-wide">
                Field
              </div>
              <div
                data-testid="reverify-col-current"
                class="flex-1 px-3 py-2 font-medium text-[10px] text-readion-status-poor uppercase tracking-wide"
              >
                Current (outdated)
              </div>
              <div
                data-testid="reverify-col-proposed"
                class="flex-1 px-3 py-2 font-medium text-[10px] text-readion-status-good uppercase tracking-wide"
              >
                Proposed (new guide)
              </div>
            </div>
            <div
              v-for="row in diff.rows"
              :key="row.key"
              :data-testid="`reverify-diff-row-${row.key}`"
              :data-changed="row.changed ? 'true' : 'false'"
              class="flex border-readion-background-surface/60 border-b"
            >
              <div class="w-40 shrink-0 bg-readion-background-elevated px-3 py-2.5 text-[11px] text-slate-500 uppercase tracking-wide">
                {{ row.label }}
              </div>
              <div
                data-testid="reverify-current-value"
                class="flex-1 px-3 py-2.5 text-sm"
                :class="row.changed ? 'text-readion-status-poor line-through' : 'text-slate-400'"
              >
                {{ row.current }}
              </div>
              <div
                data-testid="reverify-proposed-value"
                class="flex-1 px-3 py-2.5 text-sm"
                :class="row.changed ? 'font-semibold text-readion-status-good' : 'text-slate-400'"
              >
                {{ row.proposed }}
              </div>
            </div>
          </div>

          <p v-if="reverifyError" data-testid="reverify-error" class="mt-3 text-red-400 text-sm">
            {{ reverifyError }}
          </p>

          <div class="mt-6 flex justify-end">
            <button
              type="button"
              data-testid="reverify-submit-btn"
              :disabled="submitting"
              class="inline-flex items-center gap-2 rounded-lg bg-readion-primary px-5 py-2 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:opacity-50"
              @click="submit"
            >
              {{ submitting ? 'Re-verifying…' : 'Accept all & re-verify' }}
            </button>
          </div>
        </template>
      </template>
    </div>
  </section>
</template>
