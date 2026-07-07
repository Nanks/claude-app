<script setup lang="ts">
// LeagueCard.vue

interface League {
  id:                   string
  name:                 string
  short_name:           string
  tee_type:             string
  holes:                number
  theme_start_color:    string
  theme_end_color:      string
  nextEventDate:        string | null
  isLive:               boolean
  isMember:             boolean
  isAdmin:              boolean
  playerHasActiveRound: boolean
}

const props = defineProps<{
  league:         League
  showStartRound?: boolean
}>()

const emit = defineEmits<{ startRound: [] }>()

const formattedDate = computed(() => {
  if (!props.league.nextEventDate) return null
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
    timeZone: 'UTC',
  }).format(new Date(props.league.nextEventDate))
})

const holesLabel = computed(() =>
  props.league.holes === 9 ? '9 holes' : '18 holes'
)
</script>

<template>
  <div
    class="rounded-xl overflow-hidden
           bg-white dark:bg-stone-900
           border border-stone-200 dark:border-stone-800"
  >
    <!-- Main league link -->
    <NuxtLink
      :to="`/leagues/${league.id}`"
      class="flex items-center gap-3 p-3
             hover:bg-stone-50 dark:hover:bg-stone-800/50
             transition-colors duration-150 active:scale-[0.99]"
    >
      <!-- League logo -->
      <LeagueLogo
        :short-name="league.short_name"
        :theme-start-color="league.theme_start_color"
        :theme-end-color="league.theme_end_color"
        size="sm"
      />

      <!-- League info -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <span class="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
            <span class="sm:hidden">{{ league.short_name }}</span>
            <span class="hidden sm:inline">{{ league.name }}</span>
          </span>

          <!-- Live badge -->
          <UBadge
            v-if="league.isLive"
            label="LIVE"
            color="success"
            variant="solid"
            size="xs"
            class="animate-pulse shrink-0"
          />

          <!-- Admin crown icon -->
          <UIcon
            v-if="league.isAdmin"
            name="i-lucide-crown"
            class="size-3.5 text-amber-500 shrink-0"
            title="You are an admin of this league"
          />
        </div>

        <div class="text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1.5">
          <span>{{ holesLabel }}</span>
          <template v-if="formattedDate">
            <span>&middot;</span>
            <span>{{ formattedDate }}</span>
          </template>
          <template v-else>
            <span>&middot;</span>
            <span class="italic">No upcoming rounds</span>
          </template>
        </div>
      </div>

      <!-- Chevron -->
      <UIcon
        name="i-lucide-chevron-right"
        class="size-4 text-stone-400 dark:text-stone-600 shrink-0"
      />
    </NuxtLink>

    <!-- Resume round row -->
    <NuxtLink
      v-if="league.playerHasActiveRound"
      to="/scorecard"
      class="flex items-center gap-2 px-3 py-2
             border-t border-stone-100 dark:border-stone-800
             bg-stone-50 dark:bg-stone-800/50
             hover:bg-stone-100 dark:hover:bg-stone-800
             transition-colors duration-150"
    >
      <UIcon name="i-lucide-play" class="size-3.5 text-primary-500 dark:text-primary-400 shrink-0" />
      <span class="text-xs font-semibold text-stone-700 dark:text-stone-300">Resume Round</span>
    </NuxtLink>

    <!-- Start round row — shown after "Not Today" dismissal -->
    <button
      v-if="showStartRound"
      class="w-full flex items-center gap-2 px-3 py-2
             border-t border-stone-100 dark:border-stone-800
             bg-stone-50 dark:bg-stone-800/40
             hover:bg-stone-100 dark:hover:bg-stone-800
             transition-colors duration-150"
      @click.prevent="emit('startRound')"
    >
      <UIcon name="i-lucide-flag" class="size-3.5 text-stone-500 dark:text-stone-400 shrink-0" />
      <span class="text-xs font-semibold text-stone-600 dark:text-stone-400">Start Round</span>
    </button>
  </div>
</template>
