<script setup lang="ts">
// components/LeagueMenuItem.vue

interface Props {
  to: string
  title: string
  icon: string
  iconColor?: string
  ringColor?: string
  bgColor?: string
}

withDefaults(defineProps<Props>(), {
  iconColor: 'text-primary-500',
  ringColor: 'ring-primary-500/50',
  bgColor: 'bg-white dark:bg-stone-900',
})
</script>

<template>
  <NuxtLink :to="to" class="block transition-transform active:scale-95">
    <UCard 
      :class="[
        'h-full hover:ring-2 hover:shadow-sm transition-all', 
        ringColor, 
        bgColor
      ]"
    >
      <div class="flex flex-col items-center justify-center py-2 text-center">
        <UIcon :name="icon" :class="['size-8 mb-2', iconColor]" />
        <span class="text-sm font-semibold text-stone-700 dark:text-stone-200">
          {{ title }}
        </span>
      </div>
    </UCard>
  </NuxtLink>
</template>