export type StatusColorKey = 'poor' | 'warning' | 'medium' | 'good'

export function statusColorForScore(score: number): StatusColorKey {
  if (score < 50) {
    return 'poor'
  }
  if (score < 65) {
    return 'warning'
  }
  if (score <= 80) {
    return 'medium'
  }
  return 'good'
}
