<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route    = useRoute()
const leagueId = route.params.id as string
const gameName = route.params.game as string

const { data, status } = await useFetch(`/api/leagues/${leagueId}/yearly-standings`)

const gameData = computed(() => {
  return data.value?.yearlyGames?.find(g => g.name === gameName) ?? null
})

const standings    = computed(() => gameData.value?.standings ?? [])
const isValid      = computed(() => gameData.value !== null || status.value === 'pending')
const pageTitle    = computed(() => gameName === 'birds' ? 'Birdies' : 'Net Deuces')
const pageIcon     = computed(() => gameName === 'birds' ? 'i-lucide-bird' : 'i-lucide-dice-2')
const metricLabel  = computed(() => gameName === 'birds' ? 'pts' : '')
</script>

<template>
  <div class="max-w-md mx-auto pb-12 px-2 pt-3">

    <!-- Header row -->
    <div class="flex items-center justify-between mb-4 px-1">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        :to="`/leagues/${leagueId}`"
        label="Back"
        class="-ml-2"
      />

      <div class="flex items-center gap-1.5">
        <UIcon :name="pageIcon" class="size-4 text-sky-500" />
        <h2 class="text-xs font-bold text-stone-500 tracking-wider uppercase">
          {{ pageTitle }}
        </h2>
      </div>

      <div class="w-16" />
    </div>

    <!-- Loading -->
    <template v-if="status === 'pending'">
      <div class="space-y-2">
        <USkeleton v-for="i in 6" :key="i" class="h-14 w-full rounded-xl" />
      </div>
    </template>

    <!-- Not a valid game for this league -->
    <div
      v-else-if="!isValid"
      class="text-center py-16 text-stone-400 dark:text-stone-600"
    >
      <UIcon name="i-lucide-ban" class="size-8 mx-auto mb-2" />
      <p class="text-sm">This game is not configured for this league.</p>
    </div>

    <!-- Empty season -->
    <div
      v-else-if="standings.length === 0"
      class="text-center py-16 text-stone-400 dark:text-stone-600"
    >
      <UIcon :name="pageIcon" class="size-8 mx-auto mb-2" />
      <p class="text-sm font-medium">No results yet this season.</p>
      <p class="text-xs mt-1">Standings update as rounds are completed.</p>
    </div>

    <!-- Standings list -->
    <div v-else class="space-y-1">
      <div
        v-for="(player, index) in standings"
        :key="player.playerId"
        class="flex items-center gap-3 px-3 py-3 rounded-xl
               bg-white dark:bg-stone-900
               border border-stone-200 dark:border-stone-800"
      >
        <!-- Rank -->
        <div class="w-7 shrink-0 text-center">
          <span
            v-if="index === 0"
            class="text-base font-black text-amber-500"
          >1</span>
          <span
            v-else-if="index === 1"
            class="text-base font-black text-stone-400"
          >2</span>
          <span
            v-else-if="index === 2"
            class="text-base font-black text-amber-700 dark:text-amber-600"
          >3</span>
          <span
            v-else
            class="text-sm font-semibold text-stone-400 dark:text-stone-600"
          >{{ index + 1 }}</span>
        </div>

        <!-- Name + rounds -->
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
            {{ player.playerName }}
          </p>
          <p class="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
            {{ player.eventsPlayed }} {{ player.eventsPlayed === 1 ? 'round' : 'rounds' }}
          </p>
        </div>

        <!-- Total -->
        <div class="text-right shrink-0">
          <span class="text-lg font-bold font-mono text-stone-900 dark:text-stone-100">
            {{ player.total }}
          </span>
          <span
            v-if="metricLabel"
            class="text-[10px] text-stone-400 dark:text-stone-500 ml-0.5"
          >{{ metricLabel }}</span>
        </div>
      </div>
    </div>

  </div>
</template>
