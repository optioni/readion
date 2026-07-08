import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  contentSourceTypes,
  type DiscoverSourcesRequest,
  type DiscoverSourcesResponse,
  type DiscoveryCandidate,
  rankDiscoveryCandidates,
  type SuggestedContentSource,
} from '@readion/shared'
import { type ModelMessage, stepCountIs, type ToolSet, tool } from 'ai'
import { z } from 'zod'
import { LlmService } from '../llm/llm.service'
import {
  CERT_SEARCH_PORT,
  type CertSearchPort,
  type CertSearchResult,
} from './cert-discovery.types'

const CERT_DISCOVERY_MAX_STEPS = 4

const DISCOVERY_SYSTEM_PROMPT =
  'You research certification exams. Use the webSearch tool to find authoritative pages, then return only the URLs the search actually surfaced. Never invent a URL. Respond with JSON: { "candidates": [{ "url": string }], "suggestedContentSources": [{ "url": string, "type": string }] }.'

const modelOutputSchema = z.object({
  candidates: z.array(z.object({ url: z.string() })).optional(),
  suggestedContentSources: z
    .array(z.object({ url: z.string(), type: z.enum(contentSourceTypes) }))
    .optional(),
})

interface DiscoveryDiagnostics {
  searchResultCount: number
  parsedCandidateCount: number
  groundedCandidateCount: number
  finalTextLength: number
}

@Injectable()
export class CertDiscoveryService {
  private readonly logger = new Logger(CertDiscoveryService.name)

  constructor(
    private readonly llm: LlmService,
    @Inject(CERT_SEARCH_PORT) private readonly search: CertSearchPort,
  ) {}

  async discoverSources(request: DiscoverSourcesRequest): Promise<DiscoverSourcesResponse> {
    const searchResults: CertSearchResult[] = []
    const tools: ToolSet = {
      webSearch: tool({
        description:
          'Search the public web for pages describing a certification exam. Returns grounded results with their source URLs.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => {
          const results = await this.search.search(query)
          this.logger.debug(`webSearch query=${JSON.stringify(query)} results=${results.length}`)
          searchResults.push(...results)
          return results
        },
      }),
    }

    const result = await this.llm.streamText({
      taskType: 'certification-prefill',
      system: DISCOVERY_SYSTEM_PROMPT,
      messages: buildMessages(request),
      tools,
      stopWhen: stepCountIs(CERT_DISCOVERY_MAX_STEPS),
    })

    const finalText = await result.text

    const { response, diagnostics } = assembleResponse(finalText, searchResults)
    this.logOutcome(request, finalText, diagnostics, response.candidates.length)
    return response
  }

  // Discovery can return zero candidates for three distinct reasons that are
  // otherwise indistinguishable from outside the API: the model never searched
  // (searchResults=0), it searched but emitted no parseable JSON
  // (parsedCandidates=0), or it echoed URLs that don't match any search result
  // verbatim and got dropped by grounding (parsedCandidates>0 but grounded=0).
  // The zero-candidate path logs at warn so it surfaces at the default level.
  private logOutcome(
    request: DiscoverSourcesRequest,
    finalText: string,
    diagnostics: DiscoveryDiagnostics,
    candidateCount: number,
  ): void {
    const label = request.code ? `${request.name} (${request.code})` : request.name
    const summary =
      `cert discovery "${label}": searchResults=${diagnostics.searchResultCount} ` +
      `parsedCandidates=${diagnostics.parsedCandidateCount} ` +
      `grounded=${diagnostics.groundedCandidateCount} ` +
      `candidates=${candidateCount} finalTextLen=${diagnostics.finalTextLength}`

    if (candidateCount === 0) {
      this.logger.warn(
        `${summary} — no candidates; finalTextPreview=${JSON.stringify(finalText.slice(0, 300))}`,
      )
      return
    }
    this.logger.log(summary)
  }
}

function buildMessages(request: DiscoverSourcesRequest): ModelMessage[] {
  const label = request.code ? `${request.name} (${request.code})` : request.name
  return [
    {
      role: 'user',
      content: `Find authoritative sources describing the certification exam "${label}". Search the web first, then return the most relevant pages you actually found.`,
    },
  ]
}

function assembleResponse(
  finalText: string,
  searchResults: CertSearchResult[],
): { response: DiscoverSourcesResponse; diagnostics: DiscoveryDiagnostics } {
  const grounded = new Map(searchResults.map((searchResult) => [searchResult.url, searchResult]))
  const vendorDomains = deriveVendorDomains(searchResults)
  const parsed = parseModelOutput(finalText)

  const seen = new Set<string>()
  const groundedCandidates: DiscoveryCandidate[] = []
  for (const url of parsed.candidateUrls) {
    const match = grounded.get(url)
    if (match === undefined || seen.has(url)) {
      continue
    }
    seen.add(url)
    groundedCandidates.push(
      match.snippet === undefined
        ? { url, title: match.title }
        : { url, title: match.title, snippet: match.snippet },
    )
  }

  const candidates = rankDiscoveryCandidates(groundedCandidates, vendorDomains)
  const suggestedContentSources = parsed.suggested.filter((source) => grounded.has(source.url))

  const response: DiscoverSourcesResponse =
    suggestedContentSources.length > 0 ? { candidates, suggestedContentSources } : { candidates }

  return {
    response,
    diagnostics: {
      searchResultCount: searchResults.length,
      parsedCandidateCount: parsed.candidateUrls.length,
      groundedCandidateCount: groundedCandidates.length,
      finalTextLength: finalText.length,
    },
  }
}

function deriveVendorDomains(searchResults: CertSearchResult[]): string[] {
  const hosts = new Set<string>()
  for (const searchResult of searchResults) {
    if (searchResult.official !== true) {
      continue
    }
    const host = hostOf(searchResult.url)
    if (host !== null) {
      hosts.add(host)
    }
  }
  return [...hosts]
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

function parseModelOutput(text: string): {
  candidateUrls: string[]
  suggested: SuggestedContentSource[]
} {
  const json = extractJson(text)
  if (json === null) {
    return { candidateUrls: [], suggested: [] }
  }
  const parsed = modelOutputSchema.safeParse(json)
  if (!parsed.success) {
    return { candidateUrls: [], suggested: [] }
  }
  return {
    candidateUrls: (parsed.data.candidates ?? []).map((candidate) => candidate.url),
    suggested: parsed.data.suggestedContentSources ?? [],
  }
}

function extractJson(text: string): unknown {
  const unfenced = text.replace(/```(?:json)?/gi, '').trim()
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    return null
  }
  try {
    return JSON.parse(unfenced.slice(start, end + 1))
  } catch {
    return null
  }
}
