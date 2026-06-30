<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  points: number[]
  hasData: boolean
}>()

const WIDTH = 300
const HEIGHT = 80
const PAD_LEFT = 24
const PAD = 8

const GRID_YS = [25, 50, 75, 100] as const

function xScale(i: number, total: number): number {
  return PAD_LEFT + (i / Math.max(total - 1, 1)) * (WIDTH - PAD_LEFT - PAD)
}

function yScale(v: number): number {
  return PAD + (1 - v / 100) * (HEIGHT - PAD * 2)
}

const pointCoords = computed(() =>
  props.points.map((val, i) => ({
    x: xScale(i, props.points.length),
    y: yScale(val),
    isLast: i === props.points.length - 1,
  })),
)

const svgPoints = computed(() =>
  pointCoords.value.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
)

const currentValue = computed(() => props.points.at(-1) ?? null)
</script>

<template>
  <div data-testid="readiness-trend" class="rounded-md bg-black/25 p-3">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">Readiness Trend</div>

    <div v-if="!hasData" data-testid="progress-not-calibrated" class="py-4 text-center">
      <p class="text-slate-400 text-sm">Not yet calibrated</p>
      <p class="mt-1 text-slate-500 text-xs">
        Complete a few sessions to see your readiness trend.
      </p>
    </div>

    <template v-else>
      <div class="mb-2 flex items-end justify-between">
        <span class="font-semibold text-2xl text-slate-100">{{ currentValue }}%</span>
      </div>
      <svg
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        class="w-full"
        aria-hidden="true"
      >
        <g v-for="tickY in GRID_YS" :key="tickY">
          <line
            :x1="PAD_LEFT"
            :y1="yScale(tickY)"
            :x2="WIDTH - PAD"
            :y2="yScale(tickY)"
            stroke="currentColor"
            stroke-width="0.5"
            class="text-slate-800"
          />
          <text
            :x="PAD_LEFT - 4"
            :y="yScale(tickY) + 4"
            text-anchor="end"
            font-size="9"
            class="fill-slate-500"
          >{{ tickY }}</text>
        </g>

        <polyline
          :points="svgPoints"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="text-readion-primary"
        />

        <circle
          v-for="(pt, i) in pointCoords"
          :key="i"
          data-testid="readiness-point"
          :cx="pt.x"
          :cy="pt.y"
          :r="pt.isLast ? 5 : 3"
          :fill="pt.isLast ? 'currentColor' : '#0f172a'"
          stroke="currentColor"
          stroke-width="1.5"
          class="text-readion-primary"
        />
      </svg>
    </template>
  </div>
</template>
