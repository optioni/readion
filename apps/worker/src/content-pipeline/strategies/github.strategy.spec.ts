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

  it('returns empty array when a URL has no repository path', async () => {
    const results = await strategy.fetch('https://example.com/not-github')
    expect(results).toHaveLength(0)
  })

  it('returns empty array when the URL is malformed', async () => {
    const results = await strategy.fetch('not a URL')
    expect(results).toHaveLength(0)
  })

  it('returns empty array when GitHub omits search items', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      }),
    )

    const results = await strategy.fetch('https://github.com/aws/aws-cdk')
    expect(results).toHaveLength(0)
  })

  it('skips files without download URLs and raw downloads that fail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              { path: 'missing.md', name: 'missing.md', download_url: null },
              {
                path: 'failed.md',
                name: 'failed.md',
                download_url: 'https://raw.githubusercontent.com/aws/aws-cdk/main/failed.md',
              },
            ],
          }),
      })
      .mockResolvedValueOnce({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    const results = await strategy.fetch('https://github.com/aws/aws-cdk')
    expect(results).toHaveLength(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
