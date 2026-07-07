// server/api/push/subscribe.delete.ts
// Removes the caller's push subscription by endpoint.
// Body: { endpoint }

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
  const endpoint = body?.endpoint as string | undefined

  if (!endpoint) throw createError({ statusCode: 400, statusMessage: 'endpoint is required' })

  await adminClient
    .from('push_subscriptions')
    .delete()
    .eq('player_id', player.id)
    .eq('endpoint', endpoint)

  return { ok: true }
})
