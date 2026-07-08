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

// PDF-extracted text carries ligatures (ﬁ, ﬂ), full-width forms, and other
// compatibility characters that a model reproduces in their decomposed ASCII
// form when quoting. NFKC folds those together so a verbatim check is not
// defeated by "Certiﬁed" vs "Certified". Kept separate from normalizeText so
// the chunker's content hash (which uses normalizeText) stays stable.
function normalizeForGrounding(text: string): string {
  return normalizeText(text.normalize('NFKC'))
}

// Empty passages cannot be "grounded" — an empty span trivially substring-matches
// anything, so it is rejected outright rather than treated as verbatim.
export function isVerbatimPassage(sourceText: string, passage: string): boolean {
  const normalizedPassage = normalizeForGrounding(passage)
  if (normalizedPassage.length === 0) {
    return false
  }
  return normalizeForGrounding(sourceText).includes(normalizedPassage)
}
