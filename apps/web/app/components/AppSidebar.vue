<template>
  <aside
    data-testid="app-sidebar"
    class="min-h-screen w-52 flex-shrink-0 flex-col border-slate-700 border-r bg-readion-background-elevated px-4 py-6"
    :class="
      open
        ? 'flex fixed inset-y-0 left-0 z-40 lg:static lg:z-auto'
        : 'hidden lg:flex'
    "
  >
    <div class="mb-8 flex items-center gap-2 px-1.5">
      <div
        class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-indigo-500"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 1l1.5 3.5L11 5l-2.5 2.5.5 3.5L6 9.5 3 11l.5-3.5L1 5l3.5-.5z"
            fill="#0f172a"
          />
        </svg>
      </div>
      <span class="font-bold text-slate-100 text-sm tracking-tight">Readion</span>
      <div class="flex-1" />
      <button
        data-testid="sidebar-drawer-close"
        type="button"
        aria-label="Close navigation"
        class="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-200 lg:hidden"
        @click="emit('close')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="mb-1.5 px-1.5 text-[10px] text-slate-500 uppercase tracking-wider">Study</div>

    <nav aria-label="Primary" class="flex flex-col gap-0.5">
      <NuxtLink
        v-for="item in navItems"
        :key="item.testid"
        :to="item.to"
        :data-testid="item.testid"
        :data-active="item.active ? 'true' : 'false'"
        :aria-current="item.active ? 'page' : undefined"
        class="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors"
        :class="
          item.active
            ? 'bg-[rgba(29,78,216,0.15)] font-medium text-slate-100'
            : 'text-slate-400 hover:text-slate-200'
        "
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
      </NuxtLink>
    </nav>

    <div class="flex-1" />

    <NuxtLink
      v-if="isAdmin"
      to="/admin"
      data-testid="app-nav-admin"
      :data-active="isAdminActive ? 'true' : 'false'"
      :aria-current="isAdminActive ? 'page' : undefined"
      class="mb-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-slate-500 text-xs transition-colors hover:text-slate-300"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
      Admin panel
    </NuxtLink>

    <div
      data-testid="sidebar-user"
      class="flex flex-col gap-3 rounded-md border border-slate-700 p-2"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-readion-background-overlay"
        >
          <span class="font-semibold text-indigo-400 text-xs">{{ initials }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium text-slate-100 text-xs">{{ displayName }}</div>
        </div>
      </div>
      <div class="flex items-center justify-between gap-2">
        <ColorModeToggle />
        <button
          data-testid="logout-btn"
          type="button"
          class="text-slate-400 text-sm transition-colors hover:text-slate-200"
          @click="handleLogout"
        >
          Log out
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getCsrfTokenFromCookie } from '~/api/mutator'
import ColorModeToggle from '~/components/ColorModeToggle.vue'
import { emailInitials } from '~/composables/emailInitials'
import { useEnrollments } from '~/composables/useEnrollments'
import { useTrack } from '~/composables/useTrack'
import { useAuthStore } from '~/stores/auth'

interface NavItem {
  label: string
  to: string
  testid: string
  icon: string
  active: boolean
}

withDefaults(defineProps<{ open?: boolean }>(), { open: false })
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const { track } = useTrack()
const runtimeConfig = useRuntimeConfig()
const apiBase = (runtimeConfig.public.apiBaseUrl as string).replace(/\/$/, '')

const { cards } = useEnrollments()

const isAdmin = computed(() => auth.user?.role === 'admin')
const isAdminActive = computed(() => route.path.startsWith('/admin'))

const email = computed(() => auth.user?.email ?? '')
const initials = computed(() => (email.value ? emailInitials(email.value) : ''))
const displayName = computed(() => {
  const value = email.value
  const atIndex = value.indexOf('@')
  return atIndex === -1 ? value : value.slice(0, atIndex)
})

// Cert-scoped destinations resolve from the first active enrollment; Sessions points at the cert
// detail (the closest existing "sessions home"). Both fall back to / when nothing is enrolled.
const enrollmentId = computed(() => cards.value[0]?.enrollmentId)
const sessionsTo = computed(() =>
  enrollmentId.value ? `/user-certifications/${enrollmentId.value}` : '/',
)
const progressTo = computed(() =>
  enrollmentId.value ? `/user-certifications/${enrollmentId.value}/progress` : '/',
)

const ICONS = {
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  sessions: 'M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z',
  progress: 'M18 20V10M12 20V4M6 20v-6',
  agent: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  settings:
    'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
} as const

const navItems = computed<NavItem[]>(() => {
  const path = route.path
  return [
    {
      label: 'Dashboard',
      to: '/',
      testid: 'app-nav-dashboard',
      icon: ICONS.dashboard,
      active: path === '/',
    },
    {
      label: 'Sessions',
      to: sessionsTo.value,
      testid: 'app-nav-sessions',
      icon: ICONS.sessions,
      active:
        (path.startsWith('/user-certifications/') && !path.endsWith('/progress')) ||
        path.startsWith('/sessions/'),
    },
    {
      label: 'Progress',
      to: progressTo.value,
      testid: 'app-nav-progress',
      icon: ICONS.progress,
      active: path.endsWith('/progress'),
    },
    {
      label: 'Ask AI',
      to: '/agent',
      testid: 'app-nav-agent',
      icon: ICONS.agent,
      active: path.startsWith('/agent'),
    },
    {
      label: 'Settings',
      to: '/settings',
      testid: 'app-nav-settings',
      icon: ICONS.settings,
      active: path === '/settings',
    },
  ]
})

async function handleLogout() {
  try {
    const csrfToken = getCsrfTokenFromCookie()
    await fetch(`${apiBase}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      ...(csrfToken ? { headers: { 'x-csrf-token': csrfToken } } : {}),
    })
  } catch {
    // Best-effort — always clear local state
  } finally {
    track('log_out')
    auth.clear()
    router.push('/login')
  }
}
</script>
