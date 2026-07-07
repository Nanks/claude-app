<script setup lang="ts">
const { hasActiveRound } = useActiveRound()
</script>

<template>
  <UApp>
    <div class="min-h-dvh flex flex-col bg-stone-50 dark:bg-stone-950">
      <AppNavbar />
      <PushPermissionBanner />
      <main
        class="flex-1 pt-14 transition-[padding-bottom] duration-200"
        :style="hasActiveRound
          ? 'padding-bottom: calc(4rem + env(safe-area-inset-bottom))'
          : ''"
      >
        <slot />
      </main>
      <Transition
        enter-active-class="transition-transform duration-200 ease-out"
        enter-from-class="translate-y-full"
        enter-to-class="translate-y-0"
        leave-active-class="transition-transform duration-200 ease-in"
        leave-from-class="translate-y-0"
        leave-to-class="translate-y-full"
      >
        <AppFooter v-if="hasActiveRound" />
      </Transition>
    </div>
  </UApp>
</template>