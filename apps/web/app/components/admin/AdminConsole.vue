<script lang="ts">
// Shared admin shell. Downstream section pages wrap their content in <AdminConsole>…</AdminConsole>,
// mirroring the SettingsLayout precedent (a wrapping component, not a Nuxt layout), so the sidebar
// chrome and active-section highlight live in one place.
interface AdminNavItem {
  id: string
  label: string
  to: string
  external?: boolean
}

const NAV_ITEMS: readonly AdminNavItem[] = [
  { id: 'certifications', label: 'Certifications', to: '/admin/certifications' },
  { id: 'review-queue', label: 'Review queue', to: '/admin/review-queue' },
  { id: 'sources', label: 'Sources', to: '/admin/sources' },
  { id: 'users', label: 'Users', to: '/admin/users' },
  { id: 'audit-log', label: 'Audit Log', to: '/admin/audit-logs' },
  { id: 'settings', label: 'Settings', to: '/settings', external: true },
]

const DEFAULT_SECTION = '/admin/certifications'
</script>

<script setup lang="ts">
import { computed } from 'vue'

const route = useRoute()

// The bare /admin index renders the Certifications landing, so it shares that section's highlight.
const activePath = computed(() => (route.path === '/admin' ? DEFAULT_SECTION : route.path))

function isActive(item: AdminNavItem): boolean {
  if (item.external) return activePath.value === item.to
  return activePath.value === item.to || activePath.value.startsWith(`${item.to}/`)
}
</script>

<template>
  <section
    data-testid="admin-console"
    class="mx-auto flex w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8"
  >
    <aside data-testid="admin-sidebar" class="w-56 shrink-0">
      <nav class="flex flex-col gap-1">
        <template v-for="item in NAV_ITEMS" :key="item.id">
          <a
            v-if="item.external"
            :href="item.to"
            :data-testid="`admin-nav-${item.id}`"
            :data-active="isActive(item) ? 'true' : 'false'"
            class="rounded-md px-3 py-2 font-medium text-sm transition-colors"
            :class="
              isActive(item)
                ? 'bg-readion-background-overlay text-white'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            {{ item.label }}
          </a>
          <NuxtLink
            v-else
            :to="item.to"
            :data-testid="`admin-nav-${item.id}`"
            :data-active="isActive(item) ? 'true' : 'false'"
            class="rounded-md px-3 py-2 font-medium text-sm transition-colors"
            :class="
              isActive(item)
                ? 'bg-readion-background-overlay text-white'
                : 'text-slate-400 hover:text-slate-200'
            "
          >
            {{ item.label }}
          </NuxtLink>
        </template>
      </nav>
    </aside>

    <div class="min-w-0 flex-1">
      <slot />
    </div>
  </section>
</template>
