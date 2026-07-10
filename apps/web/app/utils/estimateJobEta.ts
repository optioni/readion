// Derives a rough "N min remaining" estimate for an in-flight ingestion job purely from the
// existing `progress` (0-100) and `processedOn` (epoch ms the job started processing) fields —
// no new API data. Linear-rate extrapolation: elapsed / (progress / 100) = total estimate.
export function estimateRemainingMinutes(
  job: { progress: number; processedOn: number | null },
  now: number = Date.now(),
): number | null {
  if (job.processedOn === null || job.progress <= 0 || job.progress >= 100) {
    return null
  }
  const elapsedMs = now - job.processedOn
  if (elapsedMs <= 0) {
    return null
  }
  const totalEstimateMs = elapsedMs / (job.progress / 100)
  const remainingMs = totalEstimateMs - elapsedMs
  return Math.max(1, Math.round(remainingMs / 60_000))
}
