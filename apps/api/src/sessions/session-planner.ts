import { createHash } from 'node:crypto'
import type {
  QuestionFormat,
  SessionContentMix,
  SessionDifficulty,
  SessionDurationMinutes,
  SessionFocusArea,
  SessionLearningStyle,
} from '@readion/shared'
import type { WeakAreaDto } from '../weak-areas/weak-areas.service'

export type ItemPlan = {
  index: number
  type: 'reading' | 'quiz'
  domain: string
  format?: QuestionFormat
  anchorChunkId?: string
}

export type ReviewFrontLoadTarget = { domain: string; anchorChunkId: string }

export type BuildItemPlanInput = {
  durationMinutes: number
  contentMix: SessionContentMix
  difficulty: SessionDifficulty
  targetDomains: string[]
  certificationId: string
}

type ContentMixRatios = {
  quizPerReading: number
  readingMinutes: number
  quizMinutes: number
}

const CONTENT_MIX_RATIOS: Record<SessionContentMix, ContentMixRatios> = {
  balanced: { quizPerReading: 3, readingMinutes: 2, quizMinutes: 1 },
  'reading-heavy': { quizPerReading: 1, readingMinutes: 2, quizMinutes: 1 },
  'quiz-heavy': { quizPerReading: 5, readingMinutes: 2, quizMinutes: 1 },
  'video-based': { quizPerReading: 1, readingMinutes: 3, quizMinutes: 1 },
}

export function buildItemPlan(input: BuildItemPlanInput): ItemPlan[] {
  const { durationMinutes, contentMix, difficulty, targetDomains, certificationId } = input
  const ratios = CONTENT_MIX_RATIOS[contentMix]
  const { quizPerReading, readingMinutes, quizMinutes } = ratios

  const blockDuration = readingMinutes + quizPerReading * quizMinutes
  const readingBlocks = Math.max(1, Math.round(durationMinutes / blockDuration))

  const plan: ItemPlan[] = []
  let globalIndex = 0

  for (let block = 0; block < readingBlocks; block++) {
    const domain = targetDomains[block % targetDomains.length]!

    plan.push({ index: globalIndex++, type: 'reading', domain })

    for (let q = 0; q < quizPerReading; q++) {
      const format = planQuizFormat(certificationId, domain, block, q, difficulty)
      plan.push({ index: globalIndex++, type: 'quiz', domain, format })
    }
  }

  return plan
}

export function frontLoadReviewItems(
  plan: ItemPlan[],
  dueTargets: ReviewFrontLoadTarget[],
): ItemPlan[] {
  if (dueTargets.length === 0) return plan

  const reviewItems: ItemPlan[] = dueTargets.map((target, index) => ({
    index,
    type: 'quiz',
    domain: target.domain,
    anchorChunkId: target.anchorChunkId,
  }))
  const shifted = plan.map((item) => ({ ...item, index: item.index + reviewItems.length }))
  return [...reviewItems, ...shifted]
}

function planQuizFormat(
  certificationId: string,
  domain: string,
  blockIndex: number,
  quizIndex: number,
  difficulty: SessionDifficulty,
): QuestionFormat {
  const hash = createHash('sha256')
    .update(`${certificationId}:${domain}:${blockIndex}:${quizIndex}`)
    .digest('hex')
  const bucket = Number.parseInt(hash.slice(0, 8), 16)

  if (difficulty === 'exam-ready') {
    const formats: QuestionFormat[] = ['multiple_choice', 'true_false', 'scenario']
    return formats[bucket % 3]!
  }

  const formats: QuestionFormat[] = ['multiple_choice', 'true_false']
  return formats[bucket % 2]!
}

export type SessionConfigInput = {
  durationMinutes?: number
  contentMix?: SessionContentMix
  difficulty?: SessionDifficulty
  focusArea?: SessionFocusArea
  learningStyle?: SessionLearningStyle
}

export type SavedSessionConfig = {
  durationMinutes?: number
  contentMix?: SessionContentMix
  difficulty?: SessionDifficulty
  focusArea?: SessionFocusArea
  learningStyle?: SessionLearningStyle
} | null

export type ResolvedSessionConfig = {
  durationMinutes: SessionDurationMinutes
  contentMix: SessionContentMix
  difficulty: SessionDifficulty
  focusArea: SessionFocusArea
  learningStyle: SessionLearningStyle
}

const SESSION_CONFIG_DEFAULTS: ResolvedSessionConfig = {
  durationMinutes: 30,
  contentMix: 'balanced',
  difficulty: 'intermediate',
  focusArea: { mode: 'auto' },
  learningStyle: 'weak-area-focus',
}

export function resolveSessionConfig(
  request: SessionConfigInput,
  saved: SavedSessionConfig,
): ResolvedSessionConfig {
  return {
    durationMinutes: (request.durationMinutes ??
      saved?.durationMinutes ??
      SESSION_CONFIG_DEFAULTS.durationMinutes) as SessionDurationMinutes,
    contentMix: request.contentMix ?? saved?.contentMix ?? SESSION_CONFIG_DEFAULTS.contentMix,
    difficulty: (request.difficulty ??
      saved?.difficulty ??
      SESSION_CONFIG_DEFAULTS.difficulty) as SessionDifficulty,
    focusArea: request.focusArea ?? saved?.focusArea ?? SESSION_CONFIG_DEFAULTS.focusArea,
    learningStyle:
      request.learningStyle ?? saved?.learningStyle ?? SESSION_CONFIG_DEFAULTS.learningStyle,
  }
}

export function resolveTargetDomains(
  focusArea: SessionFocusArea,
  weakAreas: WeakAreaDto[],
  certDomains: string[],
): string[] {
  if (focusArea.mode === 'domains') {
    return focusArea.domains
  }

  if (weakAreas.length === 0) {
    return certDomains
  }

  const sorted = [...weakAreas].sort((a, b) => a.score - b.score)
  const n = sorted.length
  const slots = sorted.map((w, i) => ({ domain: w.domain, remaining: n - i }))
  const total = (n * (n + 1)) / 2
  const weighted: string[] = []
  for (let i = 0; i < total; i++) {
    const best = slots.reduce((prev, cur) => (cur.remaining > prev.remaining ? cur : prev))
    weighted.push(best.domain)
    best.remaining -= 1
  }
  return weighted
}
