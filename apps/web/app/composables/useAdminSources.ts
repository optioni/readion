import type { IngestionJobStatus } from '@readion/shared'
import { useQuery } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { readContentSourcesEnvelope, readSourceJobsEnvelope } from '~/composables/adminEnvelope'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { contentControllerList, contentControllerListJobs } from '~~/src/api/content/content'

export function useAdminSources(certId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => adminQueryKeys.contentSources(toValue(certId))),
    queryFn: async () =>
      readContentSourcesEnvelope(await contentControllerList({ certificationId: toValue(certId) })),
    enabled: computed(() => Boolean(toValue(certId))),
  })
}

export function useSourceJobs(
  certId: MaybeRefOrGetter<string>,
  sources: MaybeRefOrGetter<{ id: string }[]>,
) {
  return useQuery({
    queryKey: computed(() => adminQueryKeys.sourceJobs(toValue(certId))),
    queryFn: async () => {
      const entries = await Promise.all(
        toValue(sources).map(
          async (source) =>
            [
              source.id,
              readSourceJobsEnvelope(await contentControllerListJobs(source.id)),
            ] as const,
        ),
      )
      return Object.fromEntries(entries) as Record<string, IngestionJobStatus[]>
    },
    enabled: computed(() => Boolean(toValue(certId)) && toValue(sources).length > 0),
    refetchInterval: 3000,
  })
}
