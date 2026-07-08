import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  contentSourceTypes,
  type DiscoverSourcesRequest,
  type DiscoverSourcesResponse,
  type DiscoveryCandidate,
  rankDiscoveryCandidates,
  type SuggestedContentSource,
} from '@readion/shared'
import { NoObjectGeneratedError, stepCountIs, type ToolSet, tool } from 'ai'
import { z } from 'zod'
import { LlmService } from '../llm/llm.service'
import {
  CERT_SEARCH_PORT,
  type CertSearchPort,
  type CertSearchResult,
} from './cert-discovery.types'

const CERT_DISCOVERY_MAX_STEPS = 4

const SEARCH_SYSTEM_PROMPT =
  'You research certification exams. Use the webSearch tool to find authoritative pages describing the exam. Search thoroughly, issuing multiple queries if it helps surface official sources.'

const SELECT_SYSTEM_PROMPT =
  'You select the most authoritative, relevant sources for a certification exam from a catalog of search results. Choose only URLs that appear in the catalog — never invent one. Prefer official vendor pages, and classify any reusable content sources by type.'

const modelOutputSchema = z.object({
  candidates: z.array(z.object({ url: z.string() })).optional(),
  suggestedContentSources: z
    .array(z.object({ url: z.string(), type: z.enum(contentSourceTypes) }))
    .optional(),
})

type CandidateSelection = {
  candidateUrls: string[]
  suggested: SuggestedContentSource[]
}

interface DiscoveryDiagnostics {
  searchResultCount: number
  selectedCandidateCount: number
  groundedCandidateCount: number
}

@Injectable()
export class CertDiscoveryService {
  private readonly logger = new Logger(CertDiscoveryService.name)

  constructor(
    private readonly llm: LlmService,
    @Inject(CERT_SEARCH_PORT) private readonly search: CertSearchPort,
  ) {}

  async discoverSources(request: DiscoverSourcesRequest): Promise<DiscoverSourcesResponse> {
    const searchResults = await this.gatherSearchResults(request)
    const selection = await this.selectCandidates(request, searchResults)

    const { response, diagnostics } = assembleResponse(selection, searchResults)
    this.logOutcome(request, diagnostics, response.candidates.length)
    return response
  }

  // Phase 1: let the model drive web search through the tool, accumulating the
  // grounded pool. The model's free-text output is intentionally ignored — only
  // the tool results (real URLs) are trusted downstream.
  private async gatherSearchResults(request: DiscoverSourcesRequest): Promise<CertSearchResult[]> {
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
      system: SEARCH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Find authoritative sources describing the certification exam "${labelFor(request)}". Search the web thoroughly.`,
        },
      ],
      tools,
      stopWhen: stepCountIs(CERT_DISCOVERY_MAX_STEPS),
    })
    await result.text

    return searchResults
  }

  // Phase 2: structured selection from the grounded pool. Using a schema-bound
  // object output removes the fragile free-text JSON parsing that previously
  // dropped every candidate when the model wrapped its answer in a code fence.
  private async selectCandidates(
    request: DiscoverSourcesRequest,
    searchResults: CertSearchResult[],
  ): Promise<CandidateSelection> {
    if (searchResults.length === 0) {
      return { candidateUrls: [], suggested: [] }
    }

    const catalog = searchResults
      .map((result, index) => {
        const title = result.title ? ` — ${result.title}` : ''
        const snippet = result.snippet ? `\n   ${result.snippet}` : ''
        return `${index + 1}. ${result.url}${title}${snippet}`
      })
      .join('\n')

    try {
      const { object } = await this.llm.generateObject({
        taskType: 'certification-prefill',
        system: SELECT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Certification exam: "${labelFor(request)}".\n\nSearch results catalog:\n${catalog}\n\nSelect the most relevant candidate pages and any reusable content sources, using only URLs from the catalog.`,
          },
        ],
        schema: modelOutputSchema,
      })
      return {
        candidateUrls: (object.candidates ?? []).map((candidate) => candidate.url),
        suggested: object.suggestedContentSources ?? [],
      }
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) {
        throw error
      }
      this.logger.warn(`cert discovery selection produced no object: error=${error.message}`)
      return { candidateUrls: [], suggested: [] }
    }
  }

  // A zero-candidate result is otherwise indistinguishable from success outside
  // the API. The per-stage counts localize the cause: searchResults=0 (no
  // search), selected=0 (model selected nothing), or grounded=0 (selected URLs
  // absent from the pool). Logged at warn so it surfaces at the default level.
  private logOutcome(
    request: DiscoverSourcesRequest,
    diagnostics: DiscoveryDiagnostics,
    candidateCount: number,
  ): void {
    const summary =
      `cert discovery "${labelFor(request)}": searchResults=${diagnostics.searchResultCount} ` +
      `selected=${diagnostics.selectedCandidateCount} ` +
      `grounded=${diagnostics.groundedCandidateCount} candidates=${candidateCount}`

    if (candidateCount === 0) {
      this.logger.warn(`${summary} — no candidates`)
      return
    }
    this.logger.log(summary)
  }
}

function labelFor(request: DiscoverSourcesRequest): string {
  return request.code ? `${request.name} (${request.code})` : request.name
}

function assembleResponse(
  selection: CandidateSelection,
  searchResults: CertSearchResult[],
): { response: DiscoverSourcesResponse; diagnostics: DiscoveryDiagnostics } {
  const grounded = new Map(searchResults.map((searchResult) => [searchResult.url, searchResult]))
  const vendorDomains = deriveVendorDomains(searchResults)

  const seen = new Set<string>()
  const groundedCandidates: DiscoveryCandidate[] = []
  for (const url of selection.candidateUrls) {
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
  const suggestedContentSources = selection.suggested.filter((source) => grounded.has(source.url))

  const response: DiscoverSourcesResponse =
    suggestedContentSources.length > 0 ? { candidates, suggestedContentSources } : { candidates }

  return {
    response,
    diagnostics: {
      searchResultCount: searchResults.length,
      selectedCandidateCount: selection.candidateUrls.length,
      groundedCandidateCount: groundedCandidates.length,
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
