// server/api/me/start-round.post.ts
// Creates score rows for the calling player and any others they're keeping score for.

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'

interface PlayerEntry {
  player_id:        string
  tees_id:          string
  playing_handicap: number
  ghin_index:       number | null
}

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

  const body = await readBody(event) as { event_id: string; players: PlayerEntry[] }

  if (!body?.event_id || !body?.players?.length) {
    throw createError({ statusCode: 400, statusMessage: 'event_id and players required' })
  }

  // Validate event is active
  const { data: evt } = await adminClient
    .from('events')
    .select('id, league_id, course_id, status')
    .eq('id', body.event_id)
    .in('status', ['scheduled', 'live'])
    .single()

  if (!evt) throw createError({ statusCode: 404, statusMessage: 'Event not found or not active' })

  // Insert score rows; skip if already exists
  const rows = body.players.map(p => ({
    event_id:         evt.id,
    league_id:        evt.league_id,
    course_id:        evt.course_id,
    tees_id:          p.tees_id,
    player_id:        p.player_id,
    entered_by:       me.id,
    ghin_index:       p.ghin_index,
    playing_handicap: p.playing_handicap,
  }))

  const { error } = await adminClient
    .from('scores')
    .upsert(rows, { onConflict: 'event_id,player_id', ignoreDuplicates: true })

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // Return the calling player's score ID for navigation
  const { data: myScore } = await adminClient
    .from('scores')
    .select('id')
    .eq('event_id', evt.id)
    .eq('player_id', me.id)
    .single()

  return { event_id: evt.id, score_id: myScore?.id ?? null }
})
