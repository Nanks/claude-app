<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const user     = useSupabaseUser()

watch(user, (u) => { if (u) navigateTo('/') }, { immediate: true })

const fname  = ref('')
const lname  = ref('')
const email  = ref('')
const error  = ref('')
const sent   = ref(false)
const isBusy = ref(false)

async function sendLink() {
  error.value = ''
  isBusy.value = true

  try {
    // Step 1: server validates name + email, creates auth user on first sign-in
    await $fetch('/api/auth/magic-link', {
      method: 'POST',
      body: { fname: fname.value.trim(), lname: lname.value.trim(), email: email.value.trim() },
    })

    // Step 2: send the magic link — user already exists so shouldCreateUser: false
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: email.value.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/confirm`,
      },
    })

    if (otpErr) {
      error.value = otpErr.message
    } else {
      sent.value = true
    }
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Something went wrong. Please try again.'
  } finally {
    isBusy.value = false
  }
}

function reset() {
  sent.value  = false
  error.value = ''
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <UCard class="w-full max-w-sm">

      <template #header>
        <div class="flex items-center justify-center gap-2 py-1">
          <UIcon name="i-lucide-flag" class="size-5 text-primary-500" />
          <h1 class="text-xl font-semibold">Golf League</h1>
        </div>
      </template>

      <!-- Sent state ─────────────────────────────────────────── -->
      <div v-if="sent" class="space-y-4 text-center py-2">
        <div class="flex justify-center">
          <div class="size-12 rounded-full bg-primary-50 dark:bg-primary-900/20
                      flex items-center justify-center">
            <UIcon name="i-lucide-mail-check" class="size-6 text-primary-500" />
          </div>
        </div>
        <div class="space-y-1">
          <p class="font-semibold text-stone-800 dark:text-stone-100">Check your inbox</p>
          <p class="text-sm text-stone-500 dark:text-stone-400">
            We sent a sign-in link to<br />
            <span class="font-medium text-stone-700 dark:text-stone-300">
              {{ email.trim().toLowerCase() }}
            </span>
          </p>
        </div>
        <p class="text-xs text-stone-400">
          Link expires in 1 hour. Check your spam folder if you don't see it.
        </p>
        <UButton variant="ghost" block size="sm" @click="reset">
          Try a different email
        </UButton>
      </div>

      <!-- Sign-in form ────────────────────────────────────────── -->
      <div v-else class="space-y-4">
        <p class="text-sm text-stone-500 dark:text-stone-400 text-center">
          Enter your name and email to receive a sign-in link.
        </p>

        <UAlert v-if="error" color="error" :description="error" icon="i-lucide-alert-circle" />

        <UFormField label="First Name">
          <UInput
            v-model="fname"
            placeholder="Jane"
            autocomplete="given-name"
            class="w-full"
            @keyup.enter="sendLink"
          />
        </UFormField>

        <UFormField label="Last Name">
          <UInput
            v-model="lname"
            placeholder="Smith"
            autocomplete="family-name"
            class="w-full"
            @keyup.enter="sendLink"
          />
        </UFormField>

        <UFormField label="Email">
          <UInput
            v-model="email"
            type="email"
            placeholder="jane@example.com"
            icon="i-lucide-mail"
            autocomplete="email"
            class="w-full"
            @keyup.enter="sendLink"
          />
        </UFormField>

        <UButton block :loading="isBusy" @click="sendLink">
          Send Magic Link
        </UButton>
      </div>

    </UCard>
  </div>
</template>
