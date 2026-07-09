<script setup lang="ts">
import { computed } from 'vue'

export interface ReadinessTrendPoint {
  score: number
  label: string
}

const props = defineProps<{
  points: ReadinessTrendPoint[]
  hasData: boolean
  showProjection?: boolean
}>()

const WIDTH = 300
const HEIGHT = 80
const PAD_LEFT = 24
const PAD = 8
const PROJECTION_STEPS = 3
const TARGET_SCORE = 80

const GRID_YS = [25, 50, 75, 100] as const
const TARGET_Y = 80

function xScale(i: number, total: number): number {
  return PAD_LEFT + (i / Math.max(total - 1, 1)) * (WIDTH - PAD_LEFT - PAD)
}

function yScale(v: number): number {
  return PAD + (1 - v / 100) * (HEIGHT - PAD * 2)
}

const pointCoords = computed(() =>
  props.points.map((point, i) => ({
    x: xScale(i, props.points.length),
    y: yScale(point.score),
    label: point.label,
    isLast: i === props.points.length - 1,
  })),
)

const svgPoints = computed(() =>
  pointCoords.value.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '),
)

const areaPath = computed(() => {
  const coords = pointCoords.value
  if (coords.length === 0) {
    return ''
  }
  const first = coords[0] as (typeof coords)[number]
  const last = coords[coords.length - 1] as (typeof coords)[number]
  const baseline = HEIGHT - PAD
  const linePart = coords.map(({ x, y }) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return `M${first.x.toFixed(1)},${baseline} ${linePart} L${last.x.toFixed(1)},${baseline} Z`
})

const currentValue = computed(() => props.points.at(-1)?.score ?? null)

const tickLabels = computed(() =>
  GRID_YS.map((tickY) => ({
    value: tickY,
    label: ` ${tickY} `,
    topPct: (yScale(tickY) / HEIGHT) * 100,
  })),
)

const targetY = computed(() => yScale(TARGET_Y))
const targetTopPct = computed(() => (targetY.value / HEIGHT) * 100)

// X-axis labels — show only the first, middle, and last points (design: uncluttered ticks).
const xLabelIndexes = computed(() => {
  const total = props.points.length
  if (total === 0) {
    return []
  }
  return [...new Set([0, Math.floor(total / 2), total - 1])]
})

const xLabels = computed(() =>
  xLabelIndexes.value.map((i) => ({
    index: i,
    x: pointCoords.value[i]?.x ?? 0,
    text: pointCoords.value[i]?.label ?? '',
  })),
)

// Projection: extend from the last point toward the 80% target line as if the last few sessions'
// pace continued, matching openspec/design/Progress.html.
const projectionPath = computed(() => {
  const coords = pointCoords.value
  const last = coords.at(-1)
  if (!last) {
    return ''
  }
  const projectedX = Math.min(
    last.x + (PROJECTION_STEPS / Math.max(coords.length - 1, 1)) * (WIDTH - PAD_LEFT - PAD),
    WIDTH - PAD - 4,
  )
  const projectedY = yScale(TARGET_SCORE)
  return `M${last.x.toFixed(1)},${last.y.toFixed(1)} L${projectedX.toFixed(1)},${projectedY.toFixed(1)}`
})
</script>

<template>
  <div data-testid="readiness-trend">
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
      <div class="relative">
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
          </g>

          <line
            data-testid="readiness-target-line"
            :x1="PAD_LEFT"
            :y1="targetY"
            :x2="WIDTH - PAD"
            :y2="targetY"
            stroke="currentColor"
            stroke-width="1"
            stroke-dasharray="4,3"
            class="text-readion-status-good/60"
          />

          <path
            data-testid="readiness-area-fill"
            :d="areaPath"
            fill="currentColor"
            class="text-readion-primary/[0.07]"
          />

          <path
            v-if="showProjection"
            data-testid="readiness-projection"
            :d="projectionPath"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-dasharray="5,4"
            class="text-readion-status-good/70"
          />

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

          <text
            v-for="label in xLabels"
            :key="label.index"
            data-testid="readiness-x-label"
            :x="label.x"
            :y="HEIGHT - 2"
            text-anchor="middle"
            font-size="9"
            fill="currentColor"
            class="text-slate-500"
          >{{ label.text }}</text>
        </svg>

        <div
          v-for="tick in tickLabels"
          :key="tick.value"
          class="pointer-events-none absolute right-[calc(100%-6.5%)] -translate-y-1/2 text-slate-500"
          style="font-size: 9px"
          :style="{ top: `${tick.topPct}%` }"
        >
          {{ tick.label }}
        </div>

        <div
          data-testid="readiness-target-label"
          class="pointer-events-none absolute left-[calc(100%-2%)] -translate-y-1/2 whitespace-nowrap text-readion-status-good/70"
          style="font-size: 9px"
          :style="{ top: `${targetTopPct}%` }"
        >
          80% target
        </div>
      </div>
    </template>
  </div>
</template>
