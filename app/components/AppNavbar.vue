<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'

const supabase   = useSupabaseClient()
const user       = useSupabaseUser()
const router     = useRouter()
const colorMode  = useColorMode()

const isDark = computed({
  get() { return colorMode.value === 'dark' },
  set(val) { colorMode.preference = val ? 'dark' : 'light' },
})

async function signOut() {
  await supabase.auth.signOut()
  router.push('/login')
}

// Dropdown menu items — grouped by separator
const menuItems = computed<DropdownMenuItem[][]>(() => {
  const groups: DropdownMenuItem[][] = []

  // Auth group
  if (user.value) {
    groups.push([
      {
        label:   'Sign out',
        icon:    'i-lucide-log-out',
        onClick: signOut,
      },
    ])
  } else {
    groups.push([
      {
        label: 'Sign in',
        icon:  'i-lucide-log-in',
        to:    '/login',
      },
    ])
  }

  // Theme group
  groups.push([
    {
      label:   isDark.value ? 'Light mode' : 'Dark mode',
      icon:    isDark.value ? 'i-lucide-sun' : 'i-lucide-moon',
      onClick: () => { isDark.value = !isDark.value },
    },
  ])

  // Profile group — placeholder for future
  if (user.value) {
    groups.push([
      {
        label:    'Profile',
        icon:     'i-lucide-user',
        disabled: true,   // coming soon
      },
    ])
  }

  return groups
})
</script>

<template>
  <header class="fixed top-0 inset-x-0 z-50 h-14 flex items-center px-4
                 bg-white/90 dark:bg-stone-900/90 backdrop-blur-sm
                 border-b border-stone-200 dark:border-stone-800">

    <!-- Logo -->
    <NuxtLink to="/" class="flex items-center gap-2 shrink-0">
      <UIcon
        name="i-lucide-flag"
        class="size-6 text-primary-500"
      />
      <span class="font-semibold text-stone-900 dark:text-stone-100 tracking-tight">
        Golf League
      </span>
    </NuxtLink>

    <div class="flex-1" />

    <!-- Hamburger dropdown -->
    <UDropdownMenu
      :items="menuItems"
      :content="{ align: 'end', sideOffset: 8 }"
      :ui="{ content: 'w-48' }"
    >
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        aria-label="Open menu"
      />
    </UDropdownMenu>

  </header>
</template>