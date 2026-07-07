<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { activeEventId } = useActiveRound()

const { data: scorecard, refresh, status } = await useFetch('/api/me/scorecard', {
  default: () => null,
})

if (!scorecard.value) {
  await navigateTo('/')
} else {
  activeEventId.value = scorecard.value.event.id
}

const side         = ref<'front' | 'back'>('front')
const selectedHole = ref<number | null>(null)

const hasBack = computed(() => (scorecard.value?.event.holes ?? 9) > 9)

const displayIdx = computed(() => {
  if (side.value === 'front') return Array.from({ length: 9 }, (_, i) => i)
  const total = scorecard.value?.event.holes ?? 18
  return Array.from({ length: Math.max(0, total - 9) }, (_, i) => i + 9)
})

// ── Per-player helpers ──────────────────────────────────────────────
type Player = NonNullable<typeof scorecard.value>['players'][number]

function playerPar(p: Player, idx: number): number {
  return p.pars[idx] ?? 4
}

function grossDeco(p: Player, idx: number): 'eagle' | 'birdie' | 'par' | 'bogey' | 'double' {
  const score = p.scores[idx]
  if (!score) return 'par'
  const d = score - playerPar(p, idx)
  if (d <= -2) return 'eagle'
  if (d === -1) return 'birdie'
  if (d === 0)  return 'par'
  if (d === 1)  return 'bogey'
  return 'double'
}

function isNetDeuce(p: Player, idx: number): boolean {
  const score = p.scores[idx]
  return !!score && (score - (p.pops[idx] ?? 0)) === 2
}

function fmtHoleNet(p: Player, idx: number): string {
  const score = p.scores[idx]
  if (!score) return ''
  const net = score - (p.pops[idx] ?? 0) - playerPar(p, idx)
  if (net === 0) return 'E'
  return net > 0 ? `+${net}` : String(net)
}

function holeNetClass(p: Player, idx: number): string {
  const score = p.scores[idx]
  if (!score) return 'invisible'
  const net = score - (p.pops[idx] ?? 0) - playerPar(p, idx)
  if (net < 0) return 'text-green-600 dark:text-green-400'
  if (net > 0) return 'text-rose-500 dark:text-rose-400'
  return 'text-stone-400 dark:text-stone-500'
}

function sectionTotal(scores: (number | null)[], indices: number[]): number | null {
  const vals = indices.map(i => scores[i]).filter(v => v !== null) as number[]
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null
}

async function onSaved() {
  await refresh()
  selectedHole.value = null
}
</script>

<template>
  <div v-if="status === 'pending'" class="flex items-center justify-center h-48">
    <UIcon name="i-lucide-loader" class="size-6 animate-spin text-stone-400" />
  </div>

  <div v-else-if="!scorecard" class="text-center py-16 px-4 text-stone-400">
    <UIcon name="i-lucide-clipboard" class="size-10 mx-auto mb-3" />
    <p class="text-sm">No active round found.</p>
    <UButton label="Go Home" to="/" color="neutral" variant="ghost" class="mt-3" />
  </div>

  <div v-else class="max-w-lg mx-auto px-3">

    <!-- Event header -->
    <div class="pt-4 pb-3 flex items-baseline justify-between">
      <div>
        <p class="text-sm font-semibold text-stone-700 dark:text-stone-200">{{ scorecard.event.league_name }}</p>
        <p class="text-xs text-stone-400 dark:text-stone-500">{{ scorecard.event.course_name }}</p>
      </div>
      <p class="text-xs text-stone-400">
        {{ new Date(scorecard.event.event_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}
      </p>
    </div>

    <!-- Front / Back picker -->
    <div v-if="hasBack" class="flex pb-3 gap-2">
      <button
        class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
        :class="side === 'front'
          ? 'bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900'
          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'"
        @click="side = 'front'"
      >
        Front 9
      </button>
      <button
        class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
        :class="side === 'back'
          ? 'bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900'
          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'"
        @click="side = 'back'"
      >
        Back 9
      </button>
    </div>

    <!-- Hole number header (shared) -->
    <div class="grid mb-0.5" style="grid-template-columns: repeat(9, 1fr) 2rem">
      <div
        v-for="idx in displayIdx"
        :key="idx"
        class="text-center text-[10px] font-semibold text-stone-500 dark:text-stone-400"
      >
        {{ scorecard.holeData[idx]?.hole }}
      </div>
      <div class="text-center text-[10px] text-stone-400">Tot</div>
    </div>

    <div class="border-b border-stone-200 dark:border-stone-700 mb-1" />

    <!-- Player sections -->
    <div
      v-for="player in scorecard.players"
      :key="player.score_id"
      class="py-2 border-b border-stone-100 dark:border-stone-800/60 last:border-0"
    >
      <!-- Player name + handicap -->
      <div class="flex items-baseline justify-between mb-1">
        <p class="text-sm font-semibold text-stone-700 dark:text-stone-200">
          {{ player.fname }} {{ player.lname }}
        </p>
        <span class="text-[11px] text-stone-400 dark:text-stone-500 ml-2 shrink-0">
          +{{ player.playing_handicap }} · {{ player.tees_name }}
        </span>
      </div>

      <!-- Score grid -->
      <div class="grid" style="grid-template-columns: repeat(9, 1fr) 2rem">

        <!-- Score cells -->
        <div
          v-for="idx in displayIdx"
          :key="idx"
          class="cursor-pointer"
          @click="selectedHole = idx"
        >
          <!-- Pops dots -->
          <div class="flex justify-center gap-px h-2 items-center">
            <span
              v-for="n in (player.pops[idx] ?? 0)"
              :key="n"
              class="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500 block"
            />
          </div>

          <!-- Score box -->
          <div class="relative flex items-center justify-center h-9 mx-0.5 rounded bg-stone-100 dark:bg-stone-800">

            <!-- D badge: deuce -->
            <span
              v-if="scorecard.showDeuceGame && player.scores[idx] === 2"
              class="absolute bottom-0 left-0 flex items-center justify-center w-3.5 h-3.5 rounded-full
                     bg-sky-100 dark:bg-sky-900/70 text-sky-700 dark:text-sky-300 text-[7px] font-black leading-none z-10"
            >D</span>

            <!-- 2 badge: net deuce -->
            <span
              v-if="scorecard.showNetDeuceGame && isNetDeuce(player as any, idx)"
              class="absolute bottom-0 right-0 flex items-center justify-center w-3.5 h-3.5 rounded-full
                     bg-violet-100 dark:bg-violet-900/70 text-violet-700 dark:text-violet-300 text-[7px] font-black leading-none z-10"
            >2</span>

            <!-- Eagle: double circle -->
            <span
              v-if="grossDeco(player as any, idx) === 'eagle'"
              class="flex items-center justify-center rounded-full border border-stone-700 dark:border-stone-300 w-8 h-8 p-0.5"
            >
              <span class="flex items-center justify-center rounded-full border border-stone-700 dark:border-stone-300 w-full h-full text-[11px] font-bold text-stone-800 dark:text-stone-100 leading-none">
                {{ player.scores[idx] }}
              </span>
            </span>

            <!-- Birdie: single circle -->
            <span
              v-else-if="grossDeco(player as any, idx) === 'birdie'"
              class="flex items-center justify-center rounded-full border border-stone-700 dark:border-stone-300 w-7 h-7 text-sm font-bold text-stone-800 dark:text-stone-100 leading-none"
            >
              {{ player.scores[idx] }}
            </span>

            <!-- Bogey: single square -->
            <span
              v-else-if="grossDeco(player as any, idx) === 'bogey'"
              class="flex items-center justify-center border border-stone-700 dark:border-stone-300 w-7 h-7 text-sm font-bold text-stone-800 dark:text-stone-100 leading-none"
            >
              {{ player.scores[idx] }}
            </span>

            <!-- Double+: double square -->
            <span
              v-else-if="grossDeco(player as any, idx) === 'double'"
              class="flex items-center justify-center border border-stone-700 dark:border-stone-300 w-8 h-8 p-0.5"
            >
              <span class="flex items-center justify-center border border-stone-700 dark:border-stone-300 w-full h-full text-[11px] font-bold text-stone-800 dark:text-stone-100 leading-none">
                {{ player.scores[idx] }}
              </span>
            </span>

            <!-- Par or no score -->
            <span
              v-else
              class="text-sm font-bold leading-none"
              :class="player.scores[idx] ? 'text-stone-800 dark:text-stone-100' : 'text-stone-300 dark:text-stone-600'"
            >
              {{ player.scores[idx] ?? '–' }}
            </span>
          </div>

          <!-- Net per hole -->
          <div
            class="text-[9px] tabular-nums leading-none mt-0.5 text-center"
            :class="holeNetClass(player as any, idx)"
          >
            {{ fmtHoleNet(player as any, idx) }}
          </div>
        </div>

        <!-- Section total -->
        <div class="flex items-center justify-center">
          <span
            class="text-sm font-semibold tabular-nums"
            :class="sectionTotal(player.scores as (number | null)[], displayIdx) !== null
              ? 'text-stone-700 dark:text-stone-200'
              : 'text-stone-300 dark:text-stone-600'"
          >
            {{ sectionTotal(player.scores as (number | null)[], displayIdx) ?? '–' }}
          </span>
        </div>

      </div>
    </div>

  </div>

  <!-- Score entry modal -->
  <ScoreEntryModal
    v-if="selectedHole !== null && scorecard"
    :hole-idx="selectedHole"
    :hole-info="(scorecard.holeData[selectedHole] as any)"
    :players="(scorecard.players as any)"
    @saved="onSaved"
    @close="selectedHole = null"
  />
</template>
