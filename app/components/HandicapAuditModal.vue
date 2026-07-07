<!-- components/HandicapAuditModal.vue -->
<script setup lang="ts">
interface AuditRound {
  id:             string
  event_date:     string
  raw_gross:      number | null
  adjusted_gross: number | null
  course_rating:  number
  slope_rating:   number
  differential:   number
  is_best:        boolean
  is_padding:     boolean
  round_position: number
}

const props = defineProps<{
  open:     boolean
  player:   any
  leagueId: string
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const history   = ref<AuditRound[]>([])
const isLoading = ref(false)

async function fetchAuditData() {
  if (!props.player?.id) return
  isLoading.value = true
  try {
    const data = await $fetch<{ history: AuditRound[] }>(
      `/api/players/${props.player.id}/handicap-audit`,
      { query: { leagueId: props.leagueId } }
    )
    history.value = data?.history ?? []
  } catch (err) {
    console.error('Failed fetching audit history:', err)
    history.value = []
  } finally {
    isLoading.value = false
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) fetchAuditData()
  else history.value = []
}, { immediate: true })

// Format ISO date → 'Aug 27, 2025'
function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month:    'short',
    day:      'numeric',
    year:     'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

// Best 4 count for the summary line
const bestCount  = computed(() => history.value.filter((r) => r.is_best).length)
const bestAvg    = computed(() => {
  const bests = history.value.filter((r) => r.is_best)
  if (!bests.length) return null
  const avg = bests.reduce((sum, r) => sum + Number(r.differential), 0) / bests.length
  return avg.toFixed(3)
})
</script>

<template>
  <UModal
    :open="open"
    :title="player
      ? `Handicap Audit — ${player.firstName} ${player.lastName}`
      : 'Handicap Audit'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-3">

        <!-- Summary -->
        <div
          v-if="!isLoading && bestCount > 0"
          class="flex items-center justify-between
                 px-3 py-2 rounded-lg
                 bg-primary-50 dark:bg-primary-900/20
                 border border-primary-200 dark:border-primary-800"
        >
          <span class="text-xs text-primary-700 dark:text-primary-400 font-medium">
            Best {{ bestCount }} of {{ history.length }} rounds
          </span>
          <span class="text-sm font-bold font-mono text-primary-700 dark:text-primary-400">
            avg {{ bestAvg }}
          </span>
        </div>

        <!-- Loading -->
        <div
          v-if="isLoading"
          class="text-center py-8 text-xs text-stone-400"
        >
          Loading rounds...
        </div>

        <!-- Empty -->
        <div
          v-else-if="history.length === 0"
          class="text-center py-8 text-xs text-stone-400"
        >
          No rounds found.
        </div>

        <!-- Round rows -->
        <div
          v-else
          class="max-h-[50vh] overflow-y-auto space-y-1 -mx-1 px-1"
        >
          <div
            v-for="round in history"
            :key="round.id"
            class="flex items-center justify-between px-3 py-2
                   rounded-lg border text-xs transition-colors"
            :class="round.is_padding
              ? 'bg-stone-50 dark:bg-stone-800/40 border-stone-100 dark:border-stone-800 opacity-60'
              : round.is_best
                ? 'bg-primary-50 dark:bg-primary-900/20 border-lime-200 dark:border-lime-800'
                : 'bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800'"
          >
            <!-- Date + gross -->
            <div class="flex flex-col gap-0.5">
              <span
                class="font-semibold"
                :class="round.is_best
                  ? 'text-primary-800 dark:text-primary-300'
                  : 'text-stone-700 dark:text-stone-300'"
              >
                <template v-if="round.is_padding">
                  <span class="italic text-stone-400">Placeholder</span>
                </template>
                <template v-else>
                  {{ formatDate(round.event_date) }}
                </template>
              </span>
              <span
                v-if="!round.is_padding"
                class="text-[10px] text-stone-400"
              >
                Gross: {{ round.adjusted_gross ?? round.raw_gross ?? '—' }}
                &middot;
                {{ round.course_rating }}/{{ round.slope_rating }}
              </span>
              <span
                v-else
                class="text-[10px] text-stone-400"
              >
                GHIN &minus; 3 (fewer than 6 rounds)
              </span>
            </div>

            <!-- Differential + used badge -->
            <div class="flex items-center gap-1.5 shrink-0">
              <span
                class="font-mono font-bold tabular-nums"
                :class="round.is_best
                  ? 'text-primary-700 dark:text-primary-400'
                  : 'text-stone-600 dark:text-stone-400'"
              >
                {{ Number(round.differential).toFixed(3) }}
              </span>
              <span
                v-if="round.is_best"
                class="text-[9px] uppercase bg-primary-200 dark:bg-primary-800
                       text-primary-800 dark:text-primary-200
                       px-1.5 py-0.5 rounded font-black"
              >
                Used
              </span>
            </div>
          </div>
        </div>

      </div>
    </template>

    <template #footer>
      <div class="flex justify-end">
        <UButton
          label="Close"
          color="neutral"
          variant="outline"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>