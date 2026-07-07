<script setup lang="ts">
// TodayRoundModal.vue — shown on home page when there's an event today.
// Step 1: prompt to Start or Resume.
// Step 2 (Start only): pick players + tees, then create score rows.

interface LeaguePlayer {
  id:             string
  fname:          string
  lname:          string
  tee_type:       string
  tees_id:        string | null
  ghin:           number | null
  handicap_value: number
}

interface CourseTee {
  id:        string
  name:      string
  rating:    number
  slope:     number
  tee_types: string[]
  par_total: number
}

interface TodayEvent {
  id:                string
  league_id:         string
  event_date:        string
  status:            string
  holes:             number
  per:               number
  money:             number
  course_name:       string
  league_name:       string
  league_short:      string
  theme_start_color: string
  theme_end_color:   string
  is_mixed:          boolean
  app_handicap:      boolean
  game_names:        string[]
  tees_id:           string | null
}

interface TodayData {
  event:         TodayEvent
  myPlayerId:    string
  isAdmin:       boolean
  leaguePlayers: LeaguePlayer[]
  courseTees:    CourseTee[]
}

const props = defineProps<{ today: TodayData }>()
const emit  = defineEmits<{ close: [] }>()

const { activeEventId } = useActiveRound()

const isOpen  = ref(true)
const step    = ref<'prompt' | 'picker'>('prompt')
const isBusy  = ref(false)
const errMsg  = ref('')

// ── Player selections ─────────────────────────────────────────
// Map of player_id → { selected, tees_id }
interface PlayerSel { selected: boolean; tees_id: string }
const sel = ref<Record<string, PlayerSel>>({})

// Find the best-match tee for a player given the event config
function defaultTeeId(player: LeaguePlayer): string {
  const { event, courseTees } = props.today
  // Fixed tee league: always use the event tee
  if (!event.is_mixed && event.tees_id) return event.tees_id
  // Mixed league: prefer the player's own tee if it's available at this course
  if (player.tees_id && courseTees.some(t => t.id === player.tees_id)) {
    return player.tees_id
  }
  // Fallback: find a tee whose tee_types includes this player's tee_type
  const match = courseTees.find(t => t.tee_types.includes(player.tee_type as never))
  return match?.id ?? courseTees[0]?.id ?? ''
}

watch(isOpen, (open) => {
  if (!open) return
  // Initialise selections (current player pre-selected)
  const map: Record<string, PlayerSel> = {}
  for (const p of props.today.leaguePlayers) {
    map[p.id] = { selected: p.id === props.today.myPlayerId, tees_id: defaultTeeId(p) }
  }
  sel.value = map
}, { immediate: true })

// Tee options visible to a player (all course tees in mixed; fixed tee only in fixed)
function teeOptionsFor(_pid: string): CourseTee[] {
  if (!props.today.event.is_mixed) return props.today.courseTees
  return props.today.courseTees
}

// ── Playing handicap computation ──────────────────────────────
function computeHandicap(player: LeaguePlayer, teesId: string): number {
  // App-handicap leagues store the playing handicap directly — no conversion needed
  if (props.today.event.app_handicap) return player.handicap_value

  // GHIN leagues: course handicap = Index × (Slope / 113) + (Rating − Par)
  const tee = props.today.courseTees.find(t => t.id === teesId)
  if (!tee) return 0
  const raw = (player.ghin ?? 0) * (tee.slope / 113) + (tee.rating - tee.par_total)
  return Math.round(raw)
}

// ── Fixed tee display ─────────────────────────────────────────
const fixedTee = computed(() =>
  props.today.event.tees_id
    ? props.today.courseTees.find(t => t.id === props.today.event.tees_id)
    : null
)

// ── Actions ───────────────────────────────────────────────────
function dismiss() {
  isOpen.value = false
  emit('close')
}

function goToPicker() {
  step.value = 'picker'
}

async function startRound() {
  errMsg.value = ''
  const players = Object.entries(sel.value)
    .filter(([, s]) => s.selected)
    .map(([pid, s]) => {
      const p = props.today.leaguePlayers.find(lp => lp.id === pid)!
      const teesId = props.today.event.is_mixed ? s.tees_id : (props.today.event.tees_id ?? s.tees_id)
      return {
        player_id:        pid,
        tees_id:          teesId,
        playing_handicap: computeHandicap(p, teesId),
        ghin_index:       p.ghin,
      }
    })

  if (!players.length) {
    errMsg.value = 'Select at least one player.'
    return
  }

  isBusy.value = true
  try {
    await $fetch('/api/me/start-round', {
      method: 'POST',
      body: { event_id: props.today.event.id, players },
    })
    activeEventId.value = props.today.event.id
    isOpen.value = false
    emit('close')
    await navigateTo('/scorecard')
  } catch (e: any) {
    errMsg.value = e?.data?.statusMessage ?? 'Could not start round. Try again.'
  } finally {
    isBusy.value = false
  }
}

// ── Helpers ───────────────────────────────────────────────────
function fmtDate(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const selectedCount = computed(() => Object.values(sel.value).filter(s => s.selected).length)
</script>

<template>
  <UModal v-model:open="isOpen" :dismissible="false" :ui="{ content: 'max-w-sm' }">

    <!-- ── Step 1: Prompt ───────────────────────────────────── -->
    <template v-if="step === 'prompt'" #content>
      <!-- League logo header -->
      <div class="rounded-t-xl px-6 py-5 flex items-center justify-center bg-stone-50 dark:bg-stone-900 border-b border-stone-100 dark:border-stone-800">
        <LeagueLogo
          :short-name="today.event.league_short"
          :theme-start-color="today.event.theme_start_color ?? '#6b7280'"
          :theme-end-color="today.event.theme_end_color ?? '#374151'"
          size="lg"
        />
      </div>

      <div class="p-5 space-y-4">
        <!-- League prominent, course secondary -->
        <div class="text-center space-y-0.5">
          <h2 class="text-xl font-bold text-stone-800 dark:text-stone-100">{{ today.event.league_name }}</h2>
          <p class="text-sm text-stone-500 dark:text-stone-400">{{ today.event.course_name }}</p>
          <p class="text-xs text-stone-400 dark:text-stone-500 mt-1">{{ fmtDate(today.event.event_date) }} · {{ today.event.holes }} holes</p>
        </div>

        <!-- Games pill list -->
        <div v-if="today.event.game_names.length" class="flex flex-wrap justify-center gap-1.5">
          <span
            v-for="g in today.event.game_names" :key="g"
            class="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
          >{{ g }}</span>
        </div>

        <!-- Buttons -->
        <div class="space-y-2 pt-1">
          <UButton
            label="Start Round"
            color="primary"
            block
            icon="i-lucide-flag"
            @click="goToPicker"
          />
          <UButton
            label="Not Today"
            color="neutral"
            variant="ghost"
            block
            @click="dismiss"
          />
        </div>
      </div>
    </template>

    <!-- ── Step 2: Player picker ────────────────────────────── -->
    <template v-else-if="step === 'picker'" #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center gap-2">
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" @click="step = 'prompt'" />
          <h3 class="font-semibold text-stone-800 dark:text-stone-100">Who are you scoring for?</h3>
        </div>

        <UAlert v-if="errMsg" color="error" :description="errMsg" icon="i-lucide-alert-circle" />

        <!-- Fixed tee notice -->
        <p v-if="!today.event.is_mixed && fixedTee" class="text-xs text-stone-400">
          All players: <span class="font-medium text-stone-600 dark:text-stone-300">{{ fixedTee.name }}</span> tees
        </p>

        <!-- Player list -->
        <div class="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1">
          <div
            v-for="p in today.leaguePlayers"
            :key="p.id"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors"
            :class="sel[p.id]?.selected
              ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-200 dark:ring-primary-800'
              : 'bg-stone-50 dark:bg-stone-800/50'"
          >
            <!-- Checkbox — admins can deselect themselves; others are locked in -->
            <div class="shrink-0">
              <span
                v-if="p.id === today.myPlayerId && !today.isAdmin"
                class="flex items-center justify-center w-5 h-5 rounded-full bg-primary-500 text-white"
              >
                <UIcon name="i-lucide-check" class="size-3" />
              </span>
              <UCheckbox
                v-else
                :model-value="sel[p.id]?.selected ?? false"
                @update:model-value="(v) => { if (sel[p.id]) sel[p.id].selected = v }"
              />
            </div>

            <!-- Name + handicap -->
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-stone-800 dark:text-stone-100 leading-tight">
                {{ p.fname }} {{ p.lname }}
                <span v-if="p.id === today.myPlayerId" class="text-[10px] text-stone-400 ml-1">(you)</span>
              </p>
              <p class="text-[11px] text-stone-400 leading-none mt-0.5">
                Hdcp {{ p.handicap_value }}
              </p>
            </div>

            <!-- Tee selector (mixed only) -->
            <USelect
              v-if="today.event.is_mixed && sel[p.id]"
              :model-value="sel[p.id].tees_id"
              :items="teeOptionsFor(p.id).map(t => ({ label: t.name, value: t.id }))"
              size="sm"
              class="w-28 shrink-0"
              @update:model-value="(v) => { if (sel[p.id]) sel[p.id].tees_id = v }"
            />
          </div>
        </div>

        <!-- Selected players summary -->
        <div v-if="selectedCount > 0" class="rounded-lg bg-stone-50 dark:bg-stone-800/60 px-3 py-2 space-y-1.5">
          <p class="text-[11px] font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider">Scoring for {{ selectedCount }} player{{ selectedCount !== 1 ? 's' : '' }}</p>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="p in today.leaguePlayers.filter(lp => sel[lp.id]?.selected)"
              :key="p.id"
              class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
            >
              {{ p.fname }} {{ p.lname }}
              <span v-if="p.id === today.myPlayerId" class="text-[10px] opacity-60">(you)</span>
            </span>
          </div>
        </div>

        <UButton
          label="Start Round"
          color="primary"
          block
          :loading="isBusy"
          :disabled="selectedCount === 0"
          icon="i-lucide-flag"
          @click="startRound"
        />
      </div>
    </template>

  </UModal>
</template>
