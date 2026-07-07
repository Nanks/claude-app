<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})

const supabase = useSupabaseClient()
const user = useSupabaseUser()

// Redirect if already logged in
watch(user, (currentUser) => {
  if (currentUser) navigateTo('/')
}, { immediate: true })

// --- Step 1: Send OTP ---
const phone = ref('')
const phoneError = ref('')
const otpSent = ref(false)
const isSendingOtp = ref(false)

async function sendOtp() {
  phoneError.value = ''
  isSendingOtp.value = true

  // Normalize to E.164 before sending
  // This assumes US numbers; adjust for international support
  const normalized = normalizePhone(phone.value)
  if (!normalized) {
    phoneError.value = 'Please enter a valid phone number.'
    isSendingOtp.value = false
    return
  }

  const { error } = await supabase.auth.signInWithOtp({
    phone: normalized,
    options: {
      // Prevent creating a new auth user if phone not in players table.
      // The before-user-created hook handles this server-side,
      // but this client-side flag adds a second layer.
      shouldCreateUser: true,
    },
  })

  if (error) {
    // The hook rejection surfaces here as an error message
    phoneError.value = error.message
  } else {
    otpSent.value = true
    phone.value = normalized
  }

  isSendingOtp.value = false
}

// --- Step 2: Verify OTP ---
const otp = ref('')
const otpError = ref('')
const isVerifying = ref(false)

async function verifyOtp() {
  otpError.value = ''
  isVerifying.value = true

  const { error } = await supabase.auth.verifyOtp({
    phone: phone.value,
    token: otp.value,
    type: 'sms',
  })

  if (error) {
    otpError.value = error.message
  }
  // On success, useSupabaseUser() updates reactively and the watcher above redirects

  isVerifying.value = false
}

// --- Utility ---
function normalizePhone(raw: string): string | null {
  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, '')
  // Accept 10-digit US or 11-digit with leading 1
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function goBack() {
  otpSent.value = false
  otp.value = ''
  otpError.value = ''
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-semibold text-center">Golf League Sign In</h1>
      </template>

      <!-- Step 1: Enter Phone -->
      <div v-if="!otpSent" class="space-y-4">
        <UFormField label="Phone Number" :error="phoneError">
          <UInput
            v-model="phone"
            type="tel"
            placeholder="(555) 555-5555"
            icon="i-heroicons-phone"
            autofocus
            @keyup.enter="sendOtp"
          />
        </UFormField>
        <UButton
          block
          :loading="isSendingOtp"
          @click="sendOtp"
        >
          Send Code
        </UButton>
      </div>

      <!-- Step 2: Enter OTP -->
      <div v-else class="space-y-4">
        <p class="text-sm text-gray-500 text-center">
          Enter the 6-digit code sent to {{ phone }}
        </p>
        <UFormField label="Verification Code" :error="otpError">
          <UInput
            v-model="otp"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="123456"
            icon="i-heroicons-shield-check"
            autofocus
            @keyup.enter="verifyOtp"
          />
        </UFormField>
        <UButton
          block
          :loading="isVerifying"
          @click="verifyOtp"
        >
          Verify & Sign In
        </UButton>
        <UButton variant="ghost" block @click="goBack">
          Use a different number
        </UButton>
      </div>
    </UCard>
  </div>
</template>