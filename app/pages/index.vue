<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { data, error, status } = await useFetch('/api/home', {
  dedupe: 'defer',
  default: () => ({ player: null, leagues: [] }),
})

const player     = computed(() => data.value?.player  ?? null)
const allLeagues = computed(() => data.value?.leagues ?? [])

// ── Today's round detection ───────────────────────────────────
const localDate = new Date().toISOString().slice(0, 10)
const { data: todayData } = await useFetch('/api/me/today', {
  query: { date: localDate },
  default: () => null,
})
const showTodayModal  = ref(!!todayData.value)
const todayDismissed  = ref(false)

// The league_id of the dismissed today-event, so the card can show "Start Round"
const dismissedLeagueId = computed(() =>
  todayDismissed.value ? (todayData.value?.event.league_id ?? null) : null
)

function onTodayClose() {
  showTodayModal.value = false
  todayDismissed.value = true
}

function onStartRound() {
  todayDismissed.value = false
  showTodayModal.value = true
}

// Enrich todayData theme colors from the home API leagues, which is always fresh
const enrichedToday = computed(() => {
  const td = todayData.value
  if (!td) return null
  const homeLeague = allLeagues.value.find(l => l.id === td.event.league_id)
  return {
    ...td,
    event: {
      ...td.event,
      theme_start_color: homeLeague?.theme_start_color ?? td.event.theme_start_color ?? '#6b7280',
      theme_end_color:   homeLeague?.theme_end_color   ?? td.event.theme_end_color   ?? '#374151',
    },
  }
})

const myLeagues    = computed(() => allLeagues.value.filter((l) => l.isMember))
const otherLeagues = computed(() => allLeagues.value.filter((l) => !l.isMember))
</script>

<template>
  <TodayRoundModal
    v-if="showTodayModal && enrichedToday"
    :today="enrichedToday"
    @close="onTodayClose"
  />

  <div class="max-w-lg mx-auto px-3 py-4 space-y-4">

    <!-- Loading state -->
    <template v-if="status === 'pending'">
      <USkeleton class="h-20 w-full rounded-xl" />
      <USkeleton class="h-4 w-24" />
      <div class="space-y-2">
        <USkeleton v-for="i in 3" :key="i" class="h-16 w-full rounded-xl" />
      </div>
    </template>

    <!-- Error state -->
    <UAlert
      v-else-if="error"
      color="error"
      icon="i-lucide-alert-circle"
      title="Could not load home page"
      :description="error.message"
    />

    <template v-else>

      <!-- Player dashboard — authenticated users only -->
      <PlayerDashboard
        v-if="player"
        :player="player"
      />

      <!-- My Leagues -->
      <section v-if="myLeagues.length > 0">
        <h3 class="text-xs font-semibold text-stone-500 dark:text-stone-400
                   uppercase tracking-wider mb-2 px-1">
          My Leagues
        </h3>
        <div class="space-y-2">
          <LeagueCard
            v-for="league in myLeagues"
            :key="league.id"
            :league="league"
            :show-start-round="dismissedLeagueId === league.id"
            @start-round="onStartRound"
          />
        </div>
      </section>

      <!-- Other Leagues -->
      <section v-if="otherLeagues.length > 0">
        <h3 class="text-xs font-semibold text-stone-500 dark:text-stone-400
                   uppercase tracking-wider mb-2 px-1">
          {{ myLeagues.length > 0 ? 'Other Leagues' : 'Leagues' }}
        </h3>
        <div class="space-y-2">
          <LeagueCard
            v-for="league in otherLeagues"
            :key="league.id"
            :league="league"
          />
        </div>
      </section>

      <!-- Empty state -->
      <div
        v-if="allLeagues.length === 0"
        class="text-center py-12 text-stone-400 dark:text-stone-600"
      >
        <UIcon name="i-lucide-flag" class="size-8 mx-auto mb-2" />
        <p class="text-sm">No active leagues found.</p>
      </div>

    </template>

  </div>
</template>