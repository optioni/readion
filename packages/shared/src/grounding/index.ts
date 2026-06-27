export type {
  DistractorFinding,
  ExtractiveItem,
  FetchMoreMaterialSignal,
  GroundingSignal,
  Provenance,
  SubstitutionSignal,
  VerifierVerdict,
} from './types'

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

// Empty passages cannot be "grounded" — an empty span trivially substring-matches
// anything, so it is rejected outright rather than treated as verbatim.
export function isVerbatimPassage(sourceText: string, passage: string): boolean {
  const normalizedPassage = normalizeText(passage)
  if (normalizedPassage.length === 0) {
    return false
  }
  return normalizeText(sourceText).includes(normalizedPassage)
}
