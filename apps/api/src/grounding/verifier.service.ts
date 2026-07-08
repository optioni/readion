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
  ].join('\n')
}

const verifierVerdictSchema = z.object({
  pass: z.boolean().describe('true only if the correct answer is entailed by the cited spans'),
  score: z.number().min(0).max(1).describe('confidence the answer is entailed, 1 = fully entailed'),
  distractorFindings: z
    .array(
      z.object({
        option: z.string().describe('the distractor option text, verbatim'),
        isCorrect: z
          .boolean()
          .describe('true if this distractor is actually defensible per source'),
        reason: z.string().optional().describe('why the distractor is correct or incorrect'),
      }),
    )
    .describe('one finding per distractor (non-correct) option'),
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
