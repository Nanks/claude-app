// server/utils/webpush.ts
// Initializes web-push with VAPID credentials and exposes a helper that fans out
// push notifications to a list of players, cleaning up stale subscriptions (410).

import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~~/shared/types/database.types'

export interface PushPayload {
  title:     string
  body:      string
  url?:      string
  tag?:      string
  renotify?: boolean
}

let initialized = false

function initWebPush() {
  if (initialized) return
  const config = useRuntimeConfig()
  webpush.setVapidDetails(
    `mailto:${config.vapidEmail || 'admin@golf-league.app'}`,
    config.public.vapidPublicKey,
    config.vapidPrivateKey,
  )
  initialized = true
}

export async function sendPushToPlayers(
  admin: SupabaseClient<Database>,
  playerIds: string[],
  payload: PushPayload,
): Promise<{ sent: number; stale: number }> {
  if (!playerIds.length) return { sent: 0, stale: 0 }

  initWebPush()

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('player_id', playerIds)

  if (!subs?.length) return { sent: 0, stale: 0 }

  const payloadStr = JSON.stringify(payload)

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr,
        )
        return { id: sub.id, ok: true }
      }
      catch (err: any) {
        return { id: sub.id, ok: false, status: (err?.statusCode ?? 0) as number }
      }
    }),
  )

  const staleIds: string[] = []
  let sent = 0

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    if (r.value.ok) {
      sent++
    }
    else if (r.value.status === 410) {
      staleIds.push(r.value.id)
    }
  }

  if (staleIds.length) {
    await admin.from('push_subscriptions').delete().in('id', staleIds)
  }

  return { sent, stale: staleIds.length }
}
