<script setup lang="ts">
// pages/leagues/[id]/events/[eventId].vue
// Event leaderboard — Net Score tab always first, then one tab per game.
// Gross Skins + Net Skins + Deuce Pot are merged into a single "Skins" tab,
// displayed as one list grouped by hole with money calculations.

definePageMeta({ layout: 'default' })

const route    = useRoute()
const leagueId = route.params.id as string
const eventId  = route.params.eventId as string

const { data, error, refresh } = await useFetch(`/api/events/${eventId}/leaderboard`)

// ── Tab management ────────────────────────────────────────────
const activeTab = ref('net-score')

const SKIN_NAMES = ['gross skins', 'net skins', 'deuce pot']

const tabs = computed(() => {
  const games    = data.value?.games ?? []
  const base     = [{ value: 'net-score', label: 'Net Score' }]
  let addedSkins = false
  const eventTabs: { value: string; label: string }[] = []

  for (const g of games) {
    const n = g.name.toLowerCase()
    if (n === 'net score') continue
    if (SKIN_NAMES.some((t) => n.includes(t))) {
      if (!addedSkins) { eventTabs.push({ value: 'skins', label: 'Skins' }); addedSkins = true }
    } else {
      eventTabs.push({ value: slugify(g.name), label: g.name })
    }
  }

  const yearlyTabs = (data.value?.yearlyGameTypes ?? []).map((yg: { id: number; name: string }) => ({
    value: `yearly-${yg.id}`,
    label: yg.name,
  }))

  return [...base, ...eventTabs, ...yearlyTabs]
})

function slugify(s: string) { return s.toLowerCase().replace(/\s+/g, '-') }

function gameType(name: string): 'birds' | 'bbb' | 'other' {
  const n = name.toLowerCase()
  if (n.includes('bird'))                              return 'birds'
  if (n.includes('blind') || n.includes('best ball')) return 'bbb'
  return 'other'
}

// ── Formatting ────────────────────────────────────────────────
function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function fmtNet(n: number, app = false): string {
  if (app) return (n >= 0 ? '+' : '') + n.toFixed(3)
  const r = Math.round(n * 10) / 10
  if (Math.abs(r) < 0.05) return 'E'
  return r > 0 ? `+${r % 1 === 0 ? Math.round(r) : r}` : `${r % 1 === 0 ? Math.round(r) : r}`
}

function fmtGross(gross: number, holesPlayed: number): string {
  if (gross === 0) return '—'
  const total = evt.value?.holes ?? 18
  return holesPlayed >= total ? `${gross} (F)` : `${gross} (${holesPlayed})`
}

function fmtBirds(n: number): string {
  if (n === 0) return '—'
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

function fmtMoney(n: number): string {
  if (!n) return ''
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`
}

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
  if (!name) return 'text-stone-400'
  const key = (name.split(' ')[0] ?? '').toLowerCase()
  return teeColorMap[key] ?? 'text-stone-400 dark:text-stone-500'
}

const statusLabel: Record<string, string> = {
  scheduled: 'Scheduled', live: 'Live', complete: 'Complete',
  practice: 'Practice', handicap: 'Handicap', rain: 'Rain', cancelled: 'Cancelled',
}
type BadgeColor = 'primary' | 'success' | 'neutral' | 'warning' | 'info' | 'secondary' | 'error'
const statusColor: Record<string, BadgeColor> = {
  scheduled: 'primary', live: 'primary', complete: 'neutral',
  practice: 'warning', handicap: 'info', rain: 'secondary', cancelled: 'error',
}

// ── Derived data ──────────────────────────────────────────────
const evt     = computed(() => data.value?.event)
const league  = computed(() => data.value?.league)
const players = computed(() => data.value?.players ?? [])
const results = computed(() => data.value?.gameResults)
const isMixed     = computed(() => league.value?.tee_type === 'mixed')
const appHandicap = computed(() => league.value?.app_handicap ?? false)
const hasMoney    = computed(() => ((evt.value?.per ?? 0) * (evt.value?.money ?? 0)) > 0)

// For complete events, players with incomplete scorecards go to the bottom unranked.
const displayPlayers = computed(() => {
  const all   = players.value
  const total = evt.value?.holes ?? 18
  if (evt.value?.status !== 'complete') return all.map((p, i) => ({ ...p, rank: i + 1 }))
  const full = all.filter((p) => p.holesPlayed >= total)
  const part = all.filter((p) => p.holesPlayed < total)
  return [
    ...full.map((p, i) => ({ ...p, rank: i + 1 })),
    ...part.map((p)    => ({ ...p, rank: 0 })),
  ]
})

const birdsSorted = computed(() =>
  [...players.value].sort((a, b) => b.totalBirds - a.totalBirds)
)

// Which skin sub-types are configured for this event
const skinGames = computed(() => {
  const names = (data.value?.games ?? []).map((g) => g.name.toLowerCase())
  return {
    hasGross:  names.some((n) => n.includes('gross') && n.includes('skin')),
    hasNet:    names.some((n) => n.includes('net')   && n.includes('skin')),
    hasDeuces: names.some((n) => n.includes('deuce')),
  }
})

// ── Money & hole-event calculations ──────────────────────────
type HoleEvent = {
  type:      'gross' | 'net' | 'deuce'
  player:    string
  player_id: string
  score:     number
  money:     number
}

const holeEvents = computed((): [number, HoleEvent[]][] => {
  const map      = new Map<number, HoleEvent[]>()
  const add      = (h: number, e: HoleEvent) => {
    if (!map.has(h)) map.set(h, [])
    map.get(h)!.push(e)
  }

  const totalPot  = (evt.value?.per ?? 0) * (evt.value?.money ?? 0) * players.value.length
  const numGames  = (data.value?.games ?? []).filter((g) => g.name.toLowerCase() !== 'net score').length
  const potPerGame = numGames > 0 ? totalPot / numGames : 0

  const gs = results.value?.grossSkins ?? []
  const gShare = gs.length > 0 ? potPerGame / gs.length : 0
  for (const s of gs)
    add(s.hole, { type: 'gross', player: s.player, player_id: s.player_id, score: s.score, money: gShare })

  const ns = results.value?.netSkins ?? []
  const nShare = ns.length > 0 ? potPerGame / ns.length : 0
  for (const s of ns)
    add(s.hole, { type: 'net', player: s.player, player_id: s.player_id, score: s.score, money: nShare })

  const ds = results.value?.deuces ?? []
  const dShare = ds.length > 0 ? potPerGame / ds.length : 0
  for (const d of ds)
    add(d.hole, { type: 'deuce', player: d.player, player_id: d.player_id, score: 2, money: dShare })

  return [...map.entries()].sort((a, b) => a[0] - b[0])
})

// Aggregate money per player (for Net Score tab badges)
const moneyWon = computed(() => {
  const map = new Map<string, number>()
  for (const [, events] of holeEvents.value)
    for (const e of events)
      map.set(e.player_id, (map.get(e.player_id) ?? 0) + e.money)
  return map
})

// Win badges per player (for Net Score tab inline display)
type WinBadge = { type: 'gross' | 'net' | 'deuce'; hole: number }
const winMap = computed(() => {
  const map = new Map<string, WinBadge[]>()
  const push = (id: string, b: WinBadge) => {
    if (!map.has(id)) map.set(id, [])
    map.get(id)!.push(b)
  }
  for (const s of results.value?.grossSkins ?? []) push(s.player_id, { type: 'gross', hole: s.hole })
  for (const s of results.value?.netSkins   ?? []) push(s.player_id, { type: 'net',   hole: s.hole })
  for (const d of results.value?.deuces     ?? []) push(d.player_id, { type: 'deuce', hole: d.hole })
  return map
})

const badgeClass = {
  gross: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  net:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  deuce: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
} as const

function badgeLabel(type: 'gross' | 'net' | 'deuce', hole: number): string {
  return `${type === 'gross' ? 'G' : type === 'net' ? 'N' : 'D'}${hole}`
}

// ── Live polling ──────────────────────────────────────────────
const POLL_MS     = 15_000
const isLive      = computed(() => evt.value?.status === 'live' || evt.value?.status === 'scheduled')
const lastUpdated = ref<Date | null>(null)
const pollProgress = ref(0)   // 0–100, fills toward the next refresh

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })
}

let pollTimer:     ReturnType<typeof setInterval> | null = null
let progressTimer: ReturnType<typeof setInterval> | null = null
let pollStart = 0

function startProgress() {
  pollStart = Date.now()
  pollProgress.value = 0
  if (progressTimer) clearInterval(progressTimer)
  progressTimer = setInterval(() => {
    pollProgress.value = Math.min(100, ((Date.now() - pollStart) / POLL_MS) * 100)
  }, 100)
}

function stopProgress() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null }
  pollProgress.value = 0
}

async function refreshLive() {
  await refresh()
  lastUpdated.value = new Date()
  startProgress()
}

onMounted(() => {
  if (isLive.value) {
    lastUpdated.value = new Date()
    startProgress()
    pollTimer = setInterval(refreshLive, POLL_MS)
  }
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  stopProgress()
})

watch(isLive, (live) => {
  if (live && !pollTimer) {
    lastUpdated.value = new Date()
    startProgress()
    pollTimer = setInterval(refreshLive, POLL_MS)
  } else if (!live && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
    stopProgress()
  }
})

// ── Admin + Mark Complete ─────────────────────────────────────
const isAdmin = computed(() => data.value?.isAdmin ?? false)
const canMarkComplete = computed(() =>
  isAdmin.value && (evt.value?.status === 'live' || evt.value?.status === 'scheduled')
)

const showCompleteModal  = ref(false)
const isMarkingComplete  = ref(false)
const completeErr        = ref('')
const incompleteScores   = ref<{ player_id: string; name: string }[]>([])

async function markComplete(force = false) {
  isMarkingComplete.value = true
  completeErr.value       = ''
  try {
    await $fetch(`/api/admin/events/${eventId}/complete`, {
      method: 'POST',
      body:   { force },
    })
    showCompleteModal.value = false
    incompleteScores.value  = []
    await refresh()
  } catch (e: any) {
    const inner = e?.data?.data
    if (e?.status === 422 && inner?.incompleteScores?.length) {
      incompleteScores.value  = inner.incompleteScores
      showCompleteModal.value = true
    } else {
      completeErr.value = e?.data?.statusMessage ?? 'Could not mark event complete.'
    }
  } finally {
    isMarkingComplete.value = false
  }
}

// ── Scorecard modal ───────────────────────────────────────────
const selectedPlayer = ref<(typeof players.value)[0] | null>(null)
function openScorecard(playerId: string) {
  selectedPlayer.value = players.value.find(p => p.player_id === playerId) ?? null
}
// Keep the open scorecard current when the leaderboard polls
watch(players, (newPlayers) => {
  if (!selectedPlayer.value) return
  const updated = newPlayers.find(p => p.player_id === selectedPlayer.value!.player_id)
  if (updated) selectedPlayer.value = updated
})

const selectedPairing = ref<[(typeof players.value)[0], (typeof players.value)[0]] | null>(null)
function openBbbScorecard(p1Id: string, p2Id: string) {
  const p1 = players.value.find(p => p.player_id === p1Id)
  const p2 = players.value.find(p => p.player_id === p2Id)
  if (p1 && p2) selectedPairing.value = [p1, p2]
}

// ── Yearly game tab helpers (event totals only — season totals are on their own page) ──
function sortedForYearly(gameName: string) {
  const all = players.value
  const n   = gameName.toLowerCase()
  if (n.includes('deuce')) return [...all].sort((a, b) => b.totalDeuces - a.totalDeuces)
  if (n.includes('bird'))  return [...all].sort((a, b) => b.totalBirds  - a.totalBirds)
  if (n.includes('net'))   return [...all].sort((a, b) => a.totalNet    - b.totalNet)
  if (n.includes('gross')) return [...all].sort((a, b) => a.totalGross  - b.totalGross)
  return [...all].sort((a, b) => b.totalBirds - a.totalBirds)
}

function valueForYearly(p: (typeof players.value)[0], gameName: string): string {
  const n = gameName.toLowerCase()
  if (n.includes('deuce')) return String(p.totalDeuces)
  if (n.includes('bird'))  return fmtBirds(p.totalBirds)
  if (n.includes('net'))   return fmtNet(p.totalNet, appHandicap.value)
  if (n.includes('gross')) return String(p.totalGross)
  return fmtBirds(p.totalBirds)
}
</script>

<template>
  <div class="max-w-md mx-auto pb-12 px-2 pt-3">

    <!-- Top row -->
    <div class="flex items-center justify-between mb-3 px-1">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        :to="`/leagues/${leagueId}/calendar`"
        label="Back"
        class="-ml-2"
      />
      <h2 class="text-xs font-bold text-stone-500 tracking-wider uppercase">Leaderboard</h2>
      <div class="w-16" />
    </div>

    <!-- Error state -->
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-alert-circle"
      title="Could not load leaderboard"
      :description="(error as any)?.data?.statusMessage || error?.message"
      class="mb-4"
    />

    <template v-else-if="evt">
      <!-- Event header -->
      <div class="mb-4 px-1">
        <div class="flex items-center gap-2">
          <span class="text-base font-semibold text-stone-800 dark:text-stone-200">
            {{ fmtDate(evt.event_date) }}
          </span>
          <UBadge
            :label="statusLabel[evt.status] ?? evt.status"
            :color="statusColor[evt.status] ?? 'neutral'"
            variant="subtle"
            size="sm"
          />
          <div class="flex-1" />
          <UButton
            v-if="canMarkComplete"
            label="Mark Complete"
            color="warning"
            size="xs"
            icon="i-lucide-check-circle"
            :loading="isMarkingComplete"
            @click="markComplete(false)"
          />
        </div>
        <div class="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          {{ league?.name }} · {{ evt.holes }} holes
          <template v-if="hasMoney"> · ${{ evt.per }}/player</template>
        </div>
        <!-- Live pulse + progress bar -->
        <div v-if="isLive" class="mt-1.5 space-y-1.5">
          <div class="flex items-center gap-1.5 text-[11px] text-primary-600 dark:text-primary-400 font-medium">
            <span class="relative flex h-2 w-2 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-primary-500" />
            </span>
            Updating live<template v-if="lastUpdated"> · {{ fmtTime(lastUpdated) }}</template>
          </div>
          <!-- Fills left→right over 15 s; resets after each poll -->
          <div class="h-0.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
            <div class="h-full bg-primary-500 rounded-full" :style="{ width: `${pollProgress}%` }" />
          </div>
        </div>
        <UAlert
          v-if="completeErr"
          color="error"
          :description="completeErr"
          icon="i-lucide-alert-circle"
          class="mt-2"
        />
      </div>

      <!-- Empty state -->
      <div v-if="players.length === 0" class="text-center py-16 text-stone-400 dark:text-stone-600">
        <UIcon name="i-lucide-clipboard-list" class="size-8 mx-auto mb-2" />
        <p class="text-sm">No scores recorded yet.</p>
      </div>

      <template v-else>
        <!-- Tab bar -->
        <div class="flex gap-1 mb-3 overflow-x-auto pb-1">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            class="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            :class="activeTab === tab.value
              ? 'bg-primary-500 text-white'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- ══ Net Score tab ════════════════════════════════════ -->
        <template v-if="activeTab === 'net-score'">
          <UCard :ui="{ body: 'p-0' }">
            <div class="grid grid-cols-[1.5rem_1fr_5rem] gap-2 px-4 py-2 border-b border-stone-100 dark:border-stone-800 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              <span>#</span>
              <span>Player</span>
              <span class="text-right">Net</span>
            </div>
            <TransitionGroup
              name="lb"
              tag="div"
              class="divide-y divide-stone-100 dark:divide-stone-800"
            >
              <div
                v-for="p in displayPlayers"
                :key="p.player_id"
                class="grid grid-cols-[1.5rem_1fr_5rem] gap-2 items-start px-4 py-3 cursor-pointer active:bg-stone-50 dark:active:bg-stone-800/50"
                :class="p.rank === 0 ? 'opacity-60' : ''"
                @click="openScorecard(p.player_id)"
              >
                <span class="text-xs text-stone-400 dark:text-stone-500 tabular-nums pt-0.5">
                  {{ p.rank > 0 ? p.rank : '—' }}
                </span>

                <div class="min-w-0">
                  <div class="text-sm font-medium text-stone-800 dark:text-stone-200">
                    {{ p.fname }} {{ p.lname }}
                  </div>
                  <!-- Hdcp + Gross sub-line -->
                  <div class="flex items-center gap-2 mt-0.5 text-[11px] text-stone-400 dark:text-stone-500 tabular-nums">
                    <span>Hdcp {{ appHandicap ? p.playing_handicap.toFixed(3) : p.playing_handicap }}</span>
                    <span>{{ fmtGross(p.totalGross, p.holesPlayed) }}</span>
                  </div>
                  <!-- Tee name: mixed leagues only -->
                  <div v-if="isMixed" class="text-[11px]" :class="teeColorClass(p.tee_name)">
                    {{ p.tee_name }}
                  </div>
                  <!-- Win badges + money -->
                  <div
                    v-if="winMap.get(p.player_id)?.length || (hasMoney && moneyWon.get(p.player_id))"
                    class="flex items-center gap-1 mt-0.5 flex-wrap"
                  >
                    <span
                      v-for="(win, wi) in winMap.get(p.player_id)"
                      :key="wi"
                      class="text-[10px] font-bold px-1 py-px rounded leading-tight"
                      :class="badgeClass[win.type]"
                    >
                      {{ badgeLabel(win.type, win.hole) }}
                    </span>
                    <span
                      v-if="hasMoney && moneyWon.get(p.player_id)"
                      class="text-[11px] font-semibold text-primary-600 dark:text-primary-400 leading-tight"
                    >
                      +{{ fmtMoney(moneyWon.get(p.player_id)!) }}
                    </span>
                  </div>
                </div>

                <span
                  class="text-right text-sm font-semibold tabular-nums pt-px"
                  :class="p.totalNet < -0.05 ? 'text-primary-600 dark:text-primary-400' : p.totalNet > 0.05 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-600 dark:text-stone-300'"
                >
                  {{ fmtNet(p.totalNet, appHandicap) }}
                </span>
              </div>
            </TransitionGroup>
          </UCard>
        </template>

        <!-- ══ Skins tab (Gross Skins + Net Skins + Deuce Pot by hole) ═ -->
        <template v-else-if="activeTab === 'skins'">
          <div v-if="!holeEvents.length" class="text-center py-12 text-stone-400">
            <UIcon name="i-lucide-trophy" class="size-7 mx-auto mb-2" />
            <p class="text-sm">No skins or deuces yet.</p>
          </div>

          <UCard v-else :ui="{ body: 'p-0' }">
            <template v-for="([hole, events], hi) in holeEvents" :key="hole">
              <!-- Hole header -->
              <div
                class="flex items-center px-4 py-1.5 bg-stone-50 dark:bg-stone-900/60 text-[11px] font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider"
                :class="hi > 0 ? 'border-t border-stone-100 dark:border-stone-800' : ''"
              >
                Hole {{ hole }}
              </div>
              <!-- Event rows for this hole -->
              <div
                v-for="(e, ei) in events"
                :key="`${hole}-${ei}`"
                class="flex items-center gap-3 px-4 py-2.5 border-t border-stone-100 dark:border-stone-800"
              >
                <!-- Type badge -->
                <span
                  class="text-[10px] font-bold px-1.5 py-px rounded shrink-0 leading-tight"
                  :class="badgeClass[e.type]"
                >
                  {{ e.type === 'gross' ? 'G' : e.type === 'net' ? 'N' : 'D' }}
                </span>

                <!-- Player name -->
                <span class="text-sm text-stone-700 dark:text-stone-200 flex-1 truncate">
                  {{ e.player }}
                </span>

                <!-- Score (skins only; deuces always 2 but implied by badge) -->
                <span class="text-xs text-stone-500 dark:text-stone-400 tabular-nums w-4 text-center shrink-0">
                  {{ e.type !== 'deuce' ? e.score : '' }}
                </span>

                <!-- Money -->
                <span
                  v-if="hasMoney"
                  class="text-xs font-semibold text-primary-600 dark:text-primary-400 tabular-nums w-12 text-right shrink-0"
                >
                  {{ fmtMoney(e.money) }}
                </span>
              </div>
            </template>
          </UCard>
        </template>

        <!-- ══ Other game tabs ═══════════════════════════════════ -->
        <template v-for="tab in tabs.slice(1)" :key="tab.value">
          <template v-if="activeTab === tab.value && tab.value !== 'skins' && !tab.value.startsWith('yearly-')">

            <!-- Birds -->
            <template v-if="gameType(tab.label) === 'birds'">
              <UCard :ui="{ body: 'p-0' }">
                <div class="grid grid-cols-[1.5rem_1fr_4rem] gap-2 px-4 py-2 border-b border-stone-100 dark:border-stone-800 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  <span>#</span>
                  <span>Player</span>
                  <span class="text-right">Birds</span>
                </div>
                <TransitionGroup
                  name="lb"
                  tag="div"
                  class="divide-y divide-stone-100 dark:divide-stone-800"
                >
                  <div
                    v-for="(p, i) in birdsSorted"
                    :key="p.player_id"
                    class="grid grid-cols-[1.5rem_1fr_4rem] gap-2 items-center px-4 py-3 cursor-pointer active:bg-stone-50 dark:active:bg-stone-800/50"
                    @click="openScorecard(p.player_id)"
                  >
                    <span class="text-xs text-stone-400 tabular-nums">{{ i + 1 }}</span>
                    <div class="text-sm font-medium text-stone-800 dark:text-stone-200">{{ p.fname }} {{ p.lname }}</div>
                    <span
                      class="text-right text-sm font-semibold tabular-nums"
                      :class="p.totalBirds > 0 ? 'text-primary-600 dark:text-primary-400' : 'text-stone-400'"
                    >{{ fmtBirds(p.totalBirds) }}</span>
                  </div>
                </TransitionGroup>
              </UCard>
            </template>

            <!-- Blind Best Ball -->
            <template v-else-if="gameType(tab.label) === 'bbb'">
              <!-- Hidden until event is complete -->
              <div v-if="evt?.status !== 'complete'" class="text-center py-14 text-stone-400 dark:text-stone-500">
                <UIcon name="i-lucide-lock" class="size-8 mx-auto mb-3 opacity-50" />
                <p class="text-sm font-medium text-stone-600 dark:text-stone-400">Pairings will be revealed when the round is complete.</p>
              </div>

              <!-- Complete: show frozen pairings -->
              <template v-else>
                <div v-if="!results?.blindBestBall?.length" class="text-center py-12 text-stone-400">
                  <p class="text-sm">Not enough players for pairings.</p>
                </div>
                <UCard v-else :ui="{ body: 'p-0' }">
                  <div class="grid grid-cols-[1.5rem_1fr_4rem] gap-2 px-4 py-2 border-b border-stone-100 dark:border-stone-800 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                    <span>#</span>
                    <span>Pairing</span>
                    <span class="text-right">Net</span>
                  </div>
                  <div class="divide-y divide-stone-100 dark:divide-stone-800">
                    <div
                      v-for="(pair, i) in results!.blindBestBall"
                      :key="pair.ids"
                      class="grid grid-cols-[1.5rem_1fr_4rem] gap-2 items-center px-4 py-3 cursor-pointer active:bg-stone-50 dark:active:bg-stone-800/50"
                      @click="openBbbScorecard(pair.p1_id, pair.p2_id)"
                    >
                      <span class="text-xs text-stone-400 tabular-nums">{{ i + 1 }}</span>
                      <span class="text-sm text-stone-700 dark:text-stone-200">{{ pair.label }}</span>
                      <span
                        class="text-right text-sm font-semibold tabular-nums"
                        :class="pair.score < -0.05 ? 'text-primary-600 dark:text-primary-400' : pair.score > 0.05 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-600 dark:text-stone-300'"
                      >{{ fmtNet(pair.score) }}</span>
                    </div>
                  </div>
                </UCard>
              </template>
            </template>

            <!-- Fallback: net score list -->
            <template v-else>
              <UCard :ui="{ body: 'p-0' }">
                <div
                  v-for="(p, i) in players"
                  :key="p.player_id"
                  class="flex items-center justify-between px-4 py-3 cursor-pointer active:bg-stone-50 dark:active:bg-stone-800/50"
                  :class="i < players.length - 1 ? 'border-b border-stone-100 dark:border-stone-800' : ''"
                  @click="openScorecard(p.player_id)"
                >
                  <div class="text-sm font-medium text-stone-800 dark:text-stone-200">{{ p.fname }} {{ p.lname }}</div>
                  <span
                    class="text-sm font-semibold tabular-nums"
                    :class="p.totalNet < -0.05 ? 'text-primary-600 dark:text-primary-400' : p.totalNet > 0.05 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-600'"
                  >{{ fmtNet(p.totalNet) }}</span>
                </div>
              </UCard>
            </template>

          </template>
        </template>

        <!-- ══ Yearly game tabs (event totals for that metric) ══ -->
        <template
          v-for="yg in (data?.yearlyGameTypes ?? [])"
          :key="`yearly-${yg.id}`"
        >
          <template v-if="activeTab === `yearly-${yg.id}`">
            <div v-if="!sortedForYearly(yg.name).length" class="text-center py-12 text-stone-400">
              <UIcon name="i-lucide-bar-chart-2" class="size-7 mx-auto mb-2" />
              <p class="text-sm">No scores recorded yet.</p>
            </div>
            <UCard v-else :ui="{ body: 'p-0' }">
              <div class="grid grid-cols-[1.5rem_1fr_5rem] gap-2 px-4 py-2 border-b border-stone-100 dark:border-stone-800 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                <span>#</span>
                <span>Player</span>
                <span class="text-right">{{ yg.name }}</span>
              </div>
              <TransitionGroup
                name="lb"
                tag="div"
                class="divide-y divide-stone-100 dark:divide-stone-800"
              >
                <div
                  v-for="(p, i) in sortedForYearly(yg.name)"
                  :key="p.player_id"
                  class="grid grid-cols-[1.5rem_1fr_5rem] gap-2 items-center px-4 py-3 cursor-pointer active:bg-stone-50 dark:active:bg-stone-800/50"
                  @click="openScorecard(p.player_id)"
                >
                  <span class="text-xs text-stone-400 dark:text-stone-500 tabular-nums">{{ i + 1 }}</span>
                  <div class="text-sm font-medium text-stone-800 dark:text-stone-200">{{ p.fname }} {{ p.lname }}</div>
                  <span
                    class="text-right text-sm font-semibold tabular-nums"
                    :class="yg.name.toLowerCase().includes('net') && !yg.name.toLowerCase().includes('deuce')
                      ? (p.totalNet < -0.05 ? 'text-primary-600 dark:text-primary-400' : p.totalNet > 0.05 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-600 dark:text-stone-300')
                      : 'text-stone-700 dark:text-stone-200'"
                  >
                    {{ valueForYearly(p, yg.name) }}
                  </span>
                </div>
              </TransitionGroup>
            </UCard>
          </template>
        </template>

      </template>
    </template>

    <!-- ══ Mark Complete confirmation modal ════════════════════ -->
    <UModal v-model:open="showCompleteModal" :dismissible="false" :ui="{ content: 'max-w-sm' }">
      <template #content>
        <div class="p-5 space-y-4">
          <div class="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <UIcon name="i-lucide-triangle-alert" class="size-5 shrink-0" />
            <h3 class="font-semibold">Incomplete Scores</h3>
          </div>
          <p class="text-sm text-stone-600 dark:text-stone-300">
            The following players have not completed all holes:
          </p>
          <ul class="space-y-1.5">
            <li
              v-for="p in incompleteScores"
              :key="p.player_id"
              class="flex items-center gap-1.5 text-sm text-stone-700 dark:text-stone-200"
            >
              <UIcon name="i-lucide-circle-x" class="size-3.5 text-rose-500 shrink-0" />
              {{ p.name }}
            </li>
          </ul>
          <p class="text-sm text-stone-500 dark:text-stone-400">
            Pairings will be frozen using scores as they are now. Proceed anyway?
          </p>
          <div class="flex gap-2 pt-1">
            <UButton
              label="Proceed Anyway"
              color="warning"
              block
              :loading="isMarkingComplete"
              @click="markComplete(true)"
            />
            <UButton
              label="Cancel"
              color="neutral"
              variant="ghost"
              :disabled="isMarkingComplete"
              @click="() => { showCompleteModal = false }"
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- ══ Scorecard modal ══════════════════════════════════════ -->
    <ScorecardModal
      :player="selectedPlayer"
      :bbb-players="selectedPairing"
      :results="results ?? { grossSkins: [], netSkins: [], deuces: [] }"
      :game-names="(data?.games ?? []).map(g => g.name)"
      :yearly-game-types="data?.yearlyGameTypes ?? []"
      :total-holes="evt?.holes ?? 18"
      :app-handicap="appHandicap"
      :double-birdie-holes="evt?.double_birdie_holes ?? []"
      @close="selectedPlayer = null; selectedPairing = null"
    />

  </div>
</template>

<style scoped>
/* FLIP move — rows slide into their new position */
.lb-move {
  transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* New rows fade + drop in */
.lb-enter-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}
.lb-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

/* Leaving rows fade out in-place (position: absolute so remaining rows FLIP smoothly) */
.lb-leave-active {
  transition: opacity 0.2s ease;
  position: absolute;
  width: 100%;
}
.lb-leave-to {
  opacity: 0;
}
</style>
