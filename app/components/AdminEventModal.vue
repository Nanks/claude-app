<script setup lang="ts">
// components/AdminEventModal.vue
// No event prop = Add mode; with event prop = Edit mode.

import type { EventStatus } from '~~/shared/types/database.types'

interface TeeOption   { id: string; name: string; tee_types: string[] }
interface CourseOption { id: string; name: string; tees: TeeOption[] }
interface GameType    { id: number; name: string }
interface LeagueDefaults { course_id: string; tees_id: string | null; holes: number; per: number; tee_type: string }

interface CalendarEvent {
  id:            string
  event_date:    string
  status:        EventStatus
  holes:         number
  per:           number
  money:         number
  course_id:     string
  tees_id:       string | null
  game_type_ids: number[]
}

const props = defineProps<{
  event?:    CalendarEvent | null
  leagueId:  string
  league:    LeagueDefaults
  courses:   CourseOption[]
  gameTypes: GameType[]
}>()

const emit  = defineEmits<{ saved: [] }>()
const toast = useToast()

const isOpen   = ref(false)
const isSaving = ref(false)
const error    = ref<string | null>(null)

const isEditMode = computed(() => !!props.event)

// Reka UI's SelectItem forbids an empty-string value ('' is reserved to mean
// "no selection / show placeholder"), so "mixed" uses this sentinel instead
// and is converted to/from null at the form boundary.
const MIXED_TEES = '__mixed__'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── Form state ────────────────────────────────────────────
const form = reactive({
  event_date:    '',
  course_id:     '',
  tees_id:       MIXED_TEES as string,
  status:        'scheduled' as EventStatus,
  holes:         18 as 9 | 18,
  per:           0,
  money:         0,
  game_type_ids: [] as number[],
})

const isMixedLeague = computed(() => props.league.tee_type === 'mixed')

// ── Course → tees cascade ─────────────────────────────────
// Mixed leagues never pick a real tee for an event — every event is just "Mixed".
// Leagues with a fixed tee_type only offer tees tagged for that tee_type —
// e.g. a mens-only league never shows ladies tees, and "None" is never an option.
function teesForCourse(courseId: string): TeeOption[] {
  if (isMixedLeague.value) return []
  const tees = props.courses.find((c) => c.id === courseId)?.tees ?? []
  return tees.filter((t) => t.tee_types?.includes(props.league.tee_type))
}

const availableTees = computed<TeeOption[]>(() => teesForCourse(form.course_id))

// Handle course change without a watcher — watchers fire pre-flush and
// can corrupt the USelect SelectContent DOM while it's still animating.
function onCourseChange(courseId: string) {
  form.course_id = courseId
  if (isMixedLeague.value) {
    form.tees_id = MIXED_TEES
    return
  }
  const tees = teesForCourse(courseId)
  if (!tees.some((t) => t.id === form.tees_id)) {
    form.tees_id = tees[0]?.id ?? ''
  }
}

// ── Select items ──────────────────────────────────────────
const courseItems = computed(() =>
  props.courses.map((c) => ({ label: c.name, value: c.id }))
)

const teeItems = computed(() => {
  if (isMixedLeague.value) return [{ label: 'Mixed', value: MIXED_TEES }]
  return availableTees.value.map((t) => ({ label: t.name, value: t.id }))
})

const statusItems: { label: string; value: EventStatus }[] = [
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'Live',      value: 'live'      },
  { label: 'Complete',  value: 'complete'  },
  { label: 'Practice',  value: 'practice'  },
  { label: 'Handicap',  value: 'handicap'  },
  { label: 'Rain',      value: 'rain'      },
  { label: 'Cancelled', value: 'cancelled' },
]

// ── Reset on open ─────────────────────────────────────────
watch(isOpen, (open) => {
  if (!open) return
  error.value = null

  if (props.event) {
    form.event_date    = props.event.event_date
    form.course_id     = props.event.course_id
    form.tees_id       = isMixedLeague.value
      ? MIXED_TEES
      : (props.event.tees_id ?? teesForCourse(props.event.course_id)[0]?.id ?? '')
    form.status        = props.event.status
    form.holes         = (props.event.holes === 9 ? 9 : 18)
    form.per           = props.event.per
    form.money         = props.event.money
    form.game_type_ids = [...props.event.game_type_ids]
  } else {
    form.event_date    = todayStr()
    form.course_id     = props.league.course_id
    form.tees_id       = isMixedLeague.value
      ? MIXED_TEES
      : (props.league.tees_id ?? teesForCourse(props.league.course_id)[0]?.id ?? '')
    form.status        = 'scheduled'
    form.holes         = (props.league.holes === 9 ? 9 : 18)
    form.per           = props.league.per
    form.money         = 1
    form.game_type_ids = []
  }
})

// ── Game toggle ───────────────────────────────────────────
function toggleGame(id: number) {
  const idx = form.game_type_ids.indexOf(id)
  if (idx === -1) form.game_type_ids.push(id)
  else form.game_type_ids.splice(idx, 1)
}

// ── Save ──────────────────────────────────────────────────
async function save() {
  error.value = null
  if (!form.event_date) {
    error.value = 'Date is required'
    return
  }

  isSaving.value = true
  try {
    const body = {
      event_date:    form.event_date,
      course_id:     form.course_id,
      tees_id:       form.tees_id === MIXED_TEES ? null : form.tees_id,
      status:        form.status,
      holes:         form.holes,
      per:           form.per,
      money:         form.money,
      game_type_ids: form.game_type_ids,
    }

    if (isEditMode.value) {
      await $fetch(`/api/events/${props.event!.id}`, { method: 'PUT', body })
      toast.add({ title: 'Event updated', color: 'success', duration: 2500 })
    } else {
      await $fetch(`/api/leagues/${props.leagueId}/events`, { method: 'POST', body })
      toast.add({ title: 'Event added', color: 'success', duration: 2500 })
    }

    emit('saved')
    isOpen.value = false
  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || 'An error occurred'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="isEditMode ? 'Edit Event' : 'Add Event'"
  >
    <!-- Trigger -->
    <UButton
      :label="isEditMode ? undefined : 'Add Event'"
      :icon="isEditMode ? 'i-lucide-pencil' : 'i-lucide-calendar-plus'"
      :variant="isEditMode ? 'ghost' : 'solid'"
      :color="isEditMode ? 'neutral' : 'primary'"
      size="sm"
    />

    <template #body>
      <div class="space-y-4">

        <UAlert
          v-if="error"
          color="error"
          :description="error"
          icon="i-lucide-alert-circle"
        />

        <!-- Date -->
        <UFormField label="Date">
          <UInput v-model="form.event_date" type="date" class="w-full" />
        </UFormField>

        <!-- Course + Tees -->
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Course">
            <USelect
              :model-value="form.course_id"
              :items="courseItems"
              class="w-full"
              @update:model-value="onCourseChange"
            />
          </UFormField>
          <UFormField label="Tees">
            <USelect
              v-model="form.tees_id"
              :items="teeItems"
              :disabled="teeItems.length <= 1"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Holes -->
        <UFormField label="Holes">
          <div class="flex rounded-lg overflow-hidden ring-1 ring-stone-200 dark:ring-stone-800">
            <button
              v-for="h in [9, 18]"
              :key="h"
              type="button"
              class="flex-1 py-1.5 text-sm font-medium transition-colors"
              :class="form.holes === h
                ? 'bg-primary-500 text-white'
                : 'bg-white text-stone-700 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-300'"
              @click="form.holes = h as 9 | 18"
            >
              {{ h }}
            </button>
          </div>
        </UFormField>

        <!-- Status -->
        <UFormField label="Status">
          <USelect v-model="form.status" :items="statusItems" class="w-full" />
        </UFormField>

        <!-- Games -->
        <UFormField v-if="gameTypes.length > 0" label="Games">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="gt in gameTypes"
              :key="gt.id"
              type="button"
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize"
              :class="form.game_type_ids.includes(gt.id)
                ? 'bg-sky-500 text-white'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'"
              @click="toggleGame(gt.id)"
            >
              {{ gt.name }}
            </button>
          </div>
        </UFormField>

        <!-- Per player + Money multiplier -->
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Per player ($)">
            <UInput
              v-model.number="form.per"
              type="number"
              min="0"
              step="0.5"
              placeholder="0"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Money (×)">
            <UInput
              v-model.number="form.money"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              class="w-full"
            />
          </UFormField>
        </div>

      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="isOpen = false" />
        <UButton
          :label="isEditMode ? 'Save Changes' : 'Add Event'"
          color="primary"
          :loading="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>
