<script setup lang="ts">
import { computed, provide } from 'vue'
import AccountTab from '~/components/AccountTab.vue'
import NotificationsTab from '~/components/NotificationsTab.vue'
import ReadionAsyncRegion from '~/components/ReadionAsyncRegion.vue'
import SettingsLayout from '~/components/SettingsLayout.vue'
import StudyDefaultsTab from '~/components/StudyDefaultsTab.vue'
import { settingsProfileInjectionKey, useSettingsProfile } from '~/composables/useSettingsProfile'

const profileQuery = useSettingsProfile()
provide(settingsProfileInjectionKey, profileQuery)
const hasProfile = computed(() => profileQuery.data.value !== undefined)
const initialLoading = computed(() => profileQuery.isLoading.value && !hasProfile.value)
const initialError = computed(() =>
  profileQuery.isError.value && !hasProfile.value ? 'Couldn’t load your settings.' : undefined,
)
const refreshing = computed(
  () => profileQuery.isFetching.value && hasProfile.value && !profileQuery.isLoading.value,
)
</script>

<template>
  <div
    data-testid="settings-content-region"
    :aria-busy="initialLoading || refreshing ? 'true' : undefined"
  >
    <ReadionAsyncRegion
      :loading="initialLoading"
      :error="initialError"
      :refreshing="refreshing"
      :retrying="profileQuery.isFetching.value && Boolean(initialError)"
      loading-label="Loading settings…"
      refresh-label="Refreshing settings…"
      aria-label="Settings"
      @retry="profileQuery.refetch"
    >
      <template #loading>
        <div
          class="h-80 w-full max-w-[580px] animate-pulse rounded-xl bg-readion-background-surface motion-reduce:animate-none"
          aria-hidden="true"
        />
      </template>

      <SettingsLayout>
        <template #account>
          <AccountTab />
        </template>
        <template #study-defaults>
          <StudyDefaultsTab />
        </template>
        <template #notifications>
          <NotificationsTab />
        </template>
      </SettingsLayout>
    </ReadionAsyncRegion>
  </div>
</template>
