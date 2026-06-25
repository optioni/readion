export interface FetchedContent {
  text: string
  url: string
  metadata?: Record<string, unknown>
}

export interface FetchStrategy {
  fetch(url: string): Promise<FetchedContent[]>
}
