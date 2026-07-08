<script setup lang="ts">
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
  league:          League
  showStartRound?: boolean
}>()

const emit = defineEmits<{ startRound: [] }>()

const formattedDate = computed(() => {
  if (!props.league.nextEventDate) return null
  return new Intl.DateTimeFormat('en-US', {
    weekday:  'short',
    month:    'short',
    day:      'numeric',
    timeZone: 'UTC',
  }).format(new Date(props.league.nextEventDate))
})
</script>

<template>
  <div
    class="rounded-xl overflow-hidden
           bg-white dark:bg-stone-900
           border border-stone-200 dark:border-stone-800"
  >
    <!-- League header — taps through to league detail -->
    <NuxtLink
      :to="`/leagues/${league.id}`"
      class="flex items-center gap-4 p-4
             hover:bg-stone-50 dark:hover:bg-stone-800/50
             transition-colors duration-150 active:scale-[0.99]"
    >
      <LeagueLogo
        :short-name="league.short_name"
        :theme-start-color="league.theme_start_color"
        :theme-end-color="league.theme_end_color"
        size="md"
      />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-base text-stone-900 dark:text-stone-100 truncate">
            {{ league.short_name }}
          </span>
          <span
            v-if="league.isLive"
            class="animate-pulse shrink-0 inline-flex items-center rounded
                   px-1.5 py-0.5 text-[10px] font-bold tracking-wide
                   bg-primary-500 text-stone-800"
          >
            LIVE
          </span>
          <UIcon
            v-if="league.isAdmin"
            name="i-lucide-crown"
            class="size-4 text-amber-500 shrink-0"
            title="You are an admin of this league"
          />
        </div>
      </div>

      <UIcon
        name="i-lucide-chevron-right"
        class="size-5 text-stone-400 dark:text-stone-600 shrink-0"
      />
    </NuxtLink>

    <!-- Date + action row -->
    <div
      class="flex items-center gap-3 px-4 py-3
             border-t border-stone-100 dark:border-stone-800
             bg-stone-50 dark:bg-stone-800/40"
    >
      <!-- Next round date -->
      <div class="flex-1 min-w-0 flex items-center gap-1.5">
        <UIcon name="i-lucide-calendar" class="size-3.5 text-stone-400 dark:text-stone-500 shrink-0" />
        <span
          v-if="formattedDate"
          class="text-sm text-stone-600 dark:text-stone-300"
        >
          {{ formattedDate }}
        </span>
        <span
          v-else
          class="text-sm text-stone-400 dark:text-stone-500 italic"
        >
          No upcoming rounds
        </span>
      </div>

      <!-- Resume Round -->
      <NuxtLink v-if="league.playerHasActiveRound" to="/scorecard">
        <UButton
          label="Resume"
          icon="i-lucide-play"
          size="sm"
          color="primary"
          variant="soft"
        />
      </NuxtLink>

      <!-- Start Round (after today-modal dismissal) -->
      <UButton
        v-else-if="showStartRound"
        label="Start Round"
        icon="i-lucide-flag"
        size="sm"
        color="neutral"
        variant="soft"
        @click="emit('startRound')"
      />
    </div>
  </div>
</template>
