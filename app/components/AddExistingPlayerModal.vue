<script setup lang="ts">
const props = defineProps<{
  leagueId:      string
  leagueTeeType: string
}>()

const emit = defineEmits<{ saved: [] }>()
const toast = useToast()

const isOpen   = ref(false)
const isSaving = ref(false)
const error    = ref<string | null>(null)

const isLocked = computed(() => props.leagueTeeType !== 'mixed')

interface PlayerResult { id: string; fname: string; lname: string; ghin: number | null }

const searchQuery   = ref('')
const searchResults = ref<PlayerResult[]>([])
const isSearching   = ref(false)
const selected      = ref<PlayerResult | null>(null)
const teeType       = ref('mens')

// Debounced search
let searchTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (q) => {
  selected.value = null
  searchResults.value = []
  if (searchTimer) clearTimeout(searchTimer)
  if (q.trim().length < 2) return

  isSearching.value = true
  searchTimer = setTimeout(async () => {
    try {
      const res = await $fetch<{ players: PlayerResult[] }>(
        `/api/leagues/${props.leagueId}/players/search`,
        { query: { q: q.trim() } },
      )
      searchResults.value = res.players
    }
    catch {
      searchResults.value = []
    }
    finally {
      isSearching.value = false
    }
  }, 300)
})

watch(isOpen, (open) => {
  if (open) return
  searchQuery.value   = ''
  searchResults.value = []
  selected.value      = null
  teeType.value       = 'mens'
  error.value         = null
})

async function add() {
  if (!selected.value) return
  error.value  = null
  isSaving.value = true

  try {
    await $fetch(`/api/leagues/${props.leagueId}/members`, {
      method: 'POST',
      body: {
        player_id: selected.value.id,
        tee_type:  isLocked.value ? props.leagueTeeType : teeType.value,
      },
    })
    toast.add({
      title:       'Player added',
      description: `${selected.value.fname} ${selected.value.lname} has been added to the roster`,
      color:       'success',
      duration:    2500,
    })
    emit('saved')
    isOpen.value = false
  }
  catch (err: any) {
    error.value = err?.data?.statusMessage ?? 'Failed to add player. Please try again.'
  }
  finally {
    isSaving.value = false
  }
}

const teeOptions = ['mens', 'ladies', 'senior'] as const
</script>

<template>
  <UModal v-model:open="isOpen" title="Add Existing Player" :ui="{ content: 'max-w-sm' }">
    <UButton
      label="Add Existing"
      icon="i-lucide-user-search"
      color="neutral"
      variant="soft"
      size="sm"
    />

    <template #body>
      <div class="space-y-4">

        <UAlert v-if="error" color="error" :description="error" icon="i-lucide-alert-circle" />

        <!-- Search -->
        <UFormField label="Search by name">
          <UInput
            v-model="searchQuery"
            placeholder="Type a name…"
            icon="i-lucide-search"
            autocomplete="off"
          />
        </UFormField>

        <!-- Results -->
        <div v-if="isSearching" class="text-sm text-stone-400 text-center py-2">
          Searching…
        </div>

        <div v-else-if="searchResults.length > 0" class="space-y-1 max-h-48 overflow-y-auto">
          <button
            v-for="p in searchResults"
            :key="p.id"
            type="button"
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg
                   text-left transition-colors"
            :class="selected?.id === p.id
              ? 'bg-primary-50 dark:bg-primary-900/20 ring-1 ring-primary-400 dark:ring-primary-600'
              : 'hover:bg-stone-50 dark:hover:bg-stone-800'"
            @click="selected = p"
          >
            <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
              {{ p.fname }} {{ p.lname }}
            </span>
            <span class="text-xs text-stone-400 dark:text-stone-500 font-mono">
              {{ p.ghin ?? '—' }}
            </span>
          </button>
        </div>

        <p
          v-else-if="searchQuery.trim().length >= 2 && !isSearching"
          class="text-sm text-stone-400 text-center py-2"
        >
          No players found
        </p>

        <!-- Tee type (only for mixed leagues) -->
        <UFormField v-if="selected && !isLocked" label="Tee Type">
          <div class="flex rounded-lg overflow-hidden ring-1 ring-stone-200 dark:ring-stone-800">
            <button
              v-for="tee in teeOptions"
              :key="tee"
              type="button"
              class="flex-1 py-1.5 text-sm font-medium transition-colors capitalize"
              :class="teeType === tee
                ? 'bg-primary-500 text-white'
                : 'bg-white text-stone-700 hover:bg-stone-50 dark:bg-stone-900 dark:text-stone-300'"
              @click="teeType = tee"
            >
              {{ tee }}
            </button>
          </div>
        </UFormField>

      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="isOpen = false" />
        <UButton
          label="Add to League"
          color="primary"
          icon="i-lucide-user-plus"
          :disabled="!selected"
          :loading="isSaving"
          @click="add"
        />
      </div>
    </template>
  </UModal>
</template>
