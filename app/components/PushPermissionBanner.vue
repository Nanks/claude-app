<script setup lang="ts">
// Shows a subtle banner prompting the user to enable push notifications.
// Dismissed state is stored in localStorage so it doesn't reappear.
const DISMISS_KEY = 'push_banner_dismissed'

const { isSupported, permission, isSubscribed, isBusy, subscribe } = usePushNotifications()

const dismissed = ref(true)   // start hidden; update after mount to avoid SSR flash

onMounted(() => {
  dismissed.value = localStorage.getItem(DISMISS_KEY) === '1'
})

function dismiss() {
  localStorage.setItem(DISMISS_KEY, '1')
  dismissed.value = true
}

const show = computed(() =>
  isSupported.value &&
  !isSubscribed.value &&
  permission.value !== 'denied' &&
  !dismissed.value,
)
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    leave-active-class="transition-all duration-200 ease-in"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="show"
      class="flex items-center gap-3 px-4 py-2.5
             bg-stone-50 dark:bg-stone-800/80
             border-b border-stone-200 dark:border-stone-700"
    >
      <UIcon name="i-lucide-bell" class="size-4 text-primary-500 shrink-0" />
      <p class="flex-1 text-xs text-stone-600 dark:text-stone-300">
        Enable notifications for event results and updates.
      </p>
      <UButton
        label="Enable"
        size="xs"
        color="primary"
        variant="soft"
        :loading="isBusy"
        @click="subscribe"
      />
      <UButton
        icon="i-lucide-x"
        size="xs"
        color="neutral"
        variant="ghost"
        aria-label="Dismiss"
        @click="dismiss"
      />
    </div>
  </Transition>
</template>
