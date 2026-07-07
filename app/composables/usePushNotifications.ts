// composables/usePushNotifications.ts
// Manages browser push subscription state for the authenticated player.

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(b64)
  return Uint8Array.from(Array.from(raw, c => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const config = useRuntimeConfig()

  const isSupported  = ref(false)
  const permission   = ref<NotificationPermission>('default')
  const isSubscribed = ref(false)
  const isBusy       = ref(false)
  const error        = ref<string | null>(null)

  // ── Initialise ────────────────────────────────────────────────
  onMounted(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return
    }
    isSupported.value = true
    permission.value  = Notification.permission

    if (permission.value === 'granted') {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      isSubscribed.value = !!sub
    }
  })

  // ── Subscribe ─────────────────────────────────────────────────
  async function subscribe() {
    if (!isSupported.value || isBusy.value) return
    error.value = null
    isBusy.value = true

    try {
      const perm = await Notification.requestPermission()
      permission.value = perm

      if (perm !== 'granted') {
        error.value = 'Notification permission denied.'
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(config.public.vapidPublicKey as string),
      })

      const json = sub.toJSON()
      await $fetch('/api/push/subscribe', {
        method: 'POST',
        body:   { endpoint: json.endpoint, keys: json.keys },
      })

      isSubscribed.value = true
    }
    catch (e: any) {
      error.value = e?.data?.statusMessage ?? e?.message ?? 'Could not enable notifications.'
    }
    finally {
      isBusy.value = false
    }
  }

  // ── Unsubscribe ───────────────────────────────────────────────
  async function unsubscribe() {
    if (!isSupported.value || isBusy.value) return
    error.value  = null
    isBusy.value = true

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()

      if (sub) {
        await $fetch('/api/push/subscribe', {
          method: 'DELETE',
          body:   { endpoint: sub.endpoint },
        })
        await sub.unsubscribe()
      }

      isSubscribed.value = false
    }
    catch (e: any) {
      error.value = e?.data?.statusMessage ?? e?.message ?? 'Could not disable notifications.'
    }
    finally {
      isBusy.value = false
    }
  }

  return { isSupported, permission, isSubscribed, isBusy, error, subscribe, unsubscribe }
}
