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
const HEIGHT = 100
const PAD_LEFT = 24
const PAD_RIGHT = 8
const PAD_TOP = 8
const PAD_BOTTOM = 20
const PROJECTION_STEPS = 3
const TARGET_SCORE = 80
const MAX_LABEL_LENGTH = 18

const GRID_YS = [25, 50, 75, 100] as const
const TARGET_Y = 80

function xScale(i: number, total: number): number {
  return PAD_LEFT + (i / Math.max(total - 1, 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT)
}

function yScale(v: number): number {
  return PAD_TOP + (1 - v / 100) * (HEIGHT - PAD_TOP - PAD_BOTTOM)
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
  const baseline = HEIGHT - PAD_BOTTOM
  const linePart = coords.map(({ x, y }) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return `M${first.x.toFixed(1)},${baseline} ${linePart} L${last.x.toFixed(1)},${baseline} Z`
})

const currentValue = computed(() => props.points.at(-1)?.score ?? null)

const targetY = computed(() => yScale(TARGET_Y))

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
    text:
      (pointCoords.value[i]?.label.length ?? 0) > MAX_LABEL_LENGTH
        ? `${pointCoords.value[i]?.label.slice(0, MAX_LABEL_LENGTH - 1)}…`
        : (pointCoords.value[i]?.label ?? ''),
    fullText: pointCoords.value[i]?.label ?? '',
    anchor:
      i === 0
        ? ('start' as const)
        : i === props.points.length - 1
          ? ('end' as const)
          : ('middle' as const),
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
    last.x + (PROJECTION_STEPS / Math.max(coords.length - 1, 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT),
    WIDTH - PAD_RIGHT - 4,
  )
  const projectedY = yScale(TARGET_SCORE)
  return `M${last.x.toFixed(1)},${last.y.toFixed(1)} L${projectedX.toFixed(1)},${projectedY.toFixed(1)}`
})

const projectionPoint = computed(() => {
  const coords = pointCoords.value
  const last = coords.at(-1)
  if (!last) {
    return null
  }
  return {
    x: Math.min(
      last.x + (PROJECTION_STEPS / Math.max(coords.length - 1, 1)) * (WIDTH - PAD_LEFT - PAD_RIGHT),
      WIDTH - PAD_RIGHT - 4,
    ),
    y: yScale(TARGET_SCORE),
  }
})
</script>

<template>
  <div data-testid="readiness-trend" class="w-full max-w-full min-w-0">
    <div class="mb-2 text-[11px] uppercase tracking-wider opacity-70">Readiness Trend</div>

    <div v-if="!hasData" data-testid="progress-not-calibrated" class="py-4 text-center">
      <p class="text-readion-text-secondary text-sm">Not yet calibrated</p>
      <p class="mt-1 text-readion-text-muted text-xs">
        Complete a few sessions to see your readiness trend.
      </p>
    </div>

    <template v-else>
      <div class="mb-2 flex items-end justify-between">
        <span class="font-semibold text-2xl text-readion-text-primary">{{ currentValue }}%</span>
      </div>
      <div class="relative w-full max-w-full min-w-0">
        <svg
          :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
          class="block h-auto w-full max-w-full"
          aria-hidden="true"
        >
          <g v-for="tickY in GRID_YS" :key="tickY">
            <line
              :x1="PAD_LEFT"
              :y1="yScale(tickY)"
              :x2="WIDTH - PAD_RIGHT"
              :y2="yScale(tickY)"
              stroke="currentColor"
              stroke-width="0.5"
              class="text-readion-border-default"
            />
            <text
              :x="PAD_LEFT - 4"
              :y="yScale(tickY) + 3"
              text-anchor="end"
              font-size="8"
              fill="currentColor"
              class="text-readion-text-subtle"
            >{{ tickY }}</text>
          </g>

          <line
            data-testid="readiness-target-line"
            :x1="PAD_LEFT"
            :y1="targetY"
            :x2="WIDTH - PAD_RIGHT"
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

          <circle
            v-if="showProjection && projectionPoint"
            data-testid="readiness-projection-point"
            :cx="projectionPoint.x"
            :cy="projectionPoint.y"
            r="3"
            fill="currentColor"
            class="text-readion-status-good"
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
            :y="HEIGHT - 4"
            :text-anchor="label.anchor"
            font-size="9"
            fill="currentColor"
            class="text-readion-text-subtle"
            :aria-label="label.fullText"
          >
            {{ label.text }}
          </text>

          <text
            data-testid="readiness-target-label"
            :x="WIDTH - PAD_RIGHT"
            :y="targetY - 3"
            text-anchor="end"
            font-size="8"
            fill="currentColor"
            class="text-readion-status-good/70"
          >80% target</text>
        </svg>
      </div>
    </template>
  </div>
</template>
