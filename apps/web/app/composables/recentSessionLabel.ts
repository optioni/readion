import type { SessionResponseDto } from '~~/src/api/model'

const ALL_DOMAINS_LABEL = 'All domains'

const formatFocusArea = (focusArea: unknown): string => {
  if (
    typeof focusArea === 'object' &&
    focusArea !== null &&
    (focusArea as { mode?: unknown }).mode === 'domains'
  ) {
    const domains = (focusArea as { domains?: unknown }).domains
    if (Array.isArray(domains) && domains.length > 0) {
      return domains.join(', ')
    }
  }
  return ALL_DOMAINS_LABEL
}

const formatKind = (kind: unknown): string => {
  const value = String(kind)
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export const recentSessionLabel = (session: SessionResponseDto): string =>
  `${formatKind(session.kind)} · ${formatFocusArea(session.focusArea)}`
