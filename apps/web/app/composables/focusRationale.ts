import { pluralizeUnit } from '~/composables/paceFormatter'

export function buildFocusRationale(
  score: number | null,
  lastStudiedDaysAgo: number | null,
): string | null {
  if (score === null) {
    return null
  }

  const parts = [`Lowest domain score (${score}%).`]
  if (lastStudiedDaysAgo !== null) {
    const unit = pluralizeUnit(lastStudiedDaysAgo, 'day')
    parts.push(`Last studied ${lastStudiedDaysAgo} ${unit} ago.`)
  }
  return parts.join(' ')
}
