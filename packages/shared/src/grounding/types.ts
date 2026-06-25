export interface ExtractiveItem {
  question: string
  options: string[]
  correctAnswer: string
  supportingSpans: string[]
  sourceChunkIds: string[]
}

export interface DistractorFinding {
  option: string
  isCorrect: boolean
  reason?: string
}

export interface VerifierVerdict {
  pass: boolean
  score: number
  distractorFindings: DistractorFinding[]
}

export interface Provenance {
  sourceChunkIds: string[]
  supportingSpans: string[]
  verdict: VerifierVerdict
  score: number
}

export interface FetchMoreMaterialSignal {
  type: 'fetchMoreMaterial'
  certificationId: string
  domain: string
}

export interface SubstitutionSignal {
  type: 'substitution'
}

export type GroundingSignal = FetchMoreMaterialSignal | SubstitutionSignal
