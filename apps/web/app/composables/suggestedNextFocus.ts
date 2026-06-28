import type { WeakAreaResponseDto } from '~~/src/api/model'

export type SuggestedNextFocusSource = 'session' | 'weak-area' | 'none'

export interface SuggestedNextFocus {
  domain: string | null
  source: SuggestedNextFocusSource
}

export function selectSuggestedNextFocus(
  sessionNextFocusDomain: string | null,
  weakAreas: WeakAreaResponseDto[],
): SuggestedNextFocus {
  if (sessionNextFocusDomain) {
    return { domain: sessionNextFocusDomain, source: 'session' }
  }

  const lowest = weakAreas.reduce<WeakAreaResponseDto | null>((min, area) => {
    if (min === null || area.score < min.score) {
      return area
    }
    return min
  }, null)

  if (lowest) {
    return { domain: lowest.domain, source: 'weak-area' }
  }

  return { domain: null, source: 'none' }
}
