import { Test, type TestingModule } from '@nestjs/testing'
import type { CertExtractionResult } from '@readion/shared'
import { CERT_EXTRACTION_QUEUE } from '@readion/shared'
import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LlmService } from '../../llm/llm.service'
import type { ScrapperClient } from '../../scrapper/scrapper.client'
import { SCRAPPER_CLIENT } from '../../scrapper/scrapper.module'
import { CertExtractionProcessor } from './cert-extraction.processor'
import { CertExtractionService } from './cert-extraction.service'
import type { CertFieldProposals } from './cert-extraction.types'

const SOURCE_URL = 'https://aws.amazon.com/certification/saa-c03/exam-guide'

const SOURCE_TEXT = [
  'AWS Certified Solutions Architect – Associate (SAA-C03) Exam Guide.',
  'The exam contains 65 questions.',
  'Candidates are given a 90-minute time limit to complete the exam.',
  'The exam is divided into the following content domains and weightings:',
  'Domain 1: Design Secure Architectures (30%)',
  'Domain 2: Design Resilient Architectures (26%)',
  'Domain 3: Design High-Performing Architectures (24%)',
  'Domain 4: Design Cost-Optimized Architectures (20%)',
].join('\n')

const groundedProposals = (): CertFieldProposals => ({
  domains: {
    value: [
      { name: 'Design Secure Architectures', weight: 30 },
      { name: 'Design Resilient Architectures', weight: 26 },
      { name: 'Design High-Performing Architectures', weight: 24 },
      { name: 'Design Cost-Optimized Architectures', weight: 20 },
    ],
    passage: 'Domain 1: Design Secure Architectures (30%)',
  },
  questionCount: { value: 65, passage: 'The exam contains 65 questions.' },
  passingScore: null,
  timeLimitMinutes: {
    value: 90,
    passage: 'Candidates are given a 90-minute time limit to complete the exam.',
  },
})

const buildJob = (): Job =>
  ({
    id: 'job-1',
    queueName: CERT_EXTRACTION_QUEUE,
    data: {
      name: 'AWS Certified Solutions Architect',
      code: 'SAA-C03',
      confirmedSourceUrl: SOURCE_URL,
    },
  }) as Partial<Job> as Job

describe('CertExtractionProcessor (integration)', () => {
  let moduleRef: TestingModule
  let processor: CertExtractionProcessor
  let scrapperFetch: ReturnType<typeof vi.fn>
  let extractCertFields: ReturnType<typeof vi.fn>
  let verifyFieldEntailment: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    scrapperFetch = vi.fn().mockResolvedValue({ content: SOURCE_TEXT, url: SOURCE_URL })
    extractCertFields = vi.fn()
    verifyFieldEntailment = vi.fn().mockResolvedValue(true)

    moduleRef = await Test.createTestingModule({
      providers: [
        CertExtractionService,
        CertExtractionProcessor,
        {
          provide: SCRAPPER_CLIENT,
          useValue: { fetch: scrapperFetch } as Partial<ScrapperClient> as ScrapperClient,
        },
        {
          provide: LlmService,
          useValue: {
            extractCertFields,
            verifyFieldEntailment,
          } as Partial<LlmService> as LlmService,
        },
      ],
    }).compile()

    processor = moduleRef.get(CertExtractionProcessor)
  })

  const run = (): Promise<CertExtractionResult> =>
    processor.handle(buildJob()) as Promise<CertExtractionResult>

  it('fetches the confirmed source and grounds verbatim, entailed fields with citations', async () => {
    extractCertFields.mockResolvedValue(groundedProposals())

    const result = await run()

    expect(scrapperFetch).toHaveBeenCalledWith(SOURCE_URL)
    expect(result).not.toBeNull()
    const fields = result!.fields

    expect(fields.questionCount).toEqual({
      value: 65,
      citation: { url: SOURCE_URL, passage: 'The exam contains 65 questions.' },
    })
    expect(fields.timeLimitMinutes).toEqual({
      value: 90,
      citation: {
        url: SOURCE_URL,
        passage: 'Candidates are given a 90-minute time limit to complete the exam.',
      },
    })
    expect('citation' in fields.domains && fields.domains.citation.url).toBe(SOURCE_URL)
    expect('value' in fields.domains && fields.domains.value).toHaveLength(4)
  })

  it('flags a field absent from the source as unverified with no fabricated value', async () => {
    extractCertFields.mockResolvedValue(groundedProposals())

    const result = await run()

    expect(result!.fields.passingScore).toEqual({ unverified: true })
  })

  it('rejects a proposed passage that is not a verbatim substring of the source', async () => {
    const proposals = groundedProposals()
    proposals.questionCount = { value: 65, passage: 'The test asks 65 questions total.' }
    extractCertFields.mockResolvedValue(proposals)
    verifyFieldEntailment.mockResolvedValue(true)

    const result = await run()

    expect(result!.fields.questionCount).toEqual({ unverified: true })
    expect(verifyFieldEntailment).not.toHaveBeenCalledWith(
      expect.anything(),
      'The test asks 65 questions total.',
    )
  })

  it('flags a verbatim field whose value the independent verifier does not entail', async () => {
    extractCertFields.mockResolvedValue(groundedProposals())
    verifyFieldEntailment.mockImplementation(
      async (_value: unknown, passage: string) => passage !== 'The exam contains 65 questions.',
    )

    const result = await run()

    expect(result!.fields.questionCount).toEqual({ unverified: true })
    expect('citation' in result!.fields.timeLimitMinutes).toBe(true)
  })
})
