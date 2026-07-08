<script lang="ts">
// Shared admin shell. Downstream section pages wrap their content in <AdminConsole>…</AdminConsole>,
// mirroring the SettingsLayout precedent (a wrapping component, not a Nuxt layout), so the sidebar
// chrome and active-section highlight live in one place.
interface AdminNavItem {
  id: string
  label: string
  to: string
  icon: string
  external?: boolean
}

// Leading-icon path data, following the AppSidebar ICONS convention (rendered inside a shared
// 24x24 stroke svg per nav item).
const ICONS = {
  certifications: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z',
  'review-queue': 'M9 11l3 3 6-6M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  sources: 'M4 6a2 2 0 012-2h9l5 5v9a2 2 0 01-2 2H6a2 2 0 01-2-2z M15 4v5h5',
  users:
    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
  'audit-log': 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
} as const

const NAV_ITEMS: readonly AdminNavItem[] = [
  {
    id: 'certifications',
    label: 'Certifications',
    to: '/admin/certifications',
    icon: ICONS.certifications,
  },
  {
    id: 'review-queue',
    label: 'Review queue',
    to: '/admin/review-queue',
    icon: ICONS['review-queue'],
  },
  { id: 'sources', label: 'Sources', to: '/admin/sources', icon: ICONS.sources },
  { id: 'users', label: 'Users', to: '/admin/users', icon: ICONS.users },
  { id: 'audit-log', label: 'Audit Log', to: '/admin/audit-logs', icon: ICONS['audit-log'] },
  {
    id: 'settings',
    label: 'Settings',
    to: '/settings',
    icon: ICONS.settings,
    external: true,
  },
]

const DEFAULT_SECTION = '/admin/certifications'
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useAdminQuarantine } from '~/composables/useAdminQuarantine'
import { useAuthStore } from '~/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { data: quarantine } = useAdminQuarantine()

// The bare /admin index renders the Certifications landing, so it shares that section's highlight.
const activePath = computed(() => (route.path === '/admin' ? DEFAULT_SECTION : route.path))

function isActive(item: AdminNavItem): boolean {
  if (item.external) return activePath.value === item.to
  return activePath.value === item.to || activePath.value.startsWith(`${item.to}/`)
}

function navItemClass(item: AdminNavItem): string {
  return isActive(item)
    ? 'bg-readion-background-overlay text-white'
    : 'text-slate-400 hover:text-slate-200'
}

const pendingReviewCount = computed(
  () => quarantine.value?.meta.total ?? quarantine.value?.data.length ?? 0,
)
const adminEmail = computed(() => auth.user?.email ?? '')
</script>

<template>
  <section
    data-testid="admin-console"
    class="mx-auto flex w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8"
  >
    <aside data-testid="admin-sidebar" class="flex w-56 shrink-0 flex-col gap-6">
      <div>
        <span
          data-testid="admin-sidebar-eyebrow"
          class="font-semibold text-[11px] text-readion-primary tracking-[0.2em]"
        >
          ADMIN
        </span>
      </div>

      <nav class="flex flex-col gap-1">
        <template v-for="item in NAV_ITEMS" :key="item.id">
          <a
            v-if="item.external"
            :href="item.to"
            :data-testid="`admin-nav-${item.id}`"
            :data-active="isActive(item) ? 'true' : 'false'"
            class="flex items-center gap-2.5 rounded-md px-3 py-2 font-medium text-sm transition-colors"
            :class="navItemClass(item)"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="item.icon" />
            </svg>
            {{ item.label }}
          </a>
          <NuxtLink
            v-else
            :to="item.to"
            :data-testid="`admin-nav-${item.id}`"
            :data-active="isActive(item) ? 'true' : 'false'"
            class="flex items-center gap-2.5 rounded-md px-3 py-2 font-medium text-sm transition-colors"
            :class="navItemClass(item)"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path :d="item.icon" />
            </svg>
            <span class="flex-1">{{ item.label }}</span>
            <span
              v-if="item.id === 'review-queue' && pendingReviewCount > 0"
              data-testid="admin-nav-review-queue-badge"
              class="rounded-full bg-readion-primary px-1.5 py-0.5 font-semibold text-[11px] text-white"
            >
              {{ pendingReviewCount }}
            </span>
          </NuxtLink>
        </template>
      </nav>

      <div class="flex-1" />

      <div
        data-testid="admin-session-card"
        class="flex flex-col gap-1 rounded-md border border-slate-700 p-3"
      >
        <span class="text-[10px] text-slate-500 uppercase tracking-wider">Admin session</span>
        <span class="truncate font-medium text-slate-100 text-xs">{{ adminEmail }}</span>
      </div>
    </aside>

    <div class="min-w-0 flex-1">
      <slot />
    </div>
  </section>
</template>
