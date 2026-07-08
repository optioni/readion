<script setup lang="ts">
import { ref } from 'vue'
import SettingsTabs, { type SettingsTabId } from '~/components/SettingsTabs.vue'

const active = ref<SettingsTabId>('account')

function select(id: SettingsTabId) {
  active.value = id
}
</script>

<template>
  <section data-testid="settings-page" class="-mx-4 sm:-mx-6 lg:-mx-8">
    <SettingsTabs :active="active" @select="select" />

    <div class="w-full max-w-[580px] px-4 py-8 sm:px-6 lg:px-8">
      <div v-show="active === 'account'" data-testid="account-panel" role="tabpanel">
        <slot name="account" />
      </div>
      <div
        v-show="active === 'study-defaults'"
        data-testid="study-defaults-panel"
        role="tabpanel"
      >
        <slot name="study-defaults" />
      </div>
      <div
        v-show="active === 'notifications'"
        data-testid="notifications-panel"
        role="tabpanel"
      >
        <slot name="notifications" />
      </div>
    </div>
  </section>
</template>
