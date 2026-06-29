<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { computed, ref } from 'vue'
import { ReadionProblemDetailsError } from '~/api/mutator'
import { adminQueryKeys } from '~/composables/adminQueryKeys'
import { useAdminUsers } from '~/composables/useAdminUsers'
import { adminControllerDemote, adminControllerPromote } from '~~/src/api/admin/admin'

const jsonHeaders = { 'Content-Type': 'application/json' }

const queryClient = useQueryClient()
const usersQuery = useAdminUsers()

const users = computed(() => usersQuery.data.value?.data ?? [])
const isLoading = computed(() => usersQuery.isLoading.value)
const isError = computed(() => usersQuery.isError.value)

const demoteError = ref<string | null>(null)

function initials(email: string): string {
  const localPart = email.split('@')[0] ?? ''
  const letters = localPart.replace(/[^a-zA-Z]/g, '').slice(0, 2)
  return (letters || email.slice(0, 2)).toUpperCase()
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatJoinDate(createdAt: string): string {
  return dateFormatter.format(new Date(createdAt))
}

async function promote(id: string) {
  await adminControllerPromote(id, { headers: jsonHeaders })
  await queryClient.invalidateQueries({ queryKey: adminQueryKeys.users() })
}

async function demote(id: string) {
  demoteError.value = null
  try {
    await adminControllerDemote(id, { headers: jsonHeaders })
    await queryClient.invalidateQueries({ queryKey: adminQueryKeys.users() })
  } catch (error) {
    if (error instanceof ReadionProblemDetailsError && error.status === 409) {
      demoteError.value = error.detail ?? error.title
    }
  }
}
</script>

<template>
  <section data-testid="admin-users-page" class="flex flex-col gap-6">
    <h1 class="font-semibold text-lg text-white">Users</h1>

    <p v-if="isLoading" data-testid="admin-users-loading" class="text-slate-400 text-sm">
      Loading users…
    </p>
    <p v-else-if="isError" data-testid="admin-users-error" class="text-red-400 text-sm">
      Could not load users. Please try again.
    </p>

    <template v-else>
      <p v-if="demoteError" data-testid="demote-error" class="text-red-400 text-sm">
        {{ demoteError }}
      </p>

      <table class="w-full border-collapse text-left text-sm">
        <thead>
          <tr class="border-readion-background-surface border-b text-slate-400">
            <th class="px-3 py-2 font-medium">User</th>
            <th class="px-3 py-2 font-medium">Role</th>
            <th class="px-3 py-2 font-medium">Joined</th>
            <th class="px-3 py-2 font-medium">Enrollments</th>
            <th class="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.id"
            data-testid="admin-user-row"
            :data-user-id="user.id"
            class="border-readion-background-surface/60 border-b"
          >
            <td class="px-3 py-3">
              <div class="flex items-center gap-3">
                <span
                  data-testid="user-avatar"
                  class="flex size-9 items-center justify-center rounded-full bg-readion-primary font-medium text-white text-xs"
                >
                  {{ initials(user.email) }}
                </span>
                <span data-testid="user-email" class="text-slate-100">{{ user.email }}</span>
              </div>
            </td>
            <td class="px-3 py-3">
              <span
                data-testid="user-role"
                class="rounded-full px-2.5 py-1 font-medium text-xs"
                :class="
                  user.role === 'admin'
                    ? 'bg-readion-primary/15 text-readion-primary'
                    : 'bg-readion-background-overlay text-slate-300'
                "
              >
                {{ user.role }}
              </span>
            </td>
            <td data-testid="user-joined" class="px-3 py-3 text-slate-300">
              {{ formatJoinDate(user.createdAt) }}
            </td>
            <td data-testid="user-enrollments" class="px-3 py-3 text-slate-300">
              {{ user.enrollmentCount }}
            </td>
            <td class="px-3 py-3">
              <div class="flex gap-2">
                <button
                  type="button"
                  data-testid="promote-user-btn"
                  class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-slate-100 text-xs transition-colors hover:bg-readion-background-surface"
                  @click="promote(user.id)"
                >
                  Promote
                </button>
                <button
                  type="button"
                  data-testid="demote-user-btn"
                  class="rounded-md border border-readion-background-surface px-3 py-1.5 font-medium text-slate-100 text-xs transition-colors hover:bg-readion-background-surface"
                  @click="demote(user.id)"
                >
                  Demote
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>
