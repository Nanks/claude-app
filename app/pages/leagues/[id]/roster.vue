<script setup lang="ts">
// pages/leagues/[id]/roster.vue

const route    = useRoute()
const leagueId = route.params.id as string

const { data, refresh } = await useFetch(`/api/leagues/${leagueId}/roster`, {
  dedupe: 'defer',
})

const isManageMode   = ref(false)
const showAuditModal = ref(false)
const selectedPlayer = ref<any>(null)

// Recalculate state
const isRecalculating    = ref(false)
const recalcProgress     = ref<{ completed: number; total: number } | null>(null)
const recalcError        = ref<string | null>(null)
const toast              = useToast()

const roster        = computed(() => data.value?.roster ?? [])
const access        = computed(() => data.value?.access ?? { isAdmin: false, myPlayerId: null })
const isAppHandicap = computed(() => data.value?.leagueConfig?.app_handicap ?? false)
const leagueTeeType = computed(() => data.value?.leagueConfig?.tee_type ?? 'mixed')

const getTeeColorClass = (tee: string) => {
  const map: Record<string, string> = {
    mens:   'text-blue-700 dark:text-blue-400',
    senior: 'text-amber-700 dark:text-amber-400',
    ladies: 'text-rose-700 dark:text-rose-400',
  }
  return map[tee?.toLowerCase()] ?? 'text-stone-600 dark:text-stone-400'
}

const formatHandicap = (hcp: number | string | null) => {
  if (hcp === null || hcp === undefined) return '—'
  const val = Number(hcp)
  if (isNaN(val)) return '—'
  return isAppHandicap.value ? val.toFixed(3) : Math.round(val).toString()
}

function handleAuditClick(member: any) {
  if (isAppHandicap.value) {
    selectedPlayer.value = member
    showAuditModal.value = true
  }
}

async function recalculateHandicaps() {
  recalcError.value    = null
  recalcProgress.value = null
  isRecalculating.value = true

  try {
    const result = await $fetch<{ completed: number; total: number }>(
      `/api/leagues/${leagueId}/recalculate`,
      { method: 'POST' }
    )
    recalcProgress.value = result
    toast.add({
      title:       'Handicaps recalculated',
      description: `Updated ${result.completed} of ${result.total} players`,
      color:       'success',
      duration:    3000,
    })
    await refresh()
  } catch (err: any) {
    recalcError.value = err.data?.statusMessage || 'Recalculation failed'
    toast.add({
      title:       'Recalculation failed',
      description: recalcError.value ?? undefined,
      color:       'error',
      duration:    4000,
    })
  } finally {
    isRecalculating.value = false
  }
}
</script>

<template>
  <div class="max-w-md mx-auto pb-12 px-2 pt-3">

    <!-- Top header row: Back · Title · Manage -->
    <div class="flex items-center justify-between mb-2 px-1">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        :to="`/leagues/${leagueId}`"
        label="Back"
        class="-ml-2"
      />

      <h2 class="text-xs font-bold text-stone-500 tracking-wider uppercase">
        League Roster
      </h2>

      <!-- Manage toggle -->
      <UButton
        v-if="access.isAdmin"
        :color="isManageMode ? 'amber' : 'neutral'"
        variant="soft"
        size="xs"
        :icon="isManageMode ? 'i-lucide-lock-open' : 'i-lucide-lock'"
        label="Manage"
        @click="isManageMode = !isManageMode"
      />
      <!-- Spacer for non-admins to keep title centered -->
      <div v-else class="w-16" />
    </div>

    <!-- Manage action row: Add Player · Recalculate -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="isManageMode && access.isAdmin"
        class="flex items-center gap-2 mb-3 px-1"
      >
        <!-- Create new player -->
        <AdminPlayerModal
          :league-id="leagueId"
          :existing-roster="roster"
          :league-tee-type="leagueTeeType"
          @saved="refresh()"
        />

        <!-- Add existing player -->
        <AddExistingPlayerModal
          :league-id="leagueId"
          :league-tee-type="leagueTeeType"
          @saved="refresh()"
        />

        <!-- Recalculate handicaps — app_handicap leagues only -->
        <UButton
          v-if="isAppHandicap"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="soft"
          size="sm"
          :loading="isRecalculating"
          :disabled="isRecalculating"
          @click="recalculateHandicaps"
        >
          <template #default>
            <span v-if="isRecalculating && recalcProgress">
              {{ recalcProgress.completed }}/{{ recalcProgress.total }}
            </span>
            <span v-else>Recalculate</span>
          </template>
        </UButton>
      </div>
    </Transition>
    <div class="space-y-1">
      <UCard
        v-for="member in roster"
        :key="member.id"
        :ui="{ body: 'p-2.5 sm:p-3' }"
        class="bg-white dark:bg-stone-900 border-stone-200
               dark:border-stone-800 shadow-none"
      >
        <div class="flex items-center justify-between">

          <!-- Left: info -->
          <div class="min-w-0">
              <div class="flex items-center gap-1.5 leading-none">
                <span
                  class="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate"
                >
                  {{ member.firstName }} {{ member.lastName }}
                </span>
                <UIcon
                  v-if="member.isAdmin"
                  name="i-lucide-crown"
                  class="size-3.5 text-amber-500 shrink-0"
                />
              </div>

              <div class="flex items-center gap-2 mt-1 select-none flex-wrap">
                <!-- Tee type -->
                <span
                  :class="getTeeColorClass(member.teeType)"
                  class="text-[10px] font-black tracking-wide uppercase shrink-0"
                >
                  {{ member.teeType }}
                </span>

                <!-- GHIN with edit -->
                <div
                  class="inline-flex items-center gap-1 bg-stone-100
                         dark:bg-stone-800 px-1.5 py-0.5 rounded"
                >
                  <span class="text-[10px] font-medium text-stone-400 dark:text-stone-500">GHIN</span>
                  <span class="text-sm font-bold font-mono text-stone-800 dark:text-stone-200">{{ member.ghin ?? '—' }}</span>
                  <GhinEditModal
                    v-if="access.isAdmin || access.myPlayerId === member.id"
                    :player-id="member.id"
                    :current-ghin="member.ghin"
                    :player-name="`${member.firstName} ${member.lastName}`"
                    @updated="refresh"
                  />
                </div>

                <!-- Edit player — manage mode only -->
                <AdminPlayerModal
                  v-if="isManageMode && access.isAdmin"
                  :player="member"
                  :league-id="leagueId"
                  :existing-roster="roster"
                  :league-tee-type="leagueTeeType"
                  @saved="refresh()"
                />
              </div>
          </div>

          <!-- Right: handicap -->
          <button
            :disabled="!isAppHandicap"
            :class="[
              'text-right focus:outline-none transition-colors',
              isAppHandicap
                ? 'active:bg-stone-100 dark:active:bg-stone-800 rounded px-2 py-0.5 cursor-pointer'
                : 'cursor-default',
            ]"
            @click="handleAuditClick(member)"
          >
            <div
              class="text-[9px] text-stone-400 dark:text-stone-500
                     font-black tracking-wider uppercase leading-none"
            >
              HCP
            </div>
            <div
              class="font-bold text-base text-stone-900 dark:text-stone-100
                     font-mono mt-0.5"
            >
              {{ formatHandicap(member.handicap) }}
            </div>
          </button>

        </div>
      </UCard>
    </div>

    <!-- Empty state -->
    <div
      v-if="roster.length === 0"
      class="text-center py-12 text-stone-400 dark:text-stone-600"
    >
      <UIcon name="i-lucide-users" class="size-8 mx-auto mb-2" />
      <p class="text-sm">No players on this roster yet.</p>
    </div>

    <!-- Handicap audit modal -->
    <HandicapAuditModal
      v-if="showAuditModal"
      v-model:open="showAuditModal"
      :player="selectedPlayer"
      :league-id="leagueId"
    />

  </div>
</template>