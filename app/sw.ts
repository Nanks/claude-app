/// <reference lib="WebWorker" />
/// <reference types="vite/client" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()

// ── Precache all build assets ─────────────────────────────────
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ── API routes: always network, never cache ───────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly(),
)

// ── Navigation: network-first, fall back to offline page ─────
const navStrategy = new NetworkFirst({ cacheName: 'navigations', networkTimeoutSeconds: 5 })

registerRoute(
  new NavigationRoute(
    async (ctx) => {
      try {
        return await navStrategy.handle(ctx)
      }
      catch {
        const cached = await caches.match('/offline.html')
        return cached ?? Response.error()
      }
    },
    { denylist: [/^\/api\//] },
  ),
)

// ── Push: show notification ───────────────────────────────────
self.addEventListener('push', (event) => {
  const data    = (event as PushEvent).data?.json() ?? {}
  const title   = (data.title as string | undefined)   ?? 'Golf League'
  const body    = (data.body  as string | undefined)   ?? ''
  const url     = (data.url   as string | undefined)   ?? '/'
  const tag     = (data.tag   as string | undefined)   ?? 'golf-league'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     '/android-chrome-192x192.png',
      badge:    '/favicon-32x32.png',
      tag,
      data:     { url },
      renotify: !!(data.renotify),
    } as NotificationOptions),
  )
})

// ── Notification click: focus or open the app ────────────────
self.addEventListener('notificationclick', (event) => {
  const ne  = event as NotificationEvent
  const url = (ne.notification.data?.url as string | undefined) ?? '/'
  ne.notification.close()

  ne.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const win = clients.find(c => 'focus' in c) as WindowClient | undefined
        if (win) {
          win.focus()
          win.navigate(url)
        }
        else {
          self.clients.openWindow(url)
        }
      }),
  )
})
