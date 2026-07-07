// server/api/events/[id]/complete.put.ts
import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { recalculateLeagueHandicap } from '~~/server/utils/handicap'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Event ID required' })

  const adminClient = await serverSupabaseServiceRole<Database>(event)

  // 1. Mark the event as complete
  const { data: updatedEvent, error: updateError } = await adminClient
    .from('events')
    .update({ status: 'complete' })
    .eq('id', eventId)
    .select('league_id')
    .single()

  if (updateError || !updatedEvent) {
    throw createError({ statusCode: 500, statusMessage: updateError?.message || 'Event not found' })
  }

  // 2. Check if this league actually uses app_handicaps before doing math
  const { data: league } = await adminClient
    .from('leagues')
    .select('app_handicap')
    .eq('id', updatedEvent.league_id)
    .single()

  if (league?.app_handicap) {
    // 3. Find all distinct players who submitted a score
    const { data: scores } = await adminClient
      .from('scores')
      .select('player_id')
      .eq('event_id', eventId)

    if (scores && scores.length > 0) {
      const uniquePlayerIds = [...new Set(scores.map(s => s.player_id))]

      // 4. Fetch their current GHINs for fallback logic
      const { data: players } = await adminClient
        .from('players')
        .select('id, ghin')
        .in('id', uniquePlayerIds)

      const playerMap = new Map(players?.map(p => [p.id, p.ghin]) || [])

      // 5. Recalculate everyone concurrently
      const recalculationPromises = uniquePlayerIds.map(playerId => {
        const ghinFallback = playerMap.get(playerId) ?? 0 
        return recalculateLeagueHandicap(
          adminClient, 
          playerId, 
          updatedEvent.league_id, 
          ghinFallback
        )
      })

      await Promise.all(recalculationPromises)
    }
  }

  return { success: true, message: 'Event finalized and handicaps recalculated.' }
})