<script setup lang="ts">
// pages/leagues/[id]/calendar.vue
// Shows one year of events at a time with prev/next year navigation.

import type { EventStatus } from '~~/shared/types/database.types'

definePageMeta({ layout: 'default' })

const route    = useRoute()
const leagueId = route.params.id as string

interface CalendarEvent {
  id:                  string
  event_date:          string
  status:              EventStatus
  holes:               number
  per:                 number
  money:               number
  course_id:           string
  tees_id:             string | null
  tee_name:            string | null
  double_birdie_holes: number[] | null
  game_type_ids:       number[]
  game_names:          string[]
}

const { data, refresh } = await useFetch(`/api/leagues/${leagueId}/calendar`)

const events    = computed<CalendarEvent[]>(() => (data.value?.events    ?? []) as CalendarEvent[])
const courses   = computed(()               => data.value?.courses   ?? [])
const gameTypes = computed(()               => data.value?.gameTypes  ?? [])
const isAdmin   = computed(()               => data.value?.isAdmin    ?? false)

const leagueDefaults = computed(() => ({
  course_id: data.value?.league?.course_id ?? '',
  tees_id:   data.value?.league?.tees_id   ?? null,
  holes:     data.value?.league?.holes      ?? 18,
  per:       data.value?.league?.per        ?? 0,
  tee_type:  data.value?.league?.tee_type   ?? 'mixed',
}))

const isManageMode = ref(false)

// ── Year navigation ─────────────────────────────────────────
const thisYear = new Date().getFullYear()

const availableYears = computed(() => {
  const years = new Set<number>([thisYear])
  for (const evt of events.value) {
    years.add(parseInt(evt.event_date.slice(0, 4), 10))
  }
  return [...years].sort((a, b) => a - b)
})

const selectedYear = ref(thisYear)

// Clamp to a valid year when events load
watch(availableYears, (years) => {
  if (!years.includes(selectedYear.value)) {
    selectedYear.value = years[years.length - 1] ?? thisYear
  }
}, { immediate: true })

const yearIndex   = computed(() => availableYears.value.indexOf(selectedYear.value))
const canGoPrev   = computed(() => yearIndex.value > 0)
const canGoNext   = computed(() => yearIndex.value < availableYears.value.length - 1)

function prevYear() {
  if (canGoPrev.value) selectedYear.value = availableYears.value[yearIndex.value - 1]
}
function nextYear() {
  if (canGoNext.value) selectedYear.value = availableYears.value[yearIndex.value + 1]
}

const yearEvents = computed(() =>
  events.value.filter(evt => evt.event_date.startsWith(String(selectedYear.value)))
)

// ── Formatting helpers ──────────────────────────────────────
const teeColorMap: Record<string, string> = {
  black:  'text-stone-900 dark:text-stone-200 font-semibold',
  blue:   'text-blue-600 dark:text-blue-400',
  red:    'text-red-600 dark:text-red-400',
  green:  'text-green-600 dark:text-green-400',
  gold:   'text-yellow-600 dark:text-yellow-400',
  yellow: 'text-yellow-600 dark:text-yellow-400',
  silver: 'text-stone-500 dark:text-stone-400',
  orange: 'text-orange-600 dark:text-orange-400',
}

function teeColorClass(name: string | null): string {
  if (!name) return 'text-stone-400 dark:text-stone-500'
  const key = name.split(' ')[0].toLowerCase()
  return teeColorMap[key] ?? 'text-stone-400 dark:text-stone-500'
}

// When multiple games on an event, abbreviate to first initial of each word.
// e.g. "Birdies" → "B", "Net Skins" → "NS". Single game shows full name.
function gameBadgeLabel(name: string, totalGames: number): string {
  const titled = name.replace(/\b\w/g, c => c.toUpperCase())
  if (totalGames <= 1) return titled
  return name.split(/\s+/).map(w => w[0].toUpperCase()).join('')
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  })
}

type BadgeColor = 'primary' | 'success' | 'neutral' | 'warning' | 'info' | 'secondary' | 'error'

const statusLabel: Record<EventStatus, string> = {
  scheduled: 'Scheduled',
  live:      'Live',
  complete:  'Complete',
  practice:  'Practice',
  handicap:  'Handicap',
  rain:      'Rain',
  cancelled: 'Cancelled',
}

const statusColor: Record<EventStatus, BadgeColor> = {
  scheduled: 'primary',
  live:      'success',
  complete:  'neutral',
  practice:  'warning',
  handicap:  'info',
  rain:      'secondary',
  cancelled: 'error',
}
</script>

<template>
  <div class="max-w-md mx-auto pb-12 px-2 pt-3">

    <!-- Top header row: Back · Title · Manage -->
    <div class="flex items-center justify-between mb-3 px-1">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        :to="`/leagues/${leagueId}`"
        label="Back"
        class="-ml-2"
      />

      <h2 class="text-xs font-bold text-stone-500 tracking-wider uppercase">
        Calendar
      </h2>

      <UButton
        v-if="isAdmin"
        :color="isManageMode ? 'amber' : 'neutral'"
        variant="soft"
        size="xs"
        :icon="isManageMode ? 'i-lucide-lock-open' : 'i-lucide-lock'"
        label="Manage"
        @click="isManageMode = !isManageMode"
      />
      <div v-else class="w-16" />
    </div>

    <!-- Year navigation -->
    <div class="flex items-center justify-center gap-4 mb-3">
      <UButton
        icon="i-lucide-chevron-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="!canGoPrev"
        @click="prevYear"
      />
      <span class="text-lg font-bold text-stone-800 dark:text-stone-100 tabular-nums w-16 text-center">
        {{ selectedYear }}
      </span>
      <UButton
        icon="i-lucide-chevron-right"
        color="neutral"
        variant="ghost"
        size="sm"
        :disabled="!canGoNext"
        @click="nextYear"
      />
    </div>

    <!-- Add Event button (manage mode) -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="isManageMode && isAdmin" class="flex items-center gap-2 mb-3 px-1">
        <AdminEventModal
          :league-id="leagueId"
          :league="leagueDefaults"
          :courses="courses"
          :game-types="gameTypes"
          @saved="refresh()"
        />
      </div>
    </Transition>

    <!-- Empty state -->
    <div
      v-if="yearEvents.length === 0"
      class="text-center py-16 text-stone-400 dark:text-stone-600"
    >
      <UIcon name="i-lucide-calendar-x" class="size-8 mx-auto mb-2" />
      <p class="text-sm">No events in {{ selectedYear }}.</p>
    </div>

    <!-- Event list -->
    <UCard v-else :ui="{ body: 'p-0' }">
      <div
        v-for="(evt, index) in yearEvents"
        :key="evt.id"
        class="flex items-center gap-3 px-4 py-3"
        :class="[
          index < yearEvents.length - 1
            ? 'border-b border-stone-100 dark:border-stone-800'
            : ''
        ]"
      >

        <!-- Date + meta -->
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-stone-800 dark:text-stone-200">
            {{ formatDate(evt.event_date) }}
          </div>
          <div
            v-if="evt.tee_name || evt.double_birdie_holes?.length || evt.game_names.length"
            class="mt-0.5 space-y-1"
          >
            <!-- Tees + double-birdie holes -->
            <div
              v-if="evt.tee_name || evt.double_birdie_holes?.length"
              class="flex items-center gap-2 flex-wrap"
            >
              <span
                v-if="evt.tee_name"
                class="text-[11px]"
                :class="teeColorClass(evt.tee_name)"
              >
                {{ evt.tee_name }} Tees
              </span>
              <span
                v-if="evt.double_birdie_holes && evt.double_birdie_holes.length > 0"
                class="inline-flex items-center gap-0.5 text-[11px] text-amber-500 dark:text-amber-400 font-medium"
              >
                <UIcon name="i-lucide-bird" class="size-3" />
                {{ evt.double_birdie_holes.join(', ') }}
              </span>
            </div>

            <!-- Game badges -->
            <div v-if="evt.game_names.length" class="flex items-center gap-1 flex-wrap">
              <UBadge
                v-for="name in evt.game_names"
                :key="name"
                :label="gameBadgeLabel(name, evt.game_names.length)"
                color="info"
                variant="subtle"
                size="xs"
              />
            </div>
          </div>
        </div>

        <!-- Status badge / leaderboard link -->
        <NuxtLink
          v-if="evt.status === 'live' || evt.status === 'complete'"
          :to="`/leagues/${leagueId}/events/${evt.id}`"
          class="shrink-0 flex items-center gap-1 group"
        >
          <UBadge
            :label="statusLabel[evt.status]"
            :color="statusColor[evt.status]"
            variant="subtle"
            size="sm"
          />
          <UIcon
            name="i-lucide-chevron-right"
            class="size-3.5 text-stone-400 group-hover:text-primary-500 transition-colors"
          />
        </NuxtLink>
        <UBadge
          v-else
          :label="statusLabel[evt.status]"
          :color="statusColor[evt.status]"
          variant="subtle"
          size="sm"
          class="shrink-0"
        />

        <!-- Edit button (manage mode) -->
        <AdminEventModal
          v-if="isManageMode && isAdmin"
          :event="evt"
          :league-id="leagueId"
          :league="leagueDefaults"
          :courses="courses"
          :game-types="gameTypes"
          @saved="refresh()"
        />

      </div>
    </UCard>

  </div>
</template>
