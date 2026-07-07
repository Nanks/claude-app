/// <reference lib="WebWorker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { NetworkFirst, NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

self.skipWaiting()
clientsClaim()

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// API routes — never cache
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly(),
)

// Navigation — network-first, offline fallback
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

// Push notifications
self.addEventListener('push', (event) => {
  const data  = event.data?.json() ?? {}
  const title = data.title ?? 'Golf League'
  const body  = data.body  ?? ''
  const url   = data.url   ?? '/'
  const tag   = data.tag   ?? 'golf-league'

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:     '/android-chrome-192x192.png',
      badge:    '/favicon-32x32.png',
      tag,
      data:     { url },
      renotify: !!data.renotify,
    }),
  )
})

// Notification click — focus or open app
self.addEventListener('notificationclick', (event) => {
  const url = event.notification.data?.url ?? '/'
  event.notification.close()

  event.waitUntil(
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
