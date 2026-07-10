<script setup lang="ts">
withDefaults(
  defineProps<{
    ctaLabel: string
    ctaDisabled?: boolean
    ctaTestid?: string
    cancelLabel?: string
    cancelTestid?: string
  }>(),
  {
    ctaDisabled: false,
    ctaTestid: 'wizard-footer-cta',
    cancelLabel: 'Cancel',
    cancelTestid: 'wizard-footer-cancel',
  },
)

const emit = defineEmits<{ cancel: []; submit: [] }>()
</script>

<template>
  <div
    data-testid="wizard-footer"
    class="mt-7 flex justify-end gap-2.5 border-readion-border-strong border-t pt-5"
  >
    <button
      type="button"
      :data-testid="cancelTestid"
      class="rounded-lg border border-readion-background-surface px-4 py-2 font-medium text-slate-100 text-sm transition-colors hover:bg-readion-background-surface"
      @click="emit('cancel')"
    >
      {{ cancelLabel }}
    </button>
    <button
      type="button"
      :data-testid="ctaTestid"
      :disabled="ctaDisabled"
      class="rounded-lg bg-readion-primary px-5 py-2 font-medium text-sm text-white transition-colors hover:bg-readion-primary/90 disabled:opacity-60"
      @click="emit('submit')"
    >
      {{ ctaLabel }}
    </button>
  </div>
</template>
