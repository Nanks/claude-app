<script setup lang="ts">
interface HoleInfo {
  hole: number
  par:  number
  hnd:  number
}

interface ScorecardPlayer {
  score_id:         string
  player_id:        string
  fname:            string
  lname:            string
  playing_handicap: number
  pops:             number[]
  pars:             number[]
  scores:           (number | null)[]
}

const props = defineProps<{
  holeIdx:  number
  holeInfo: HoleInfo
  players:  ScorecardPlayer[]
}>()

const emit = defineEmits<{ saved: []; close: [] }>()

const isOpen = ref(true)
const isBusy = ref(false)
const errMsg = ref('')

// Local editable scores keyed by score_id
const local = ref<Record<string, number | null>>({})

watch(
  () => props.players,
  (players) => {
    const init: Record<string, number | null> = {}
    for (const p of players) init[p.score_id] = p.scores[props.holeIdx] ?? null
    local.value = init
  },
  { immediate: true },
)

function playerPar(scoreId: string): number {
  const p = props.players.find(pl => pl.score_id === scoreId)
  return p?.pars[props.holeIdx] ?? props.holeInfo.par
}

function increment(scoreId: string) {
  const cur = local.value[scoreId]
  if (cur === null) local.value[scoreId] = playerPar(scoreId)
  else if (cur < 15) local.value[scoreId] = cur + 1
}

function decrement(scoreId: string) {
  const cur = local.value[scoreId]
  if (cur === null) local.value[scoreId] = playerPar(scoreId)
  else if (cur <= 1) local.value[scoreId] = null
  else local.value[scoreId] = cur - 1
}

function scoreRelClass(scoreId: string): string {
  const score = local.value[scoreId]
  if (!score) return 'text-stone-300 dark:text-stone-600'
  const d = score - playerPar(scoreId)
  if (d <= -2) return 'text-amber-500 dark:text-amber-400'
  if (d === -1) return 'text-green-600 dark:text-green-400'
  if (d === 0)  return 'text-stone-700 dark:text-stone-200'
  if (d === 1)  return 'text-red-400 dark:text-red-400'
  return 'text-red-600 dark:text-red-400'
}

async function save() {
  isBusy.value = true
  errMsg.value = ''
  try {
    const updates = Object.entries(local.value).map(([score_id, value]) => ({
      score_id,
      hole: props.holeIdx + 1,
      value,
    }))
    await $fetch('/api/me/scores', { method: 'PATCH', body: { updates } })
    isOpen.value = false
    emit('saved')
  } catch (e: any) {
    errMsg.value = e?.data?.statusMessage ?? 'Could not save. Try again.'
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :dismissible="true"
    :ui="{ content: 'max-w-sm' }"
    @update:open="(v) => { if (!v) emit('close') }"
  >
    <template #content>
      <div class="p-5 space-y-5">

        <!-- Hole header -->
        <div class="text-center">
          <h3 class="text-xl font-bold text-stone-800 dark:text-stone-100">
            Hole {{ holeInfo.hole }}
          </h3>
          <p class="text-sm text-stone-400 dark:text-stone-500">
            Stroke Index {{ holeInfo.hnd }}
          </p>
        </div>

        <UAlert v-if="errMsg" color="error" icon="i-lucide-alert-circle" :description="errMsg" />

        <!-- Players -->
        <div class="space-y-4">
          <div
            v-for="p in players"
            :key="p.score_id"
            class="flex items-center gap-3"
          >
            <!-- Name + pops -->
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline gap-1.5">
                <p class="text-sm font-medium text-stone-800 dark:text-stone-100 leading-tight truncate">
                  {{ p.fname }} {{ p.lname }}
                </p>
                <span class="text-[10px] text-stone-400 dark:text-stone-500 shrink-0">
                  Par {{ playerPar(p.score_id) }}
                </span>
              </div>
              <div class="flex items-center gap-0.5 mt-1 h-2">
                <span
                  v-for="n in (p.pops[holeIdx] ?? 0)"
                  :key="n"
                  class="w-1.5 h-1.5 rounded-full bg-stone-400 dark:bg-stone-500 block"
                />
                <span
                  v-if="!(p.pops[holeIdx] ?? 0)"
                  class="text-[9px] text-stone-300 dark:text-stone-600"
                >no pops</span>
              </div>
            </div>

            <!-- Score stepper -->
            <div class="flex items-center gap-2 shrink-0">
              <button
                class="w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center
                       text-stone-600 dark:text-stone-300 active:scale-95 transition-transform"
                :disabled="isBusy"
                @click="decrement(p.score_id)"
              >
                <UIcon name="i-lucide-minus" class="size-4" />
              </button>

              <span
                class="w-8 text-center text-xl font-bold tabular-nums select-none"
                :class="scoreRelClass(p.score_id)"
              >
                {{ local[p.score_id] ?? '–' }}
              </span>

              <button
                class="w-9 h-9 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center
                       text-stone-600 dark:text-stone-300 active:scale-95 transition-transform"
                :disabled="isBusy"
                @click="increment(p.score_id)"
              >
                <UIcon name="i-lucide-plus" class="size-4" />
              </button>
            </div>
          </div>
        </div>

        <UButton
          label="Save"
          color="primary"
          block
          :loading="isBusy"
          icon="i-lucide-check"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
