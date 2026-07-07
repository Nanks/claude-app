// server/api/push/subscribe.post.ts
// Saves a browser push subscription for the authenticated player.
// Body: { endpoint, keys: { p256dh, auth } }

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'

export default defineEventHandler(async (event) => {
  const userClient  = await serverSupabaseClient<Database>(event)
  const adminClient = serverSupabaseServiceRole<Database>(event)

  const { data: authData } = await userClient.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const { data: player } = await adminClient
    .from('players')
    .select('id')
    .eq('auth_user_id', userId)
    .single()

  if (!player) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  const body = await readBody(event)
  const { endpoint, keys } = body ?? {}

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw createError({ statusCode: 400, statusMessage: 'endpoint and keys (p256dh, auth) are required' })
  }

  const { error } = await adminClient
    .from('push_subscriptions')
    .upsert(
      { player_id: player.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
      { onConflict: 'endpoint' },
    )

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  return { ok: true }
})
