// server/api/players/[id]/ghin.put.ts
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { recalculateLeagueHandicap } from '~~/server/utils/handicap'

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')
  if (!playerId) throw createError({ statusCode: 400, statusMessage: 'Player ID required' })

  const body = await readBody(event)
  const newGhin = typeof body.ghin === 'number' ? body.ghin : parseFloat(body.ghin)
  
  if (isNaN(newGhin)) throw createError({ statusCode: 400, statusMessage: 'Valid GHIN required' })

  const adminClient = await serverSupabaseServiceRole<Database>(event)

  // 1. Update the base GHIN
  await adminClient.from('players').update({ ghin: newGhin }).eq('id', playerId)

  // 2. Find active leagues where app_handicap is TRUE AND user is a player
  const { data: memberships } = await adminClient
    .from('league_players')
    .select('league_id, leagues!inner(app_handicap)')
    .eq('player_id', playerId)
    .eq('active', true)
    .eq('is_player', true) // <-- FIX 1: Ensures we ignore leagues you only admin!
    .eq('leagues.app_handicap', true)

  // 3. Recalculate everyone
  const updatedHandicaps: Record<string, number> = {}
  
  for (const membership of memberships || []) {
    const newHcp = await recalculateLeagueHandicap(adminClient, playerId, membership.league_id, newGhin)
    updatedHandicaps[membership.league_id] = newHcp
  }

  // Return the new GHIN AND the new league handicaps
  return { success: true, updatedGhin: newGhin, updatedHandicaps }
})