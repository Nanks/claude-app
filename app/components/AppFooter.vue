<script setup lang="ts">
const route = useRoute()

// Active route detection for tab highlight
const isActive = (path: string) => route.path === path

const tabs = [
  { label: 'Home',       icon: 'i-lucide-home',       to: '/' },
  { label: 'Scorecard',  icon: 'i-lucide-clipboard',  to: '/scorecard' },
  { label: 'Leaderboard', icon: 'i-lucide-trophy',    to: '/leaderboard' },
]
</script>

<template>
  <!-- padding-bottom pushes content above the iOS home indicator -->
  <nav
    class="fixed bottom-0 inset-x-0 z-50
           bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm
           border-t border-stone-200 dark:border-stone-800
           flex flex-col"
    style="padding-bottom: env(safe-area-inset-bottom)"
  >
    <div class="flex items-stretch h-16">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex-1 flex flex-col items-center justify-center gap-0.5
               text-xs font-medium transition-colors
               focus-visible:outline-none focus-visible:ring-2
               focus-visible:ring-primary-500 focus-visible:ring-inset"
        :class="isActive(tab.to)
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'"
      >
        <UIcon
          :name="tab.icon"
          class="size-5 transition-transform"
          :class="isActive(tab.to) ? 'scale-110' : ''"
        />
        <span>{{ tab.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>