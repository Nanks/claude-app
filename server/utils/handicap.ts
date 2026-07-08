// server/utils/handicap.ts
import { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~~/shared/types/database.types'

export async function recalculateLeagueHandicap(
  adminClient: SupabaseClient<Database>, 
  playerId: string, 
  leagueId: string, 
  ghinFallback: number
) {
  // 1. Fetch all completed scores for this player/league with tee rating/slope.
  //    Do NOT use .order({ foreignTable }) or .limit() here — foreignTable ordering
  //    is silently ignored in Supabase JS v2, causing the oldest rows to be returned
  //    instead of the most recent. Sort by event_date in JS then take the top 10.
  const { data: allScores, error: scoresError } = await adminClient
    .from('scores')
    .select(`
      id,
      hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9,
      hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18,
      events!inner ( event_date, status ),
      tees!inner ( rating, slope )
    `)
    .eq('player_id', playerId)
    .eq('league_id', leagueId)
    .eq('events.status', 'complete')

  if (scoresError) {
    console.error('Failed to fetch scores for handicap:', scoresError)
    throw new Error(`Failed to fetch scores: ${scoresError.message}`)
  }

  // Sort by event_date descending in JS, then keep only the 10 most recent.
  const scoresData = (allScores ?? [])
    .sort((a, b) => {
      const dateA = (Array.isArray(a.events) ? a.events[0]?.event_date : a.events?.event_date) ?? ''
      const dateB = (Array.isArray(b.events) ? b.events[0]?.event_date : b.events?.event_date) ?? ''
      return dateB.localeCompare(dateA)
    })
    .slice(0, 10)

  // 2. Transform scores into audit records
  const auditRecords: any[] = []

  if (scoresData.length > 0) {
    scoresData.forEach((score, index) => {
      const holes = [
        score.hole_1, score.hole_2, score.hole_3, score.hole_4, score.hole_5, score.hole_6, score.hole_7, score.hole_8, score.hole_9,
        score.hole_10, score.hole_11, score.hole_12, score.hole_13, score.hole_14, score.hole_15, score.hole_16, score.hole_17, score.hole_18
      ]
      const rawGross = holes.reduce((sum: number, h) => sum + (h || 0), 0)
      const adjustedGross = rawGross

      const eventDate = Array.isArray(score.events) ? score.events[0]?.event_date : score.events?.event_date
      const rating = Array.isArray(score.tees) ? score.tees[0]?.rating : score.tees?.rating
      const slope = Array.isArray(score.tees) ? score.tees[0]?.slope : score.tees?.slope

      const finalRating = rating || 72
      const finalSlope = slope || 113

      const rawDiff = ((adjustedGross - finalRating) * 113) / finalSlope
      const differential = Math.round(rawDiff * 1000) / 1000

      auditRecords.push({
        player_id: playerId,
        league_id: leagueId,
        score_id: score.id,
        event_date: eventDate || new Date().toISOString().split('T')[0],
        raw_gross: rawGross,
        adjusted_gross: adjustedGross,
        course_rating: finalRating,
        slope_rating: finalSlope,
        differential: differential,
        is_padding: false,
        is_best: false,
        round_position: index + 1
      })
    })
  }

  // 3. Fill missing rounds with (GHIN - 3) if under 6 completed rounds
  if (auditRecords.length < 6) {
    const paddingNeeded = 10 - auditRecords.length
    const fillValue = Math.round((ghinFallback - 3) * 1000) / 1000
    const startPosition = auditRecords.length + 1

    for (let i = 0; i < paddingNeeded; i++) {
      auditRecords.push({
        player_id: playerId,
        league_id: leagueId,
        score_id: null,
        event_date: new Date().toISOString().split('T')[0],
        raw_gross: null,
        adjusted_gross: null,
        course_rating: 72, 
        slope_rating: 113,
        differential: fillValue,
        is_padding: true,
        is_best: false,
        round_position: startPosition + i
      })
    }
  }

  // 4. Determine the best 4 differentials
  const sortedByDiff = [...auditRecords].sort((a, b) => a.differential - b.differential)
  const best4 = sortedByDiff.slice(0, 4)
  
  best4.forEach(bestRecord => {
    const target = auditRecords.find(r => r.round_position === bestRecord.round_position)
    if (target) target.is_best = true
  })

  // 5. Calculate final handicap
  const sum = best4.reduce((acc, val) => acc + val.differential, 0)
  const average = sum / best4.length
  const newHandicap = Math.round(average * 1000) / 1000

  // 6. DB Transaction
  await adminClient
    .from('player_league_audit')
    .delete()
    .eq('player_id', playerId)
    .eq('league_id', leagueId)

  await adminClient
    .from('player_league_audit')
    .insert(auditRecords)

  const { data: existingHcp } = await adminClient
    .from('player_league_handicaps')
    .select('id')
    .eq('player_id', playerId)
    .eq('league_id', leagueId)
    .single()

  if (existingHcp) {
    await adminClient
      .from('player_league_handicaps')
      .update({ handicap_value: newHandicap, calculated_at: new Date().toISOString() })
      .eq('id', existingHcp.id)
  } else {
    await adminClient
      .from('player_league_handicaps')
      .insert({
        player_id: playerId,
        league_id: leagueId,
        handicap_value: newHandicap
      })
  }

  return newHandicap
}