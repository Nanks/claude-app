<script setup lang="ts">
const props = defineProps<{
  leagueId:     string
  hasEventToday: boolean
}>()

const toast = useToast()

const isOpen  = ref(false)
const isBusy  = ref(false)
const errMsg  = ref('')

const form = reactive({
  title:  '',
  body:   '',
  target: 'members' as 'members' | 'event',
})

watch(isOpen, (open) => {
  if (!open) return
  form.title  = ''
  form.body   = ''
  form.target = 'members'
  errMsg.value = ''
})

async function send() {
  errMsg.value = ''
  if (!form.title.trim() || !form.body.trim()) {
    errMsg.value = 'Title and message are required.'
    return
  }

  isBusy.value = true
  try {
    const res = await $fetch<{ sent: number; stale: number; message?: string }>(
      `/api/leagues/${props.leagueId}/push/broadcast`,
      { method: 'POST', body: { title: form.title.trim(), body: form.body.trim(), target: form.target } },
    )

    const sent = res.sent ?? 0
    toast.add({
      title:    'Notification sent',
      description: res.message ?? `Delivered to ${sent} device${sent !== 1 ? 's' : ''}.`,
      color:    'success',
      duration: 3000,
    })
    isOpen.value = false
  }
  catch (e: any) {
    errMsg.value = e?.data?.statusMessage ?? 'Failed to send. Try again.'
  }
  finally {
    isBusy.value = false
  }
}

const targetOptions = computed(() => {
  const opts = [
    { label: 'All league members', value: 'members' },
  ]
  if (props.hasEventToday) {
    opts.push({ label: 'Players in today\'s event', value: 'event' })
  }
  return opts
})
</script>

<template>
  <UModal v-model:open="isOpen" title="Send Notification" :ui="{ content: 'max-w-sm' }">
    <!-- Trigger -->
    <UButton
      label="Send Notification"
      icon="i-lucide-bell-ring"
      color="warning"
      variant="soft"
      size="sm"
    />

    <template #body>
      <div class="space-y-4">
        <UAlert v-if="errMsg" color="error" :description="errMsg" icon="i-lucide-alert-circle" />

        <UFormField label="Title">
          <UInput v-model="form.title" placeholder="Results are in!" maxlength="60" />
        </UFormField>

        <UFormField label="Message">
          <UTextarea v-model="form.body" placeholder="Check the leaderboard for final results." :rows="3" maxlength="200" />
        </UFormField>

        <UFormField label="Send to">
          <div class="space-y-2">
            <label
              v-for="opt in targetOptions"
              :key="opt.value"
              class="flex items-center gap-2.5 cursor-pointer"
            >
              <input
                type="radio"
                :value="opt.value"
                v-model="form.target"
                class="accent-primary-500"
              />
              <span class="text-sm text-stone-700 dark:text-stone-300">{{ opt.label }}</span>
            </label>
          </div>
        </UFormField>

        <p class="text-xs text-stone-400">
          Only members who have enabled notifications will receive this.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="isOpen = false" />
        <UButton label="Send" color="warning" icon="i-lucide-send" :loading="isBusy" @click="send" />
      </div>
    </template>
  </UModal>
</template>
