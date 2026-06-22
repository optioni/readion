export class ScrapperError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number | undefined,
    public readonly cause?: unknown,
  ) {
    super(`Scrapper request failed for ${url}: ${status ?? 'unknown'}`)
    this.name = 'ScrapperError'
  }
}
