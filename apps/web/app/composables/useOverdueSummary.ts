import type { ReviewItemResponse } from '@readion/shared'

const DAY_MS = 24 * 60 * 60 * 1000

export interface OverdueSummary {
  count: number
  days: number
}

export function useOverdueSummary(items: ReviewItemResponse[], now: Date): OverdueSummary | null {
  let count = 0
  let maxDays = 0

  for (const item of items) {
    const overdueDays = Math.floor((now.getTime() - new Date(item.dueAt).getTime()) / DAY_MS)
    if (overdueDays >= 1) {
      count += 1
      maxDays = Math.max(maxDays, overdueDays)
    }
  }

  return count === 0 ? null : { count, days: maxDays }
}

export function formatOverdueSummary(summary: OverdueSummary): string {
  const itemWord = summary.count === 1 ? 'item' : 'items'
  const dayWord = summary.days === 1 ? 'day' : 'days'
  return `${summary.count} ${itemWord} overdue by ${summary.days} ${dayWord}`
}
