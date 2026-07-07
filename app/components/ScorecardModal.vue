<script setup lang="ts">
// Scorecard modal — shown when tapping a player on any leaderboard tab.

type SkinEntry = { hole: number; player_id: string; player: string; score: number }

interface GameResults {
  grossSkins: SkinEntry[]
  netSkins:   SkinEntry[]
  deuces:     SkinEntry[]
}

interface PlayerData {
  player_id:        string
  fname:            string
  lname:            string
  playing_handicap: number
  pars:             number[]
  scores:           (number | null)[]
  pops:             number[]
  net:              number[]
  birds:            number[]
  deuces:           number[]
  chicago:          number[]
  tee_name:         string
  holesPlayed:      number
  totalGross:       number
  totalNet:         number
  totalBirds:       number
  totalDeuces:      number
  totalChicago:     number
}

const props = defineProps<{
  player:            PlayerData | null
  bbbPlayers?:       PlayerData[] | null
  results:           GameResults
  gameNames:         string[]
  yearlyGameTypes:   { id: number; name: string }[]
  totalHoles:        number
  appHandicap:       boolean
  doubleBirdieHoles: number[]
}>()

const emit = defineEmits<{ close: [] }>()

const isBbb = computed(() => !!props.bbbPlayers && props.bbbPlayers.length === 2)

const isOpen = computed({
  get: () => !!props.player || isBbb.value,
  set: (v) => { if (!v) emit('close') },
})

// ── Active game flags ─────────────────────────────────────────
const hasGrossSkins  = computed(() => props.gameNames.some(n => n.toLowerCase().includes('gross skin')))
const hasNetSkins    = computed(() => props.gameNames.some(n => n.toLowerCase().includes('net skin')))
const hasDeucePot    = computed(() => props.gameNames.some(n => n.toLowerCase().includes('deuce pot')))
const hasChicago     = computed(() => props.gameNames.some(n => n.toLowerCase().includes('chicago')))
const hasYearlyBirds = computed(() => props.yearlyGameTypes.some(yg => yg.name.toLowerCase().includes('bird')))
const hasYearlyDeuce = computed(() => props.yearlyGameTypes.some(yg => yg.name.toLowerCase().includes('deuce')))

// ── Per-hole badge helpers ────────────────────────────────────
function grossWin(i: number)  { return hasGrossSkins.value  && props.results.grossSkins.some(s => s.hole === i + 1 && s.player_id === props.player!.player_id) }
function netWin(i: number)    { return hasNetSkins.value    && props.results.netSkins.some(s => s.hole === i + 1 && s.player_id === props.player!.player_id) }
function deuceWin(i: number)  { return hasDeucePot.value    && props.results.deuces.some(d => d.hole === i + 1 && d.player_id === props.player!.player_id) }
function netDeuce(i: number)  { return hasYearlyDeuce.value && (props.player?.deuces[i] ?? 0) > 0 }
function birdPts(i: number)   { return hasYearlyBirds.value ? (props.player?.birds[i] ?? 0) : 0 }
function chiPts(i: number)    { return hasChicago.value     ? (props.player?.chicago[i] ?? 0) : 0 }

// ── Gross score decoration ────────────────────────────────────
function grossDeco(i: number): 'eagle' | 'birdie' | 'par' | 'bogey' | 'double' {
  const score = Number(props.player?.scores[i] || 0)
  if (score <= 0) return 'par'
  const diff = score - (props.player?.pars[i] ?? 4)
  if (diff <= -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0)  return 'par'
  if (diff === 1)  return 'bogey'
  return 'double'
}

function scoreText(i: number): string {
  const s = Number(props.player?.scores[i] || 0)
  return s > 0 ? String(s) : '–'
}

// ── Per-hole net score (shown below each scorebox) ────────────
function fmtHoleNet(i: number): string {
  const score = Number(props.player?.scores[i] || 0)
  if (score <= 0) return ''
  const n = props.player?.net[i] ?? 0
  if (props.appHandicap) return (n >= 0 ? '+' : '') + n.toFixed(1)
  const r = Math.round(n)
  if (r === 0) return 'E'
  return r > 0 ? `+${r}` : String(r)
}

function holeNetClass(i: number): string {
  const score = Number(props.player?.scores[i] || 0)
  if (score <= 0) return 'invisible'
  const n = props.player?.net[i] ?? 0
  const d = props.appHandicap ? n : Math.round(n)
  if (d < -0.05) return 'text-green-600 dark:text-green-400'
  if (d > 0.05)  return 'text-rose-500 dark:text-rose-400'
  return 'text-stone-400 dark:text-stone-500'
}

// ── Formatting helpers ────────────────────────────────────────
function fmtBirdVal(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

function fmtHdcp(n: number): string {
  return props.appHandicap ? n.toFixed(3) : String(n)
}

function fmtNetTotal(n: number): string {
  if (props.appHandicap) return (n >= 0 ? '+' : '') + n.toFixed(3)
  const r = Math.round(n * 10) / 10
  if (Math.abs(r) < 0.05) return 'E'
  return r > 0 ? `+${r}` : String(r)
}

// ── Section totals ────────────────────────────────────────────
const frontIdx = computed(() => Array.from({ length: Math.min(9, props.totalHoles) }, (_, i) => i))
const backIdx  = computed(() => props.totalHoles === 18 ? Array.from({ length: 9 }, (_, i) => i + 9) : [])

function sectionGross(indices: number[]): number {
  return indices.reduce((s, i) => s + (Number(props.player?.scores[i]) || 0), 0)
}
function sectionPar(indices: number[]): number {
  return indices.reduce((s, i) => s + (props.player?.pars[i] ?? 0), 0)
}

// ── BBB helpers ───────────────────────────────────────────────
// 0 = p0 used, 1 = p1 used, 2 = tied (both highlight), -1 = no scores
function usedPlayer(i: number): 0 | 1 | 2 | -1 {
  if (!props.bbbPlayers) return -1
  const [p0, p1] = props.bbbPlayers
  const s0 = Number(p0.scores[i]) || 0
  const s1 = Number(p1.scores[i]) || 0
  if (s0 <= 0 && s1 <= 0) return -1
  if (s0 <= 0) return 1
  if (s1 <= 0) return 0
  const n0 = p0.net[i] ?? 99
  const n1 = p1.net[i] ?? 99
  if (n0 < n1) return 0
  if (n1 < n0) return 1
  return 2
}

function bbbCellClass(playerIdx: 0 | 1, i: number): string {
  const s = Number(props.bbbPlayers![playerIdx].scores[i]) || 0
  if (s <= 0) return 'bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600'
  const used = usedPlayer(i)
  if (used === 2 || used === playerIdx)
    return 'bg-green-100 dark:bg-green-900/40 text-stone-800 dark:text-stone-100'
  return 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500'
}

function bbbSectionGross(playerIdx: 0 | 1, indices: number[]): number {
  if (!props.bbbPlayers) return 0
  return indices.reduce((s, i) => s + (Number(props.bbbPlayers![playerIdx].scores[i]) || 0), 0)
}

function bbbHoleNet(i: number): string {
  if (!props.bbbPlayers) return ''
  const [p0, p1] = props.bbbPlayers
  const s0 = Number(p0.scores[i]) || 0
  const s1 = Number(p1.scores[i]) || 0
  if (s0 <= 0 && s1 <= 0) return ''
  const n0 = s0 > 0 ? (p0.net[i] ?? 99) : 99
  const n1 = s1 > 0 ? (p1.net[i] ?? 99) : 99
  const best = Math.min(n0, n1)
  if (props.appHandicap) return (best >= 0 ? '+' : '') + best.toFixed(1)
  const r = Math.round(best)
  if (r === 0) return 'E'
  return r > 0 ? `+${r}` : String(r)
}

function bbbHoleNetClass(i: number): string {
  if (!props.bbbPlayers) return 'invisible'
  const [p0, p1] = props.bbbPlayers
  const s0 = Number(p0.scores[i]) || 0
  const s1 = Number(p1.scores[i]) || 0
  if (s0 <= 0 && s1 <= 0) return 'invisible'
  const n0 = s0 > 0 ? (p0.net[i] ?? 99) : 99
  const n1 = s1 > 0 ? (p1.net[i] ?? 99) : 99
  const best = Math.min(n0, n1)
  if (best < -0.05) return 'text-green-600 dark:text-green-400'
  if (best > 0.05)  return 'text-rose-500 dark:text-rose-400'
  return 'text-stone-400 dark:text-stone-500'
}

function bbbSectionNet(indices: number[]): number {
  if (!props.bbbPlayers) return 0
  const [p0, p1] = props.bbbPlayers
  return indices.reduce((sum, i) => {
    const s0 = Number(p0.scores[i]) || 0
    const s1 = Number(p1.scores[i]) || 0
    if (s0 <= 0 && s1 <= 0) return sum
    const n0 = s0 > 0 ? (p0.net[i] ?? 99) : 99
    const n1 = s1 > 0 ? (p1.net[i] ?? 99) : 99
    return sum + Math.min(n0, n1)
  }, 0)
}

// ── Legend ────────────────────────────────────────────────────
const legend = computed(() => {
  const items = []
  if (hasGrossSkins.value)  items.push({ label: 'G', color: 'text-amber-600 dark:text-amber-400',    desc: 'Gross Skin' })
  if (hasNetSkins.value)    items.push({ label: 'N', color: 'text-emerald-600 dark:text-emerald-400', desc: 'Net Skin' })
  if (hasDeucePot.value)    items.push({ label: 'D', color: 'text-sky-600 dark:text-sky-400',         desc: 'Deuce Pot' })
  if (hasYearlyDeuce.value) items.push({ label: '2', color: 'text-violet-600 dark:text-violet-400',   desc: 'Net Deuce' })
  if (hasYearlyBirds.value) items.push({ label: '#', color: 'text-lime-600 dark:text-lime-400',       desc: 'Birds pts' })
  if (hasChicago.value)     items.push({ label: '#', color: 'text-orange-500 dark:text-orange-400',   desc: 'Chicago pts' })
  return items
})
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="isBbb && bbbPlayers ? `${bbbPlayers[0].fname} ${bbbPlayers[0].lname} / ${bbbPlayers[1].fname} ${bbbPlayers[1].lname}` : player ? `${player.fname} ${player.lname}` : ''"
    :ui="{ content: 'max-w-[96vw] sm:max-w-lg' }"
  >
    <template #body>

      <!-- ══ Blind Best Ball scorecard ══════════════════════════ -->
      <div v-if="isBbb && bbbPlayers" class="space-y-4 -mt-1 pb-1">

        <!-- Subtitles -->
        <div class="grid grid-cols-2 gap-1 -mt-2 text-[11px] text-stone-400">
          <span>{{ bbbPlayers[0].fname }} {{ bbbPlayers[0].lname }} · Hdcp {{ fmtHdcp(bbbPlayers[0].playing_handicap) }}</span>
          <span>{{ bbbPlayers[1].fname }} {{ bbbPlayers[1].lname }} · Hdcp {{ fmtHdcp(bbbPlayers[1].playing_handicap) }}</span>
        </div>

        <!-- Front 9 -->
        <table class="w-full table-fixed text-center text-xs border-collapse">
          <thead>
            <tr>
              <th class="text-left text-stone-400 font-normal pb-1" style="width:26px"></th>
              <th v-for="i in frontIdx" :key="i" class="font-semibold text-stone-500 dark:text-stone-400 pb-1">{{ i + 1 }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-left text-stone-400 text-[11px] py-1">Par</td>
              <td v-for="i in frontIdx" :key="i" class="text-stone-400 text-[11px] py-1">{{ bbbPlayers[0].pars[i] ?? '–' }}</td>
            </tr>
            <tr>
              <!-- Label column: spacers mirror the cell row heights -->
              <td class="text-left align-top pr-1">
                <div class="h-1.5"></div>
                <div class="flex items-center h-7 text-stone-400 text-[10px] font-medium leading-none">{{ bbbPlayers[0].fname[0] }}{{ bbbPlayers[0].lname[0] }}</div>
                <div class="h-2"></div>
                <div class="flex items-center h-7 text-stone-400 text-[10px] font-medium leading-none">{{ bbbPlayers[1].fname[0] }}{{ bbbPlayers[1].lname[0] }}</div>
                <div class="h-3"></div>
              </td>
              <td v-for="i in frontIdx" :key="i" class="px-0.5 pb-0">
                <!-- Player 1 pops + score -->
                <div class="flex justify-center gap-0.5 h-1.5 items-center">
                  <span v-for="n in (bbbPlayers[0].pops[i] ?? 0)" :key="n" class="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500 inline-block" />
                </div>
                <div class="flex items-center justify-center h-7 w-full rounded text-sm font-bold" :class="bbbCellClass(0, i)">
                  {{ Number(bbbPlayers[0].scores[i]) > 0 ? bbbPlayers[0].scores[i] : '–' }}
                </div>
                <!-- Player 2 pops + score -->
                <div class="flex justify-center gap-0.5 h-1.5 items-center mt-0.5">
                  <span v-for="n in (bbbPlayers[1].pops[i] ?? 0)" :key="n" class="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500 inline-block" />
                </div>
                <div class="flex items-center justify-center h-7 w-full rounded text-sm font-bold" :class="bbbCellClass(1, i)">
                  {{ Number(bbbPlayers[1].scores[i]) > 0 ? bbbPlayers[1].scores[i] : '–' }}
                </div>
                <!-- BBB best net per hole -->
                <div class="text-[9px] tabular-nums leading-none mt-0.5 text-center" :class="bbbHoleNetClass(i)">
                  {{ bbbHoleNet(i) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Back 9 -->
        <table v-if="totalHoles === 18" class="w-full table-fixed text-center text-xs border-collapse">
          <thead>
            <tr>
              <th class="text-left text-stone-400 font-normal pb-1" style="width:26px"></th>
              <th v-for="i in backIdx" :key="i" class="font-semibold text-stone-500 dark:text-stone-400 pb-1">{{ i + 1 }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-left text-stone-400 text-[11px] py-1">Par</td>
              <td v-for="i in backIdx" :key="i" class="text-stone-400 text-[11px] py-1">{{ bbbPlayers[0].pars[i] ?? '–' }}</td>
            </tr>
            <tr>
              <!-- Label column: spacers mirror the cell row heights -->
              <td class="text-left align-top pr-1">
                <div class="h-1.5"></div>
                <div class="flex items-center h-7 text-stone-400 text-[10px] font-medium leading-none">{{ bbbPlayers[0].fname[0] }}{{ bbbPlayers[0].lname[0] }}</div>
                <div class="h-2"></div>
                <div class="flex items-center h-7 text-stone-400 text-[10px] font-medium leading-none">{{ bbbPlayers[1].fname[0] }}{{ bbbPlayers[1].lname[0] }}</div>
                <div class="h-3"></div>
              </td>
              <td v-for="i in backIdx" :key="i" class="px-0.5 pb-0">
                <!-- Player 1 pops + score -->
                <div class="flex justify-center gap-0.5 h-1.5 items-center">
                  <span v-for="n in (bbbPlayers[0].pops[i] ?? 0)" :key="n" class="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500 inline-block" />
                </div>
                <div class="flex items-center justify-center h-7 w-full rounded text-sm font-bold" :class="bbbCellClass(0, i)">
                  {{ Number(bbbPlayers[0].scores[i]) > 0 ? bbbPlayers[0].scores[i] : '–' }}
                </div>
                <!-- Player 2 pops + score -->
                <div class="flex justify-center gap-0.5 h-1.5 items-center mt-0.5">
                  <span v-for="n in (bbbPlayers[1].pops[i] ?? 0)" :key="n" class="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500 inline-block" />
                </div>
                <div class="flex items-center justify-center h-7 w-full rounded text-sm font-bold" :class="bbbCellClass(1, i)">
                  {{ Number(bbbPlayers[1].scores[i]) > 0 ? bbbPlayers[1].scores[i] : '–' }}
                </div>
                <!-- BBB best net per hole -->
                <div class="text-[9px] tabular-nums leading-none mt-0.5 text-center" :class="bbbHoleNetClass(i)">
                  {{ bbbHoleNet(i) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- BBB Totals -->
        <div class="space-y-1 text-xs pt-2 border-t border-stone-100 dark:border-stone-800">
          <div v-for="(bp, pi) in bbbPlayers" :key="bp.player_id" class="grid grid-cols-[1fr_3rem_3rem_3.5rem] gap-x-2 text-stone-500 dark:text-stone-400">
            <span class="truncate">{{ bp.fname }} {{ bp.lname }}</span>
            <span class="text-right tabular-nums">{{ bbbSectionGross(pi as 0|1, frontIdx) || '—' }}</span>
            <span v-if="totalHoles === 18" class="text-right tabular-nums">{{ bbbSectionGross(pi as 0|1, backIdx) || '—' }}</span>
            <span class="text-right tabular-nums font-semibold text-stone-700 dark:text-stone-200">{{ bp.totalGross || '—' }}</span>
          </div>
          <div class="grid grid-cols-[1fr_3rem_3rem_3.5rem] gap-x-2 pt-1 border-t border-stone-100 dark:border-stone-800">
            <span class="font-semibold text-stone-600 dark:text-stone-300">BBB Net</span>
            <span class="text-right tabular-nums font-semibold" :class="bbbSectionNet(frontIdx) < -0.05 ? 'text-green-600 dark:text-green-400' : bbbSectionNet(frontIdx) > 0.05 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500'">{{ fmtNetTotal(bbbSectionNet(frontIdx)) }}</span>
            <span v-if="totalHoles === 18" class="text-right tabular-nums font-semibold" :class="bbbSectionNet(backIdx) < -0.05 ? 'text-green-600 dark:text-green-400' : bbbSectionNet(backIdx) > 0.05 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500'">{{ fmtNetTotal(bbbSectionNet(backIdx)) }}</span>
            <span class="text-right tabular-nums font-semibold" :class="bbbSectionNet([...frontIdx, ...backIdx]) < -0.05 ? 'text-green-600 dark:text-green-400' : bbbSectionNet([...frontIdx, ...backIdx]) > 0.05 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500'">{{ fmtNetTotal(bbbSectionNet([...frontIdx, ...backIdx])) }}</span>
          </div>
        </div>

        <!-- Key -->
        <p class="text-[10px] text-stone-300 dark:text-stone-600">Green = score used in best ball</p>
      </div>

      <!-- ══ Single player scorecard ═════════════════════════════ -->
      <div v-else-if="player" class="space-y-4 -mt-1 pb-1">

        <!-- Subtitle: hdcp + tees -->
        <p class="text-xs text-stone-400 -mt-2">
          Hdcp {{ fmtHdcp(player.playing_handicap) }}
          <template v-if="player.tee_name"> · {{ player.tee_name }}</template>
        </p>

        <!-- ── Scorecard table macro ─────────────────────────────
             Reused for front 9 and back 9. Each score cell contains:
               [pops dots]   ← above the box
               [scorebox]    ← circle/square decoration + corner badges
               [net/hole]    ← below the box
        ─────────────────────────────────────────────────────── -->

        <!-- Front 9 -->
        <table class="w-full table-fixed text-center text-xs border-collapse">
          <thead>
            <tr>
              <th class="text-left text-stone-400 font-normal pb-1" style="width:26px"></th>
              <th v-for="i in frontIdx" :key="i" class="font-semibold text-stone-500 dark:text-stone-400 pb-1">{{ i + 1 }}</th>
            </tr>
          </thead>
          <tbody>
            <!-- Par row -->
            <tr>
              <td class="text-left text-stone-400 text-[11px] py-1">Par</td>
              <td v-for="i in frontIdx" :key="i" class="text-stone-400 text-[11px] py-1">{{ player.pars[i] ?? '–' }}</td>
            </tr>
            <!-- Score row -->
            <tr>
              <td class="text-left text-stone-400 text-[11px] align-middle pr-1">Sc</td>
              <td v-for="i in frontIdx" :key="i" class="px-0.5 pb-0">

                <!-- Pops dots above scorebox -->
                <div class="flex justify-center gap-0.5 h-2 items-center">
                  <span
                    v-for="n in (player.pops[i] ?? 0)" :key="n"
                    class="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500 inline-block"
                  />
                </div>

                <!-- Scorebox: badges in corners, decoration centered -->
                <div class="relative flex items-center justify-center h-8 w-full rounded bg-stone-100 dark:bg-stone-800">
                  <!-- TL: G + birds -->
                  <div class="absolute top-0 left-0 flex flex-col gap-px z-10">
                    <span v-if="grossWin(i)"    class="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-100 dark:bg-amber-900/70 text-amber-700 dark:text-amber-300 text-[7px] font-black leading-none">G</span>
                    <span v-if="birdPts(i) > 0" class="flex items-center justify-center min-w-3.5 h-3.5 px-0.5 rounded-full bg-lime-100 dark:bg-lime-900/70 text-lime-700 dark:text-lime-300 text-[7px] font-black leading-none">{{ fmtBirdVal(birdPts(i)) }}</span>
                  </div>
                  <!-- TR: N -->
                  <span v-if="netWin(i)" class="absolute top-0 right-0 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 text-[7px] font-black leading-none z-10">N</span>
                  <!-- BL: D + chi (D pinned to corner, chi stacked above) -->
                  <div class="absolute bottom-0 left-0 flex flex-col-reverse gap-px z-10">
                    <span v-if="deuceWin(i)"   class="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sky-100 dark:bg-sky-900/70 text-sky-700 dark:text-sky-300 text-[7px] font-black leading-none">D</span>
                    <span v-if="chiPts(i) > 0" class="flex items-center justify-center min-w-3.5 h-3.5 px-0.5 rounded-full bg-orange-100 dark:bg-orange-900/70 text-orange-700 dark:text-orange-300 text-[7px] font-black leading-none">{{ chiPts(i) }}</span>
                  </div>
                  <!-- BR: 2 -->
                  <span v-if="netDeuce(i)" class="absolute bottom-0 right-0 flex items-center justify-center min-w-3.5 h-3.5 px-0.5 rounded-full bg-violet-100 dark:bg-violet-900/70 text-violet-700 dark:text-violet-300 text-[7px] font-black leading-none z-10">2</span>

                  <!-- Eagle: double circle -->
                  <span v-if="grossDeco(i) === 'eagle'"
                    class="flex items-center justify-center rounded-full border border-stone-700 dark:border-stone-300 w-7 h-7 p-0.5">
                    <span class="flex items-center justify-center rounded-full border border-stone-700 dark:border-stone-300 w-full h-full text-xs font-bold text-stone-800 dark:text-stone-100 leading-none">{{ scoreText(i) }}</span>
                  </span>
                  <!-- Birdie: single circle -->
                  <span v-else-if="grossDeco(i) === 'birdie'"
                    class="flex items-center justify-center rounded-full border border-stone-700 dark:border-stone-300 w-6 h-6 text-sm font-bold text-stone-800 dark:text-stone-100 leading-none">
                    {{ scoreText(i) }}
                  </span>
                  <!-- Bogey: single square -->
                  <span v-else-if="grossDeco(i) === 'bogey'"
                    class="flex items-center justify-center border border-stone-700 dark:border-stone-300 w-6 h-6 text-sm font-bold text-stone-800 dark:text-stone-100 leading-none">
                    {{ scoreText(i) }}
                  </span>
                  <!-- Double bogey+: double square -->
                  <span v-else-if="grossDeco(i) === 'double'"
                    class="flex items-center justify-center border border-stone-700 dark:border-stone-300 w-7 h-7 p-0.5">
                    <span class="flex items-center justify-center border border-stone-700 dark:border-stone-300 w-full h-full text-xs font-bold text-stone-800 dark:text-stone-100 leading-none">{{ scoreText(i) }}</span>
                  </span>
                  <!-- Par: plain -->
                  <span v-else class="text-sm font-bold text-stone-800 dark:text-stone-100 leading-none">{{ scoreText(i) }}</span>
                </div>

                <!-- Net per hole below scorebox -->
                <div class="text-[9px] tabular-nums leading-none mt-0.5 text-center" :class="holeNetClass(i)">
                  {{ fmtHoleNet(i) }}
                </div>

              </td>
            </tr>
          </tbody>
        </table>

        <!-- Back 9 -->
        <table v-if="totalHoles === 18" class="w-full table-fixed text-center text-xs border-collapse">
          <thead>
            <tr>
              <th class="text-left text-stone-400 font-normal pb-1" style="width:26px"></th>
              <th v-for="i in backIdx" :key="i" class="font-semibold text-stone-500 dark:text-stone-400 pb-1">{{ i + 1 }}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-left text-stone-400 text-[11px] py-1">Par</td>
              <td v-for="i in backIdx" :key="i" class="text-stone-400 text-[11px] py-1">{{ player.pars[i] ?? '–' }}</td>
            </tr>
            <tr>
              <td class="text-left text-stone-400 text-[11px] align-middle pr-1">Sc</td>
              <td v-for="i in backIdx" :key="i" class="px-0.5 pb-0">

                <div class="flex justify-center gap-0.5 h-2 items-center">
                  <span
                    v-for="n in (player.pops[i] ?? 0)" :key="n"
                    class="w-1 h-1 rounded-full bg-stone-400 dark:bg-stone-500 inline-block"
                  />
                </div>

                <div class="relative flex items-center justify-center h-8 w-full rounded bg-stone-100 dark:bg-stone-800">
                  <!-- TL: G + birds -->
                  <div class="absolute top-0 left-0 flex flex-col gap-px z-10">
                    <span v-if="grossWin(i)"    class="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-amber-100 dark:bg-amber-900/70 text-amber-700 dark:text-amber-300 text-[7px] font-black leading-none">G</span>
                    <span v-if="birdPts(i) > 0" class="flex items-center justify-center min-w-3.5 h-3.5 px-0.5 rounded-full bg-lime-100 dark:bg-lime-900/70 text-lime-700 dark:text-lime-300 text-[7px] font-black leading-none">{{ fmtBirdVal(birdPts(i)) }}</span>
                  </div>
                  <!-- TR: N -->
                  <span v-if="netWin(i)" class="absolute top-0 right-0 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-100 dark:bg-emerald-900/70 text-emerald-700 dark:text-emerald-300 text-[7px] font-black leading-none z-10">N</span>
                  <!-- BL: D + chi (D pinned to corner, chi stacked above) -->
                  <div class="absolute bottom-0 left-0 flex flex-col-reverse gap-px z-10">
                    <span v-if="deuceWin(i)"   class="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sky-100 dark:bg-sky-900/70 text-sky-700 dark:text-sky-300 text-[7px] font-black leading-none">D</span>
                    <span v-if="chiPts(i) > 0" class="flex items-center justify-center min-w-3.5 h-3.5 px-0.5 rounded-full bg-orange-100 dark:bg-orange-900/70 text-orange-700 dark:text-orange-300 text-[7px] font-black leading-none">{{ chiPts(i) }}</span>
                  </div>
                  <!-- BR: 2 -->
                  <span v-if="netDeuce(i)" class="absolute bottom-0 right-0 flex items-center justify-center min-w-3.5 h-3.5 px-0.5 rounded-full bg-violet-100 dark:bg-violet-900/70 text-violet-700 dark:text-violet-300 text-[7px] font-black leading-none z-10">2</span>

                  <span v-if="grossDeco(i) === 'eagle'"
                    class="flex items-center justify-center rounded-full border border-stone-700 dark:border-stone-300 w-7 h-7 p-0.5">
                    <span class="flex items-center justify-center rounded-full border border-stone-700 dark:border-stone-300 w-full h-full text-xs font-bold text-stone-800 dark:text-stone-100 leading-none">{{ scoreText(i) }}</span>
                  </span>
                  <span v-else-if="grossDeco(i) === 'birdie'"
                    class="flex items-center justify-center rounded-full border border-stone-700 dark:border-stone-300 w-6 h-6 text-sm font-bold text-stone-800 dark:text-stone-100 leading-none">
                    {{ scoreText(i) }}
                  </span>
                  <span v-else-if="grossDeco(i) === 'bogey'"
                    class="flex items-center justify-center border border-stone-700 dark:border-stone-300 w-6 h-6 text-sm font-bold text-stone-800 dark:text-stone-100 leading-none">
                    {{ scoreText(i) }}
                  </span>
                  <span v-else-if="grossDeco(i) === 'double'"
                    class="flex items-center justify-center border border-stone-700 dark:border-stone-300 w-7 h-7 p-0.5">
                    <span class="flex items-center justify-center border border-stone-700 dark:border-stone-300 w-full h-full text-xs font-bold text-stone-800 dark:text-stone-100 leading-none">{{ scoreText(i) }}</span>
                  </span>
                  <span v-else class="text-sm font-bold text-stone-800 dark:text-stone-100 leading-none">{{ scoreText(i) }}</span>
                </div>

                <div class="text-[9px] tabular-nums leading-none mt-0.5 text-center" :class="holeNetClass(i)">
                  {{ fmtHoleNet(i) }}
                </div>

              </td>
            </tr>
          </tbody>
        </table>

        <!-- ── Totals ──────────────────────────────────────────── -->
        <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs pt-2 border-t border-stone-100 dark:border-stone-800">
          <div class="flex justify-between items-baseline">
            <span class="text-stone-400">{{ totalHoles === 18 ? 'Front' : 'Total' }}</span>
            <span class="font-semibold text-stone-700 dark:text-stone-200 tabular-nums">
              {{ sectionGross(frontIdx) || '—' }}
              <span class="text-stone-400 font-normal">({{ sectionPar(frontIdx) }})</span>
            </span>
          </div>
          <div v-if="totalHoles === 18" class="flex justify-between items-baseline">
            <span class="text-stone-400">Back</span>
            <span class="font-semibold text-stone-700 dark:text-stone-200 tabular-nums">
              {{ sectionGross(backIdx) || '—' }}
              <span class="text-stone-400 font-normal">({{ sectionPar(backIdx) }})</span>
            </span>
          </div>
          <div
            class="flex justify-between items-baseline"
            :class="totalHoles === 18 ? 'col-span-2 border-t border-stone-100 dark:border-stone-800 pt-1.5' : ''"
          >
            <span class="text-stone-400">{{ totalHoles === 18 ? 'Total' : 'Net' }}</span>
            <span class="font-semibold text-stone-700 dark:text-stone-200 tabular-nums">
              {{ totalHoles === 18 ? (player.totalGross || '—') : fmtNetTotal(player.totalNet) }}
              <template v-if="totalHoles === 18">
                <span class="text-stone-400 font-normal">({{ sectionPar(frontIdx) + sectionPar(backIdx) }})</span>
              </template>
            </span>
          </div>
          <div v-if="totalHoles === 18" class="flex justify-between items-baseline">
            <span class="text-stone-400">Net</span>
            <span
              class="font-semibold tabular-nums"
              :class="player.totalNet < -0.05 ? 'text-green-600 dark:text-green-400' : player.totalNet > 0.05 ? 'text-rose-600 dark:text-rose-400' : 'text-stone-600 dark:text-stone-300'"
            >{{ fmtNetTotal(player.totalNet) }}</span>
          </div>
          <div v-if="hasYearlyBirds" class="flex justify-between items-baseline">
            <span class="text-stone-400">Birds</span>
            <span class="font-semibold text-lime-600 dark:text-lime-400 tabular-nums">{{ fmtBirdVal(player.totalBirds) }}</span>
          </div>
          <div v-if="hasYearlyDeuce" class="flex justify-between items-baseline">
            <span class="text-stone-400">Net Deuces</span>
            <span class="font-semibold text-violet-600 dark:text-violet-400 tabular-nums">{{ player.totalDeuces }}</span>
          </div>
          <div v-if="hasChicago" class="flex justify-between items-baseline">
            <span class="text-stone-400">Chicago</span>
            <span class="font-semibold text-orange-500 dark:text-orange-400 tabular-nums">{{ player.totalChicago }}</span>
          </div>
        </div>

        <!-- ── Legend ──────────────────────────────────────────── -->
        <div v-if="legend.length" class="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-stone-400 pt-1.5 border-t border-stone-100 dark:border-stone-800">
          <span v-for="item in legend" :key="item.desc" class="flex items-center gap-1">
            <span class="font-black" :class="item.color">{{ item.label }}</span>
            <span>{{ item.desc }}</span>
          </span>
          <span class="text-stone-300 dark:text-stone-600 text-[9px]">· dot = stroke received</span>
        </div>

      </div>
    </template>
  </UModal>
</template>
