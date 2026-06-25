import { Injectable } from '@nestjs/common'
import type { ExtractiveItem, VerifierVerdict } from '@readion/shared'
import { InjectMetric } from '@willsoto/nestjs-prometheus'
import type { Counter } from 'prom-client'
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

function parseVerdict(text: string): VerifierVerdict {
  const parsed = JSON.parse(text) as {
    pass: boolean
    score: number
    distractorFindings: Array<{ option: string; isCorrect: boolean; reason?: string }>
  }
  return {
    pass: Boolean(parsed.pass),
    score: Number(parsed.score),
    distractorFindings: parsed.distractorFindings.map((f) => ({
      option: f.option,
      isCorrect: f.isCorrect,
      reason: f.reason,
    })),
  }
}

@Injectable()
export class VerifierService {
  constructor(
    private readonly llmService: LlmService,
    @InjectMetric(GROUNDING_VERIFIER_RESULTS_METRIC)
    private readonly verifierResultsCounter: Counter,
  ) {}

  async verify(item: ExtractiveItem, chunks: GroundedChunk[]): Promise<VerifierVerdict> {
    const prompt = buildVerifierPrompt(item, chunks)
    const result = await this.llmService.generateText({
      taskType: 'answer-verification',
      messages: [{ role: 'user', content: prompt }],
    })

    const verdict = parseVerdict(result.text)
    this.verifierResultsCounter.inc({ result: verdict.pass ? 'pass' : 'fail' })
    return verdict
  }
}
