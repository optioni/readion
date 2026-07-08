const SOURCE_FALLBACK = 'Source'

export function resolveCitationLabel(...candidates: (string | null | undefined)[]): string {
  return candidates.find((candidate) => Boolean(candidate?.trim())) ?? SOURCE_FALLBACK
}

export function readingCitationLabels(
  sourceChunkIds: string[],
  supportingSpans: string[],
): string[] {
  return [
    ...sourceChunkIds.map(() => resolveCitationLabel()),
    ...supportingSpans.map((span) => resolveCitationLabel(span)),
  ]
}
