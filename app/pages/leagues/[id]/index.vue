<script setup lang="ts">
// pages/leagues/[id]/index.vue
// League detail page — shows league header and navigation menu card.

definePageMeta({ layout: 'default' })

const route   = useRoute()
const leagueId = route.params.id as string

const { data, error, status } = await useFetch(`/api/leagues/${leagueId}`)

const league              = computed(() => data.value?.league)
const games               = computed(() => data.value?.games ?? [])
const todayEvent          = computed(() => data.value?.todayEvent)
const hasScoresToday      = computed(() => data.value?.hasScoresToday ?? false)
const playerHasScoreToday = computed(() => data.value?.playerHasScoreToday ?? false)
const isMember            = computed(() => data.value?.isMember ?? false)
const isAdmin             = computed(() => data.value?.isAdmin ?? false)

// ── Menu items ────────────────────────────────────────────
// Built as a flat list of objects so the template renders them
// as styled NuxtLink rows — more flexible than UNavigationMenu
// for a mobile card-based layout.

interface MenuItem {
  label:    string
  icon:     string
  to:       string
  color?:   'lime' | 'amber' | 'sky' | 'rose' | 'stone'
  pulse?:   boolean
  show:     boolean
}

const menuItems = computed<MenuItem[]>(() => [
  // Always shown
  {
    label: 'Calendar',
    icon:  'i-lucide-calendar',
    to:    `/leagues/${leagueId}/calendar`,
    color: 'stone',
    show:  true,
  },
  {
    label: 'Roster',
    icon:  'i-lucide-users',
    to:    `/leagues/${leagueId}/roster`,
    color: 'stone',
    show:  true,
  },
  // Live leaderboard — shown when scores exist today
  {
    label: 'Live Leaderboard',
    icon:  'i-lucide-trophy',
    to:    `/leagues/${leagueId}/events/${todayEvent.value?.id ?? ''}`,
    color: 'lime',
    pulse: true,
    show:  hasScoresToday.value,
  },
  // Resume round — shown when the signed-in player has scores today
  {
    label: 'Resume Round',
    icon:  'i-lucide-play',
    to:    '/scorecard',
    color: 'lime',
    show:  playerHasScoreToday.value,
  },
  // Yearly games — one item per game
  ...games.value.map((game) => ({
    label: game.name === 'birds' ? 'Birdies' : 'Deuces',
    icon:  game.name === 'birds' ? 'i-lucide-bird' : 'i-lucide-dice-2',
    to:    `/leagues/${leagueId}/${game.name}`,
    color: 'sky' as const,
    show:  true,
  })),
])

const visibleItems = computed(() => menuItems.value.filter((i) => i.show))

// Color map for icon + border accent
const colorMap = {
  lime:  'text-primary-500  group-hover:text-primary-600',
  amber: 'text-amber-500 group-hover:text-amber-600',
  sky:   'text-sky-500   group-hover:text-sky-600',
  rose:  'text-rose-500  group-hover:text-rose-600',
  stone: 'text-stone-500 group-hover:text-stone-600 dark:text-stone-400',
}
</script>

<template>
  <div class="max-w-lg mx-auto px-3 py-4 space-y-4">

    <!-- Loading -->
    <template v-if="status === 'pending'">
      <USkeleton class="h-24 w-full rounded-xl" />
      <USkeleton class="h-48 w-full rounded-xl" />
    </template>

    <!-- Error -->
    <UAlert
      v-else-if="error"
      color="error"
      icon="i-lucide-alert-circle"
      title="Could not load league"
      :description="error.message"
    />

    <template v-else-if="league">

      <!-- Back button row -->
      <div class="flex items-center justify-between mb-1 px-1">
        <UButton
          icon="i-lucide-arrow-left"
          color="neutral"
          variant="ghost"
          to="/"
          label="Back"
          class="-ml-2"
        />
      </div>

      <!-- ── League header ──────────────────────────────── -->
      <div
        class="rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800
               bg-white dark:bg-stone-900"
      >
        <!-- Tinted banner using theme colors at low opacity -->
        <div
          class="flex items-center gap-4 p-4"
          :style="{
            background: `linear-gradient(135deg,
              ${league.theme_start_color}22,
              ${league.theme_end_color}44)`
          }"
        >
          <!-- Logo — white background so it stands out from the tinted banner -->
          <div
            class="shrink-0 rounded-xl bg-white dark:bg-stone-900 shadow-sm p-1"
          >
            <LeagueLogo
              :short-name="league.short_name"
              :theme-start-color="league.theme_start_color"
              :theme-end-color="league.theme_end_color"
              size="md"
            />
          </div>

          <!-- Name + meta -->
          <div class="flex-1 min-w-0">
            <h1 class="text-lg font-bold text-stone-900 dark:text-stone-100
                       leading-tight truncate">
              {{ league.name }}
            </h1>
            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
              <span class="text-xs text-stone-500 dark:text-stone-400">
                {{ league.holes === 9 ? '9 holes' : '18 holes' }}
              </span>
              <span class="text-stone-300 dark:text-stone-600 text-xs">&middot;</span>
              <span class="text-xs text-stone-500 dark:text-stone-400 capitalize">
                {{ league.tee_type }}
              </span>
              <!-- Admin crown -->
              <UIcon
                v-if="isAdmin"
                name="i-lucide-crown"
                class="size-3.5 text-amber-500"
                title="You are an admin of this league"
              />
            </div>
          </div>
        </div>

        <!-- Live indicator bar -->
        <div
          v-if="hasScoresToday"
          class="px-4 py-2 flex items-center gap-2"
          :style="{
            background: `linear-gradient(135deg,
              ${league.theme_start_color}33,
              ${league.theme_end_color}55)`
          }"
        >
          <span class="size-2 rounded-full bg-primary-500 animate-pulse shrink-0" />
          <span class="text-xs font-medium text-stone-700 dark:text-stone-300">
            Round in progress
          </span>
        </div>
      </div>

      <!-- ── Menu card ──────────────────────────────────── -->
      <UCard :ui="{ body: 'p-0' }">
        <nav>
          <NuxtLink
            v-for="(item, index) in visibleItems"
            :key="item.to"
            :to="item.to"
            class="group flex items-center gap-3 px-4 py-3.5
                   transition-colors duration-150
                   hover:bg-stone-50 dark:hover:bg-stone-800/60
                   active:bg-stone-100 dark:active:bg-stone-800"
            :class="[
              index < visibleItems.length - 1
                ? 'border-b border-stone-100 dark:border-stone-800'
                : ''
            ]"
          >
            <!-- Icon -->
            <div
              class="size-8 rounded-lg flex items-center justify-center shrink-0
                     bg-stone-100 dark:bg-stone-800
                     group-hover:bg-stone-200 dark:group-hover:bg-stone-700
                     transition-colors"
            >
              <UIcon
                :name="item.icon"
                class="size-4 transition-colors"
                :class="[
                  colorMap[item.color ?? 'stone'],
                  item.pulse ? 'animate-pulse' : ''
                ]"
              />
            </div>

            <!-- Label -->
            <span
              class="flex-1 text-sm font-medium text-stone-800 dark:text-stone-200"
            >
              {{ item.label }}
            </span>

            <!-- Live dot for leaderboard -->
            <span
              v-if="item.pulse"
              class="size-2 rounded-full bg-primary-500 animate-pulse shrink-0"
            />

            <!-- Chevron -->
            <UIcon
              name="i-lucide-chevron-right"
              class="size-4 text-stone-400 dark:text-stone-600 shrink-0"
            />
          </NuxtLink>
        </nav>
      </UCard>

    </template>

  </div>
</template>