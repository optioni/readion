import type { EntityManager } from '@mikro-orm/core'
import type { DomainStat } from '@readion/shared'

export interface CoverageStats {
  domains: DomainStat[]
  totalChunks: number
}

type DomainRow = {
  name: string
  chunk_count: string
  enabled_source_count: string
}

type TotalRow = {
  total_chunks: string
}

export async function queryCoverageStats(
  em: EntityManager,
  certificationId: string,
): Promise<CoverageStats> {
  const conn = em.getConnection()

  const [domainRows, totalRows] = await Promise.all([
    conn.execute<DomainRow[]>(
      `
      SELECT
        tag->>'domain' AS name,
        COUNT(DISTINCT cc.id)::int AS chunk_count,
        COUNT(DISTINCT CASE WHEN cs.enabled = true THEN cs.id ELSE NULL END)::int AS enabled_source_count
      FROM content_chunks cc
      JOIN content_sources cs ON cs.id = cc.content_source_id
      CROSS JOIN LATERAL jsonb_array_elements(cc.domain_tags) AS tag
      WHERE cc.certification_id = ?
        AND cc.state = 'active'
      GROUP BY tag->>'domain'
      `,
      [certificationId],
    ),
    conn.execute<TotalRow[]>(
      `
      SELECT COUNT(*)::int AS total_chunks
      FROM content_chunks
      WHERE certification_id = ?
        AND state = 'active'
      `,
      [certificationId],
    ),
  ])

  return {
    domains: domainRows.map((row: DomainRow) => ({
      name: row.name,
      chunkCount: Number(row.chunk_count),
      enabledSourceCount: Number(row.enabled_source_count),
    })),
    totalChunks: Number(totalRows[0]?.total_chunks ?? 0),
  }
}
