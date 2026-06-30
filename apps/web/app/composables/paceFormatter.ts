export function computePaceRate(points: number[]): number | null {
  if (points.length < 2) {
    return null
  }
  const first = points[0]
  const last = points[points.length - 1]
  return (last - first) / (points.length - 1)
}

export function formatPaceString({
  paceRate,
  weeksToReady,
}: {
  paceRate: number
  weeksToReady: number
}): string {
  const rate = Number(paceRate.toFixed(1))
  const weekWord = weeksToReady === 1 ? 'week' : 'weeks'
  return `At your recent pace (${rate}% readiness/session avg.), you'll be exam-ready in approximately ${weeksToReady} ${weekWord}.`
}
