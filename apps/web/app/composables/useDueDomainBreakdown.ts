import type { ReviewItemResponse } from '@readion/shared'

export interface DueDomainCount {
  domain: string
  count: number
}

export function useDueDomainBreakdown(items: ReviewItemResponse[]): DueDomainCount[] {
  const countMap = new Map<string, number>()
  for (const item of items) {
    countMap.set(item.domain, (countMap.get(item.domain) ?? 0) + 1)
  }

  return Array.from(countMap.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return a.domain < b.domain ? -1 : a.domain > b.domain ? 1 : 0
    })
}
