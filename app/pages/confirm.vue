<script setup lang="ts">
// @nuxtjs/supabase automatically handles the session callback on this page.
// The module listens for the Supabase auth event and sets the session cookie.
// Just redirect to home once the user is populated.

const user = useSupabaseUser()

watch(user, (currentUser) => {
  if (currentUser) navigateTo('/')
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <p class="text-gray-500">Signing you in…</p>
  </div>
</template>