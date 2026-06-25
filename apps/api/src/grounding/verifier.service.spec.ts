import type { ExtractiveItem } from '@readion/shared'
import type { Counter } from 'prom-client'
import { describe, expect, it, vi } from 'vitest'
import type { LlmService } from '../llm/llm.service'
import { GROUNDING_VERIFIER_RESULTS_METRIC } from './grounding.metrics'
import type { GroundedChunk } from './types'
import { VerifierService } from './verifier.service'

const CHUNK: GroundedChunk = {
  id: 'chunk-1',
  text: 'Amazon EC2 provides scalable computing capacity in the cloud.',
  similarity: 0.9,
  primaryDomain: 'compute',
}

const ITEM: ExtractiveItem = {
  question: 'What does EC2 provide?',
  options: ['Scalable computing capacity', 'Object storage', 'DNS', 'Load balancing'],
  correctAnswer: 'Scalable computing capacity',
  supportingSpans: ['Amazon EC2 provides scalable computing capacity'],
  sourceChunkIds: ['chunk-1'],
}

const PASSING_VERDICT_JSON = JSON.stringify({
  pass: true,
  score: 0.95,
  distractorFindings: [
    { option: 'Object storage', isCorrect: false, reason: 'Not an EC2 feature' },
    { option: 'DNS', isCorrect: false, reason: 'Not an EC2 feature' },
    { option: 'Load balancing', isCorrect: false, reason: 'That is ELB, not EC2' },
  ],
})

const FAILING_VERDICT_JSON = JSON.stringify({
  pass: false,
  score: 0.2,
  distractorFindings: [
    { option: 'Object storage', isCorrect: true, reason: 'S3 is mentioned in this context' },
  ],
})

const DISTRACTOR_CORRECT_JSON = JSON.stringify({
  pass: false,
  score: 0.4,
  distractorFindings: [
    { option: 'Object storage', isCorrect: true, reason: 'Object storage is mentioned in source' },
    { option: 'DNS', isCorrect: false, reason: 'Not mentioned' },
  ],
})

function makeLlmService(responseText: string): LlmService {
  return {
    generateText: vi.fn().mockResolvedValue({
      text: responseText,
      usage: { inputTokens: 10, outputTokens: 50, totalTokens: 60 },
    }),
  } as unknown as LlmService
}

function makeCounter(): Counter {
  return { inc: vi.fn() } as unknown as Counter
}

function makeService(
  responseText: string,
  counter?: Counter,
): { svc: VerifierService; llm: LlmService; counter: Counter } {
  const llm = makeLlmService(responseText)
  const c = counter ?? makeCounter()
  const svc = new VerifierService(llm, c)
  return { svc, llm, counter: c }
}

describe('VerifierService', () => {
  it('issues a separate answer-verification task-type call through the gateway', async () => {
    const { svc, llm } = makeService(PASSING_VERDICT_JSON)

    await svc.verify(ITEM, [CHUNK])

    expect(llm.generateText).toHaveBeenCalledWith(
      expect.objectContaining({ taskType: 'answer-verification' }),
    )
  })

  it('does not reuse the generation call — issues its own separate call', async () => {
    const { svc, llm } = makeService(PASSING_VERDICT_JSON)

    await svc.verify(ITEM, [CHUNK])

    expect(llm.generateText).toHaveBeenCalledTimes(1)
  })

  it('returns a pass verdict with score and per-distractor findings when the answer is entailed', async () => {
    const { svc } = makeService(PASSING_VERDICT_JSON)

    const verdict = await svc.verify(ITEM, [CHUNK])

    expect(verdict.pass).toBe(true)
    expect(verdict.score).toBe(0.95)
    expect(verdict.distractorFindings).toHaveLength(3)
    expect(verdict.distractorFindings[0]?.isCorrect).toBe(false)
  })

  it('returns a fail verdict when the answer is not entailed by the cited span', async () => {
    const { svc } = makeService(FAILING_VERDICT_JSON)

    const verdict = await svc.verify(ITEM, [CHUNK])

    expect(verdict.pass).toBe(false)
    expect(verdict.score).toBe(0.2)
  })

  it('returns a fail verdict and identifies the offending distractor when it is actually correct', async () => {
    const { svc } = makeService(DISTRACTOR_CORRECT_JSON)

    const verdict = await svc.verify(ITEM, [CHUNK])

    expect(verdict.pass).toBe(false)
    const offending = verdict.distractorFindings.find((f: { isCorrect: boolean }) => f.isCorrect)
    expect(offending?.option).toBe('Object storage')
  })

  it('increments the pass metric counter when the verdict is pass', async () => {
    const counter = makeCounter()
    const { svc } = makeService(PASSING_VERDICT_JSON, counter)

    await svc.verify(ITEM, [CHUNK])

    expect(counter.inc).toHaveBeenCalledWith(expect.objectContaining({ result: 'pass' }))
  })

  it('increments the fail metric counter when the verdict is fail', async () => {
    const counter = makeCounter()
    const { svc } = makeService(FAILING_VERDICT_JSON, counter)

    await svc.verify(ITEM, [CHUNK])

    expect(counter.inc).toHaveBeenCalledWith(expect.objectContaining({ result: 'fail' }))
  })

  it(`uses the ${GROUNDING_VERIFIER_RESULTS_METRIC} metric name`, () => {
    expect(GROUNDING_VERIFIER_RESULTS_METRIC).toBe('readion_grounding_verifier_results_total')
  })
})
