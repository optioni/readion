export function computePaceRate(points: number[]): number | null {
  const first = points[0]
  const last = points.at(-1)
  if (first === undefined || last === undefined || points.length < 2) {
    return null
  }
  return (last - first) / (points.length - 1)
}

export function pluralizeUnit(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`
}

export function formatPaceString({
  paceRate,
  weeksToReady,
}: {
  paceRate: number
  weeksToReady: number
}): string {
  const rate = paceRate.toFixed(1)
  const weekWord = pluralizeUnit(weeksToReady, 'week')
  return `At your recent pace (${rate}% readiness/session avg.), you'll be exam-ready in approximately ${weeksToReady} ${weekWord}.`
}
