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

// Shared status-palette class helpers so reading/quiz cards, weak-area panels, and the session
// summary all colour from one place instead of duplicating Tailwind token strings.
export function statusTextColorClass(key: StatusColorKey): string {
  return `text-readion-status-${key}`
}

export function statusBorderColorClass(key: StatusColorKey): string {
  return `border-readion-status-${key}`
}
