export interface ReadinessValue {
  calibrated: boolean
  score: number | null
}

export interface ReadinessDisplay {
  calibrated: boolean
  label: string | null
  percent: string | null
  delta: string | null
  score: number | null
}

const NOT_CALIBRATED: ReadinessDisplay = {
  calibrated: false,
  label: 'not yet calibrated',
  percent: null,
  delta: null,
  score: null,
}

const formatDelta = (delta: number | null): string | null => {
  if (delta === null) {
    return null
  }
  return `${delta >= 0 ? '+' : ''}${delta}%`
}

export function formatReadiness(readiness: ReadinessValue, delta: number | null): ReadinessDisplay {
  if (!readiness.calibrated || readiness.score === null) {
    return NOT_CALIBRATED
  }

  return {
    calibrated: true,
    label: null,
    percent: `${readiness.score}%`,
    delta: formatDelta(delta),
    score: readiness.score,
  }
}
