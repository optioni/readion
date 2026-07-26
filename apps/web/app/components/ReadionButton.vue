<script setup lang="ts">
import { computed } from 'vue'

type ReadionButtonVariant = 'primary' | 'secondary' | 'destructive' | 'toggle' | 'icon'
type ReadionButtonType = 'button' | 'submit' | 'reset'
type ReadionStatusTone = 'polite' | 'assertive'

const props = withDefaults(
  defineProps<{
    variant?: ReadionButtonVariant
    type?: ReadionButtonType
    disabled?: boolean
    busy?: boolean
    busyLabel?: string
    ariaLabel?: string
    selected?: boolean
    statusMessage?: string
    statusTone?: ReadionStatusTone
  }>(),
  {
    variant: 'primary',
    type: 'button',
    disabled: false,
    busy: false,
    busyLabel: 'Working…',
    ariaLabel: undefined,
    selected: undefined,
    statusMessage: undefined,
    statusTone: 'polite',
  },
)

const _baseClasses =
  'readion-interactive-control relative inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 font-medium text-sm transition-[color,background-color,border-color,opacity,transform] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-readion-focus focus-visible:ring-offset-2 focus-visible:ring-offset-readion-background-base active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none disabled:cursor-not-allowed'

const _variantClasses = computed(() => {
  switch (props.variant) {
    case 'secondary':
      return 'border border-readion-border-strong bg-readion-surface text-readion-text-primary hover:border-readion-accent-label hover:bg-readion-background-overlay active:bg-readion-background-elevated disabled:border-readion-border-default disabled:bg-readion-background-surface disabled:text-readion-text-secondary'
    case 'destructive':
      return 'bg-readion-danger text-readion-text-on-primary hover:bg-readion-danger-hover active:bg-readion-danger-active disabled:bg-readion-border-strong disabled:text-readion-text-primary'
    case 'toggle':
      return props.selected
        ? 'border border-readion-primary bg-readion-primary text-readion-text-on-primary hover:bg-readion-primary-hover active:bg-readion-primary-active disabled:border-readion-border-strong disabled:bg-readion-border-strong disabled:text-readion-text-primary'
        : 'border border-readion-border-strong bg-readion-background-base text-readion-text-secondary hover:border-readion-accent-label hover:bg-readion-surface hover:text-readion-text-primary active:bg-readion-background-overlay disabled:border-readion-border-default disabled:text-readion-text-secondary'
    case 'icon':
      return 'size-10 border border-transparent bg-transparent p-0 text-readion-text-secondary hover:bg-readion-surface hover:text-readion-text-primary active:bg-readion-background-overlay disabled:text-readion-text-secondary'
    default:
      return 'bg-readion-primary text-readion-text-on-primary hover:bg-readion-primary-hover active:bg-readion-primary-active disabled:bg-readion-border-strong disabled:text-readion-text-primary'
  }
})

const _isDisabled = computed(() => props.disabled || props.busy)
const _pressedState = computed(() =>
  props.variant === 'toggle' && props.selected !== undefined ? props.selected : undefined,
)
</script>

<template>
  <button
    :type="type"
    :disabled="_isDisabled"
    :aria-label="ariaLabel"
    :aria-busy="busy ? 'true' : undefined"
    :aria-pressed="_pressedState"
    :data-variant="variant"
    :data-state="busy ? 'busy' : disabled ? 'disabled' : selected ? 'selected' : 'rest'"
    :class="[_baseClasses, _variantClasses]"
  >
    <span
      data-testid="readion-button-label-slot"
      class="grid min-w-0 place-items-center"
    >
      <span
        data-testid="readion-button-rest-label"
        class="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
        :class="{ invisible: busy }"
        :aria-hidden="busy ? 'true' : undefined"
      >
        <slot />
      </span>
      <span
        v-if="busy"
        data-testid="readion-button-busy-label"
        class="col-start-1 row-start-1 inline-flex items-center justify-center gap-2"
      >
        <svg
          data-testid="readion-button-spinner"
          class="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
          aria-hidden="true"
        />
        {{ busyLabel }}
      </span>
    </span>
    <span
      v-if="statusMessage"
      class="sr-only"
      :role="statusTone === 'assertive' ? 'alert' : 'status'"
    >
      {{ statusMessage }}
    </span>
  </button>
</template>
