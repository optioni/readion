import 'reflect-metadata'
import type {
  LanguageModelV3FinishReason,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider'
import { ConfigService } from '@nestjs/config'
import { Test, type TestingModule } from '@nestjs/testing'
import { getToken } from '@willsoto/nestjs-prometheus'
import { MockLanguageModelV3 } from 'ai/test'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LLM_DURATION_METRIC,
  LLM_ERRORS_METRIC,
  LLM_TOKEN_USAGE_METRIC,
  LlmService,
} from '../llm/llm.service'
import { ModelRegistryService } from '../llm/model-registry.service'
import { ProviderAdapter } from '../llm/provider-adapter'
import { CertDiscoveryService } from './cert-discovery.service'
import { CERT_SEARCH_PORT, type CertSearchResult } from './cert-discovery.types'

const VENDOR_URL = 'https://aws.amazon.com/certification/certified-cloud-practitioner/'
const THIRD_PARTY_URL =
  'https://www.examtopics.com/exams/amazon/aws-certified-cloud-practitioner/'
const HALLUCINATED_URL = 'https://totally-made-up.example.invalid/clf'

const VENDOR_RESULT: CertSearchResult = {
  url: VENDOR_URL,
  title: 'AWS Certified Cloud Practitioner',
  snippet: 'Official exam guide and overview.',
  official: true,
}
const THIRD_PARTY_RESULT: CertSearchResult = {
  url: THIRD_PARTY_URL,
  title: 'AWS Certified Cloud Practitioner practice exams',
  snippet: 'Community-contributed practice questions.',
  official: false,
}

// The model is asked to return a ranked list; it lists the third-party page
// first and even hallucinates a URL the search never returned. The service must
// re-rank vendor-first and drop the hallucinated URL.
const MODEL_OUTPUT_JSON = JSON.stringify({
  candidates: [{ url: THIRD_PARTY_URL }, { url: VENDOR_URL }, { url: HALLUCINATED_URL }],
  suggestedContentSources: [
    { url: VENDOR_URL, type: 'web' },
    { url: HALLUCINATED_URL, type: 'web' },
  ],
})

const FINISH_REASON_STOP: LanguageModelV3FinishReason = { unified: 'stop', raw: 'stop' }
const FINISH_REASON_TOOL_CALLS: LanguageModelV3FinishReason = {
  unified: 'tool-calls',
  raw: 'tool_calls',
}

const STREAM_USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
} as const

function streamFromParts(parts: LanguageModelV3StreamPart[]) {
  return new ReadableStream<LanguageModelV3StreamPart>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(part)
      }
      controller.close()
    },
  })
}

function textReplyParts(deltas: string[]): LanguageModelV3StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'txt-1' },
    ...deltas.map(
      (delta): LanguageModelV3StreamPart => ({ type: 'text-delta', id: 'txt-1', delta }),
    ),
    { type: 'text-end', id: 'txt-1' },
    { type: 'finish', finishReason: FINISH_REASON_STOP, usage: STREAM_USAGE },
  ]
}

function toolCallParts(toolName: string, input: string): LanguageModelV3StreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'tool-input-start', id: 'call-1', toolName },
    { type: 'tool-input-delta', id: 'call-1', delta: input },
    { type: 'tool-input-end', id: 'call-1' },
    { type: 'tool-call', toolCallId: 'call-1', toolName, input },
    { type: 'finish', finishReason: FINISH_REASON_TOOL_CALLS, usage: STREAM_USAGE },
  ]
}

type StreamArgs = {
  prompt: Array<{ role: string; content: unknown }>
  tools?: Array<{ name: string }>
}

const PREFILL_MODEL_ID = 'mock-prefill-model'

const fakeConfig = {
  get: (key: string): string | number | undefined => {
    if (key === 'AI_MODEL_CERTIFICATION_PREFILL') return PREFILL_MODEL_ID
    if (key === 'AI_MAX_TOKENS_CERTIFICATION_PREFILL') return 4096
    return undefined
  },
}

describe('CertDiscoveryService', () => {
  let moduleRef: TestingModule
  let service: CertDiscoveryService
  let modelRegistry: ModelRegistryService
  let searchMock: ReturnType<typeof vi.fn>
  let capturedTools: Array<{ name: string }> | undefined

  beforeEach(async () => {
    capturedTools = undefined
    searchMock = vi.fn()

    const langModel = new MockLanguageModelV3({
      doStream: async ({ prompt, tools }: StreamArgs) => {
        capturedTools = tools
        const hasToolResult = prompt.some((message) => message.role === 'tool')
        if (!hasToolResult) {
          return {
            stream: streamFromParts(
              toolCallParts('webSearch', JSON.stringify({ query: 'cert exam guide' })),
            ),
          }
        }
        return { stream: streamFromParts(textReplyParts([MODEL_OUTPUT_JSON])) }
      },
    })

    moduleRef = await Test.createTestingModule({
      providers: [
        CertDiscoveryService,
        LlmService,
        ModelRegistryService,
        { provide: ConfigService, useValue: fakeConfig },
        {
          provide: ProviderAdapter,
          useValue: {
            getChatModel: vi.fn().mockReturnValue(langModel),
            getEmbeddingModel: vi.fn(),
          },
        },
        { provide: getToken(LLM_DURATION_METRIC), useValue: { observe: vi.fn() } },
        { provide: getToken(LLM_TOKEN_USAGE_METRIC), useValue: { inc: vi.fn() } },
        { provide: getToken(LLM_ERRORS_METRIC), useValue: { inc: vi.fn() } },
        { provide: CERT_SEARCH_PORT, useValue: { search: searchMock } },
      ],
    }).compile()

    service = moduleRef.get(CertDiscoveryService)
    modelRegistry = moduleRef.get(ModelRegistryService)
  })

  it('resolves the certification-prefill task type through the gateway', async () => {
    searchMock.mockResolvedValue([VENDOR_RESULT, THIRD_PARTY_RESULT])
    const resolveSpy = vi.spyOn(modelRegistry, 'resolve')

    await service.discoverSources({ name: 'AWS Certified Cloud Practitioner', code: 'CLF-C02' })

    expect(resolveSpy).toHaveBeenCalledWith('certification-prefill')
  })

  it('supplies a web-search tool through the tool-capable call', async () => {
    searchMock.mockResolvedValue([VENDOR_RESULT, THIRD_PARTY_RESULT])

    await service.discoverSources({ name: 'AWS Certified Cloud Practitioner', code: 'CLF-C02' })

    expect(searchMock).toHaveBeenCalled()
    expect(capturedTools?.some((tool) => tool.name === 'webSearch')).toBe(true)
  })

  it('returns candidates grounded in the search results, vendor domain ranked first', async () => {
    searchMock.mockResolvedValue([THIRD_PARTY_RESULT, VENDOR_RESULT])

    const result = await service.discoverSources({
      name: 'AWS Certified Cloud Practitioner',
      code: 'CLF-C02',
    })

    expect(result.candidates.map((candidate) => candidate.url)).toEqual([
      VENDOR_URL,
      THIRD_PARTY_URL,
    ])
    expect(result.candidates[0]).toMatchObject({
      url: VENDOR_URL,
      title: VENDOR_RESULT.title,
      snippet: VENDOR_RESULT.snippet,
    })
  })

  it('never emits a URL absent from the search results', async () => {
    searchMock.mockResolvedValue([VENDOR_RESULT, THIRD_PARTY_RESULT])

    const result = await service.discoverSources({
      name: 'AWS Certified Cloud Practitioner',
      code: 'CLF-C02',
    })

    const urls = result.candidates.map((candidate) => candidate.url)
    expect(urls).not.toContain(HALLUCINATED_URL)
    expect(result.suggestedContentSources?.map((source) => source.url)).not.toContain(
      HALLUCINATED_URL,
    )
    expect(result.suggestedContentSources).toEqual([{ url: VENDOR_URL, type: 'web' }])
  })

  it('returns an empty candidate list when the search yields nothing', async () => {
    searchMock.mockResolvedValue([])

    const result = await service.discoverSources({
      name: 'Totally Unknown Certification',
    })

    expect(result.candidates).toEqual([])
  })
})
