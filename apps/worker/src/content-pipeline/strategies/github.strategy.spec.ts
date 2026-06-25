import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GitHubFetchStrategy } from './github.strategy'

describe('GitHubFetchStrategy', () => {
  let strategy: GitHubFetchStrategy

  beforeEach(() => {
    strategy = new GitHubFetchStrategy()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('discovers markdown files and fetches raw content', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                path: 'README.md',
                name: 'README.md',
                download_url: 'https://raw.githubusercontent.com/aws/aws-cdk/main/README.md',
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('# AWS CDK\n\nContent about cloud infrastructure.'),
      })

    const results = await strategy.fetch('https://github.com/aws/aws-cdk')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.text).toContain('AWS CDK')
  })

  it('returns empty array when GitHub API returns non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const results = await strategy.fetch('https://github.com/aws/aws-cdk')
    expect(results).toHaveLength(0)
  })

  it('returns empty array for non-GitHub URLs', async () => {
    const results = await strategy.fetch('https://example.com/not-github')
    expect(results).toHaveLength(0)
  })
})
