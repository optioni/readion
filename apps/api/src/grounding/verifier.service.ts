import { Injectable } from '@nestjs/common'
import type { ExtractiveItem, VerifierVerdict } from '@readion/shared'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Counter } from 'prom-client'
import { z } from 'zod'
import { LlmService } from '../llm/llm.service'
import { GROUNDING_VERIFIER_RESULTS_METRIC } from './grounding.metrics'
import type { GroundedChunk } from './types'

function buildVerifierPrompt(item: ExtractiveItem, chunks: GroundedChunk[]): string {
  const chunksText = chunks.map((c) => `[${c.id}]: ${c.text}`).join('\n\n')
  const optionsList = item.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')
  const spansText = item.supportingSpans.map((s) => `- "${s}"`).join('\n')

  return [
    'You are an independent answer verifier. Evaluate the following question and answer against the cited source material.',
    '',
    '## Source Chunks',
    chunksText,
    '',
    '## Question',
    item.question,
    '',
    '## Options',
    optionsList,
    '',
    `## Claimed Correct Answer: ${item.correctAnswer}`,
    '',
    '## Supporting Spans',
    spansText,
    '',
    'Verify:',
    '1. Is the correct answer entailed by the cited supporting spans?',
    '2. Is each distractor actually incorrect per the source material?',
    '',
    'Respond with JSON only:',
    '{"pass": boolean, "score": number (0-1), "distractorFindings": [{"option": string, "isCorrect": boolean, "reason": string}]}',
  ].join('\n')
}

const verifierVerdictSchema = z.object({
  pass: z.boolean(),
  score: z.number(),
  distractorFindings: z.array(
    z.object({
      option: z.string(),
      isCorrect: z.boolean(),
      reason: z.string().optional(),
    }),
  ),
})

@Injectable()
export class VerifierService {
  constructor(
    private readonly llmService: LlmService,
    @InjectMetric(GROUNDING_VERIFIER_RESULTS_METRIC)
    private readonly verifierResultsCounter: Counter,
  ) {}

  async verify(item: ExtractiveItem, chunks: GroundedChunk[]): Promise<VerifierVerdict> {
    const prompt = buildVerifierPrompt(item, chunks)
    const { object } = await this.llmService.generateObject({
      taskType: 'answer-verification',
      messages: [{ role: 'user', content: prompt }],
      schema: verifierVerdictSchema,
    })

    const verdict: VerifierVerdict = {
      pass: object.pass,
      score: object.score,
      distractorFindings: object.distractorFindings.map((finding) => ({
        option: finding.option,
        isCorrect: finding.isCorrect,
        reason: finding.reason,
      })),
    }
    this.verifierResultsCounter.inc({ result: verdict.pass ? 'pass' : 'fail' })
    return verdict
  }
}
