<script setup lang="ts">
// components/AdminPlayerModal.vue
// Used in manage mode on the roster page.
// - No player prop = Add mode (creates player + league membership)
// - Player prop = Edit mode (updates existing player)
// The player shape matches the roster server route output, not the raw DB type.

interface RosterPlayer {
  id:        string
  firstName: string
  lastName:  string
  phone:     string
  ghin:      number | null
  teeType:   string
  isAdmin:   boolean
  handicap:  number | string | null
  joinedAt:  string
}

const props = defineProps<{
  player?:        RosterPlayer | null
  leagueId:       string
  existingRoster: RosterPlayer[]
  leagueTeeType:  string   // 'mixed' lets the admin pick per player; anything else locks it
}>()

const isLocked = computed(() => props.leagueTeeType !== 'mixed')

const emit  = defineEmits<{ saved: [] }>()
const toast = useToast()

const isOpen  = ref(false)
const isSaving = ref(false)
const error    = ref<string | null>(null)

const isEditMode = computed(() => !!props.player)

const form = reactive({
  fname:    '',
  lname:    '',
  phone:    '',
  ghin:     null as number | null,
  tee_type: 'mens' as string,
  active:   true,
})

// Reset form when modal opens
watch(isOpen, (open) => {
  if (!open) return
  error.value = null

  if (props.player) {
    form.fname    = props.player.firstName
    form.lname    = props.player.lastName
    form.phone    = props.player.phone
    form.ghin     = props.player.ghin
    form.tee_type = isLocked.value ? props.leagueTeeType : props.player.teeType
    form.active   = true  // active is always true if they appear on roster
  } else {
    form.fname    = ''
    form.lname    = ''
    form.phone    = ''
    form.ghin     = null
    form.tee_type = isLocked.value ? props.leagueTeeType : 'mens'
    form.active   = true
  }
})

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

async function save() {
  error.value = null

  if (!form.fname.trim() || !form.lname.trim()) {
    error.value = 'First and last name are required'
    return
  }

  // Validate GHIN
  if (form.ghin === null || form.ghin < 0 || form.ghin > 54) {
    error.value = 'GHIN must be between 0 and 54.0'
    return
  }

  // Validate phone only if provided
  const formattedPhone = form.phone.trim() ? normalizePhone(form.phone) : null
  if (form.phone.trim() && !formattedPhone) {
    error.value = 'Enter a valid 10-digit US phone number'
    return
  }

  isSaving.value = true

  try {
    const payload = {
      fname:    form.fname.trim(),
      lname:    form.lname.trim(),
      phone:    formattedPhone,
      ghin:     Math.round((form.ghin as number) * 10) / 10,
      tee_type: form.tee_type,
      active:   form.active,
    }

    if (isEditMode.value) {
      await $fetch(`/api/players/${props.player!.id}/admin-update`, {
        method: 'PUT',
        body:   payload,
      })
      toast.add({
        title:    'Player updated',
        color:    'success',
        duration: 2500,
      })
    } else {
      await $fetch(`/api/leagues/${props.leagueId}/players`, {
        method: 'POST',
        body:   payload,
      })
      toast.add({
        title:       'Player added',
        description: `${form.fname} ${form.lname} has been added to the roster`,
        color:       'success',
        duration:    2500,
      })
    }

    emit('saved')
    isOpen.value = false

  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || 'An error occurred'
  } finally {
    isSaving.value = false
  }
}

const teeOptions = ['mens', 'ladies', 'senior'] as const
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :title="isEditMode ? 'Edit Player' : 'Add Player'"
  >
    <!-- Trigger -->
    <UButton
      :label="isEditMode ? undefined : 'Add Player'"
      :icon="isEditMode ? 'i-lucide-settings' : 'i-lucide-user-plus'"
      :variant="isEditMode ? 'ghost' : 'solid'"
      :color="isEditMode ? 'neutral' : 'primary'"
      size="sm"
    />

    <template #body>
      <div class="space-y-3">

        <!-- Error -->
        <UAlert
          v-if="error"
          color="error"
          :description="error"
          icon="i-lucide-alert-circle"
        />

        <!-- Name -->
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="First Name">
            <UInput v-model="form.fname" autocomplete="off" />
          </UFormField>
          <UFormField label="Last Name">
            <UInput v-model="form.lname" autocomplete="off" />
          </UFormField>
        </div>

        <!-- Phone + GHIN -->
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Phone" hint="Optional">
            <UInput
              v-model="form.phone"
              type="tel"
              placeholder="(605) 555-1234"
              autocomplete="off"
            />
          </UFormField>
          <UFormField label="GHIN">
            <UInput
              v-model.number="form.ghin"
              type="number"
              step="0.1"
              min="0"
              max="54"
              placeholder="e.g. 12.4"
            />
          </UFormField>
        </div>

        <!-- Tee type -->
        <UFormField label="Tee Type">
          <div
            v-if="isLocked"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-sm font-medium text-stone-600 dark:text-stone-300 capitalize"
          >
            <UIcon name="i-lucide-lock" class="size-3.5 shrink-0" />
            {{ form.tee_type }} tees
            <span class="text-xs text-stone-400 dark:text-stone-500 normal-case">(set by league)</span>
          </div>
          <div v-else class="flex rounded-lg overflow-hidden ring-1 ring-stone-200 dark:ring-stone-800">
            <button
              v-for="tee in teeOptions"
              :key="tee"
              type="button"
              class="flex-1 py-1.5 text-sm font-medium transition-colors capitalize"
              :class="form.tee_type === tee
                ? 'bg-primary-500 text-white'
                : 'bg-white text-stone-700 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-300'"
              @click="form.tee_type = tee"
            >
              {{ tee }}
            </button>
          </div>
        </UFormField>

        <!-- Active — only shown in edit mode -->
        <UCheckbox
          v-if="isEditMode"
          v-model="form.active"
          label="Active Player"
        />

      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          @click="isOpen = false"
        />
        <UButton
          :label="isEditMode ? 'Save Changes' : 'Add Player'"
          color="primary"
          :loading="isSaving"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>