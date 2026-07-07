<script setup lang="ts">
// PlayerDashboard.vue
// Displays the signed-in player's name and GHIN index.
// The GHIN edit modal is only shown to the player themselves.

interface Player {
  id:             string
  fname:          string
  lname:          string
  ghin:           number | null
  tee_type:       string
  is_super_admin: boolean
}

interface Props {
  player: Player
}

const props = defineProps<Props>()

// Local reactive copy of GHIN so the UI updates immediately after edit
const currentGhin = ref(props.player.ghin)

function onGhinUpdated(newGhin: number) {
  currentGhin.value = newGhin
}

const teeTypeLabel: Record<string, string> = {
  mens:   "Men's",
  ladies: "Ladies'",
  senior: 'Senior',
  mixed:  'Mixed',
}
</script>

<template>
  <UCard class="w-full">
    <div class="flex items-center justify-between">

      <!-- Player info -->
      <div class="flex flex-col gap-0.5">
        <h2 class="text-lg font-semibold text-stone-900 dark:text-stone-100 leading-tight">
          {{ player.fname }} {{ player.lname }}
        </h2>
        <span class="text-xs text-stone-500 dark:text-stone-400">
          {{ teeTypeLabel[player.tee_type] ?? player.tee_type }}
          <template v-if="player.is_super_admin">
            &middot;
            <UBadge
              label="Super Admin"
              color="amber"
              variant="subtle"
              size="xs"
            />
          </template>
        </span>
      </div>

      <!-- GHIN section -->
      <div class="flex items-center gap-2">
        <div class="text-right">
          <div class="text-xs text-stone-500 dark:text-stone-400 leading-none mb-0.5">
            GHIN
          </div>
          <div class="text-2xl font-bold text-stone-900 dark:text-stone-100 leading-none">
            {{ currentGhin != null ? currentGhin.toFixed(1) : '--' }}
          </div>
        </div>

        <!-- Edit GHIN modal — only shown to the player themselves -->
        <GhinEditModal
          :current-ghin="currentGhin"
          :player-id="player.id"
          @updated="onGhinUpdated"
        />
      </div>

    </div>
  </UCard>
</template>