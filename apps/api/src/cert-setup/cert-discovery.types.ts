export const CERT_SEARCH_PORT = Symbol('CERT_SEARCH_PORT')

export interface CertSearchResult {
  url: string
  title: string
  snippet?: string
  // The search backend flags vendor/official pages; the service trusts this
  // provenance signal to rank vendor domains first rather than re-deriving the
  // vendor identity from the free-text certification name.
  official?: boolean
}

export interface CertSearchPort {
  search(query: string): Promise<CertSearchResult[]>
}
