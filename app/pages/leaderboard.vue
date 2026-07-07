<script setup lang="ts">
definePageMeta({ layout: 'default' })

const { data: scorecard } = await useFetch('/api/me/scorecard', { default: () => null })

if (!scorecard.value) {
  await navigateTo('/')
} else {
  await navigateTo(`/leagues/${scorecard.value.event.league_id}/events/${scorecard.value.event.id}`)
}
</script>

<template>
  <div class="flex items-center justify-center h-48">
    <UIcon name="i-lucide-loader" class="size-6 animate-spin text-stone-400" />
  </div>
</template>
