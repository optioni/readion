import type { AgentConversationMode, CertificationDomain, SessionFocusArea } from '@readion/shared'
import type { ModelMessage } from 'ai'
import { withCacheControl } from '../llm/prompt-cache.helper'

export type SystemPromptCertification = {
  name: string
  provider: string
  code: string
  domains: CertificationDomain[]
  questionCount: number
  passingScore: number
  timeLimitMinutes: number
}

export type SystemPromptWeakArea = {
  domain: string
  score: number
  accuracy: number
  meanConfidence: number
  responseCount: number
}

export type SystemPromptReadiness = {
  calibrated: boolean
  score: number | null
}

export type InSessionPromptInput = {
  mode: Extract<AgentConversationMode, 'in_session'>
  certification: SystemPromptCertification
  weakAreas: SystemPromptWeakArea[]
  readiness: SystemPromptReadiness
  sessionFocus: SessionFocusArea
}

export type StandalonePromptInput = {
  mode: Extract<AgentConversationMode, 'standalone'>
}

export type SystemPromptInput = InSessionPromptInput | StandalonePromptInput

const TOP_WEAK_AREA_COUNT = 5

const EXAM_STRATEGY_GUIDANCE = [
  'Exam strategy: budget time per question against the time limit, eliminate clearly wrong options first,',
  'flag and revisit uncertain questions, and weight your preparation toward the highest-weighted domains.',
].join(' ')

const GROUNDING_CONTRACT = [
  'Grounding contract: answer only from the retrieved context provided by your tools and cite your sources.',
  'When retrieval coverage is thin, abstain with "I don\'t have enough material on that" rather than guessing from',
  'general knowledge. An abstention may trigger fetchMoreMaterial to expand coverage before you answer.',
].join(' ')

const STANDALONE_PROMPT = [
  'You are a friendly, general-purpose study tutor.',
  'Help the user understand concepts clearly and concisely across any topic they ask about.',
].join(' ')

const formatPercent = (ratio: number): string => `${Math.round(ratio * 100)}%`

const systemMessage = (content: string): ModelMessage => ({ role: 'system', content })

const describeSessionFocus = (focus: SessionFocusArea): string =>
  focus.mode === 'domains'
    ? `Active-session focus: ${focus.domains.join(', ')}.`
    : 'Active-session focus: automatic (adaptive across all domains).'

const describeReadiness = (readiness: SystemPromptReadiness): string =>
  readiness.calibrated && readiness.score !== null
    ? `Current readiness score: ${formatPercent(readiness.score)}.`
    : 'Current readiness score: not yet calibrated.'

const buildStaticLayer = (certification: SystemPromptCertification): string => {
  const domains = certification.domains
    .map((domain) => `- ${domain.name} (${formatPercent(domain.weight)})`)
    .join('\n')

  return [
    `You are an expert tutor for the ${certification.name} (${certification.code}) certification by ${certification.provider}.`,
    `Exam format: ${certification.questionCount} questions, passing score ${certification.passingScore}, time limit ${certification.timeLimitMinutes} minutes.`,
    `Weighted exam domains:\n${domains}`,
    EXAM_STRATEGY_GUIDANCE,
    GROUNDING_CONTRACT,
  ].join('\n\n')
}

const buildSemiStaticLayer = (input: InSessionPromptInput): string => {
  const weakAreas = input.weakAreas
    .slice(0, TOP_WEAK_AREA_COUNT)
    .map((area) => `- ${area.domain}: score ${formatPercent(area.score)}`)
    .join('\n')

  return [
    `This user's weakest domains (focus your help here):\n${weakAreas}`,
    describeReadiness(input.readiness),
    describeSessionFocus(input.sessionFocus),
  ].join('\n\n')
}

export function buildSystemPrompt(input: SystemPromptInput, provider: string): ModelMessage[] {
  if (input.mode === 'standalone') {
    return [systemMessage(STANDALONE_PROMPT)]
  }

  return [
    withCacheControl(systemMessage(buildStaticLayer(input.certification)), provider),
    withCacheControl(systemMessage(buildSemiStaticLayer(input)), provider),
  ]
}
