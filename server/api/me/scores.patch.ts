// server/api/me/scores.patch.ts
// Saves hole scores for players in the caller's active round session.
// Body: { updates: Array<{ score_id: string, hole: number (1-18), value: number | null }> }

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'

const VALID_HOLES = new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18])

export default defineEventHandler(async (event) => {
  const userClient  = await serverSupabaseClient<Database>(event)
  const adminClient = serverSupabaseServiceRole<Database>(event)

  const { data: authData } = await userClient.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) throw createError({ statusCode: 401 })

  const { data: me } = await adminClient
    .from('players')
    .select('id')
    .eq('auth_user_id', userId)
    .single()
  if (!me) throw createError({ statusCode: 403 })

  const body = await readBody(event) as {
    updates: Array<{ score_id: string; hole: number; value: number | null }>
  }

  if (!body?.updates?.length) {
    throw createError({ statusCode: 400, statusMessage: 'updates required' })
  }

  // Verify all referenced score rows were entered by the current player
  const scoreIds = [...new Set(body.updates.map(u => u.score_id))]
  const { data: scoreCheck } = await adminClient
    .from('scores')
    .select('id, entered_by')
    .in('id', scoreIds)

  const unauthorized = scoreCheck?.some(s => s.entered_by !== me.id)
  if (unauthorized) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  // Group updates by score_id and build patch objects
  const patches = new Map<string, Record<string, number | null>>()
  for (const u of body.updates) {
    if (!VALID_HOLES.has(u.hole)) continue
    if (!patches.has(u.score_id)) patches.set(u.score_id, {})
    patches.get(u.score_id)![`hole_${u.hole}`] = u.value ?? null
  }

  await Promise.all(
    [...patches.entries()].map(([scoreId, patch]) =>
      adminClient.from('scores').update(patch as any).eq('id', scoreId)
    )
  )

  return { ok: true }
})
