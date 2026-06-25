import { Injectable } from '@nestjs/common'
import { extractDomain, throttleForDomain, USER_AGENT } from './fetch-etiquette'
import type { FetchedContent, FetchStrategy } from './fetch-strategy.interface'

interface GitHubSearchItem {
  path: string
  name: string
  download_url: string | null
}

@Injectable()
export class GitHubFetchStrategy implements FetchStrategy {
  async fetch(url: string): Promise<FetchedContent[]> {
    const repoPath = this.extractRepoPath(url)
    if (!repoPath) return []

    const files = await this.discoverMarkdownFiles(repoPath)
    const results: FetchedContent[] = []

    for (const file of files) {
      if (!file.download_url) continue
      const content = await this.fetchRawMarkdown(file.download_url)
      if (content) results.push({ text: content, url: file.download_url })
    }

    return results
  }

  private extractRepoPath(url: string): string | null {
    try {
      const u = new URL(url)
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`
    } catch {
      // ignore
    }
    return null
  }

  private async discoverMarkdownFiles(repoPath: string): Promise<GitHubSearchItem[]> {
    const apiUrl = `https://api.github.com/search/code?q=extension:md+repo:${repoPath}`
    await throttleForDomain(extractDomain(apiUrl))
    const response = await globalThis.fetch(apiUrl, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github.v3+json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return []
    const data = (await response.json()) as { items: GitHubSearchItem[] }
    return (data.items ?? []).slice(0, 20)
  }

  private async fetchRawMarkdown(downloadUrl: string): Promise<string | null> {
    await throttleForDomain(extractDomain(downloadUrl))
    const response = await globalThis.fetch(downloadUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) return null
    return response.text()
  }
}
