<script setup lang="ts">
import { ref } from 'vue'
import SettingsTabs, { type SettingsTabId } from '~/components/SettingsTabs.vue'

const active = ref<SettingsTabId>('account')
const visited = ref<ReadonlySet<SettingsTabId>>(new Set<SettingsTabId>(['account']))

function select(id: SettingsTabId) {
  visited.value = new Set([...visited.value, id])
  active.value = id
}

function hasVisited(id: SettingsTabId) {
  return visited.value.has(id)
}
</script>

<template>
  <section
    data-testid="settings-page"
    class="-mx-4 w-full max-w-full min-w-0 sm:-mx-6 lg:-mx-8"
  >
    <SettingsTabs :active="active" @select="select" />

    <div
      data-testid="settings-content-column"
      class="w-full max-w-full max-w-[580px] min-w-0 px-4 py-8 sm:px-6 lg:px-8"
    >
      <div v-show="active === 'account'" data-testid="account-panel" role="tabpanel">
        <slot v-if="hasVisited('account')" name="account" />
      </div>
      <div
        v-show="active === 'study-defaults'"
        data-testid="study-defaults-panel"
        role="tabpanel"
      >
        <slot v-if="hasVisited('study-defaults')" name="study-defaults" />
      </div>
      <div
        v-show="active === 'notifications'"
        data-testid="notifications-panel"
        role="tabpanel"
      >
        <slot v-if="hasVisited('notifications')" name="notifications" />
      </div>
    </div>
  </section>
</template>
