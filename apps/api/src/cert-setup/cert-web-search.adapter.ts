import { Injectable } from '@nestjs/common'
import type { CertSearchPort, CertSearchResult } from './cert-discovery.types'

// Placeholder web-search backend so the module boots with CERT_SEARCH_PORT bound.
// There is no real web-search provider wired into this repo yet; grounding against
// a live search index is a deliberate follow-up. Returning no results keeps
// discovery deterministic (it surfaces nothing rather than hallucinating URLs),
// and tests override this port with a fake that returns ranked vendor pages.
@Injectable()
export class CertWebSearchAdapter implements CertSearchPort {
  async search(_query: string): Promise<CertSearchResult[]> {
    return []
  }
}
