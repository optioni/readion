import type { EnrollmentCard } from '~/composables/useEnrollments'

export interface HeroOrdering {
  hero: EnrollmentCard | null
  rest: EnrollmentCard[]
}

const byScoreAscending = (a: EnrollmentCard, b: EnrollmentCard) =>
  (a.readinessScore ?? 0) - (b.readinessScore ?? 0)

const byEnrolledAtDescending = (a: EnrollmentCard, b: EnrollmentCard) =>
  b.enrolledAt.localeCompare(a.enrolledAt)

export function selectHeroAndOrder(cards: EnrollmentCard[]): HeroOrdering {
  const calibrated = cards.filter((card) => card.readinessScore !== null).sort(byScoreAscending)
  const uncalibrated = cards
    .filter((card) => card.readinessScore === null)
    .sort(byEnrolledAtDescending)

  const ordered = [...calibrated, ...uncalibrated]
  const [hero, ...rest] = ordered

  return { hero: hero ?? null, rest }
}
