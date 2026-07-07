<script setup lang="ts">
// components/GhinEditModal.vue
interface Props {
  currentGhin?: number | null // Add '?' to make it optional
  playerId:    string
  playerName?: string 
}

const props = withDefaults(defineProps<Props>(), {
  currentGhin: null // Default to null if undefined
})
const emit   = defineEmits<{ updated: [ghin: number, updatedHandicaps: Record<string, number>] }>()

const toast      = useToast()
const ghin       = ref<number | null>(props.currentGhin)
const isSaving   = ref(false)
const error      = ref<string | null>(null)

watch(() => props.currentGhin, (val) => { ghin.value = val })

function validate(val: number | null): string | null {
  if (val === null || val === undefined) return 'GHIN is required'
  if (val < 0)                           return 'GHIN cannot be negative'
  if (val > 54)                          return 'GHIN cannot exceed 54.0'
  return null
}

async function save(close: () => void) {
  error.value = null

  const validationError = validate(ghin.value)
  if (validationError) {
    error.value = validationError
    return
  }

  const rounded = Math.round((ghin.value as number) * 10) / 10
  isSaving.value = true

  try {
    // Send data to the secure server route
    const response = await $fetch(`/api/players/${props.playerId}/ghin`, {
      method: 'PUT',
      body: { ghin: rounded }
    })

    toast.add({
      title:       'GHIN updated',
      description: `${props.playerName || 'Player'}'s GHIN index has been set to ${rounded.toFixed(1)}`,
      color:       'success',
      duration:    2500,
    })

    // Emit the new GHIN and the map of updated league handicaps returned by the server
    emit('updated', rounded, (response as any).updatedHandicaps)
    close()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'An error occurred while saving'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal title="Update GHIN Index">
    <UButton
      icon="i-lucide-pencil"
      color="neutral"
      variant="ghost"
      size="xs"
      aria-label="Edit GHIN index"
    />

    <template #body="{ close }">
      <div class="space-y-4">
        <p class="text-sm text-stone-500 dark:text-stone-400">
          Enter the current GHIN handicap index for <strong>{{ playerName || 'this player' }}</strong>.
        </p>

        <UFormField
          label="GHIN Handicap Index"
          :error="error ?? undefined"
        >
          <UInput
            v-model.number="ghin"
            type="number"
            step="0.1"
            min="0"
            max="54"
            placeholder="e.g. 12.4"
            class="w-full"
            autofocus
            @keyup.enter="save(close)"
          />
        </UFormField>
      </div>
    </template>

    <template #footer="{ close }">
      <div class="flex justify-end gap-3">
        <UButton label="Cancel" color="neutral" variant="outline" @click="close()" />
        <UButton label="Save" color="primary" :loading="isSaving" @click="save(close)" />
      </div>
    </template>
  </UModal>
</template>