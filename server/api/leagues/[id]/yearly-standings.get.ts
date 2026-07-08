// GET /api/leagues/[id]/yearly-standings
// Returns season-to-date totals for all yearly game types configured for this league.
// Birdies and net deuces are computed by replaying calcGames across all complete events,
// using the playing_handicap frozen on each score row at round time.

import { serverSupabaseServiceRole } from '#supabase/server'
import { calcPops, calcGames } from '#server/utils/gameLogic'

export default defineEventHandler(async (event) => {
  const leagueId   = getRouterParam(event, 'id') as string
  const adminClient = serverSupabaseServiceRole(event)

  const [leagueResult, yearlyGamesResult] = await Promise.all([
    adminClient
      .from('leagues')
      .select('id, app_handicap, holes')
      .eq('id', leagueId)
      .single(),
    adminClient
      .from('league_yearly_games')
      .select('yearly_game_types(id, name, description)')
      .eq('league_id', leagueId),
  ])

  if (!leagueResult.data) throw createError({ statusCode: 404, statusMessage: 'League not found' })
  const league = leagueResult.data

  const yearlyGameTypes = (yearlyGamesResult.data ?? [])
    .map((g: any) => g.yearly_game_types)
    .filter(Boolean) as { id: number; name: string; description: string | null }[]

  if (!yearlyGameTypes.length) return { yearlyGames: [] }

  // Current calendar year
  const year      = new Date().getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31`

  const { data: events } = await adminClient
    .from('events')
    .select('id, holes, double_birdie_holes, tees_id')
    .eq('league_id', leagueId)
    .eq('status', 'complete')
    .gte('event_date', yearStart)
    .lte('event_date', yearEnd)

  if (!events?.length) {
    return {
      yearlyGames: yearlyGameTypes.map(g => ({ id: g.id, name: g.name, standings: [] })),
    }
  }

  const eventIds  = events.map(e => e.id)
  const eventMap  = new Map(events.map(e => [e.id, e]))

  const { data: scores } = await adminClient
    .from('scores')
    .select(`
      player_id, event_id, tees_id, playing_handicap,
      hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9,
      hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18
    `)
    .in('event_id', eventIds)

  if (!scores?.length) {
    return {
      yearlyGames: yearlyGameTypes.map(g => ({ id: g.id, name: g.name, standings: [] })),
    }
  }

  const playerIds = [...new Set(scores.map(s => s.player_id))]
  const teesIds   = [...new Set(
    [...scores.map(s => s.tees_id), ...events.map(e => e.tees_id)].filter(Boolean) as string[]
  )]

  const [playersResult, teesResult] = await Promise.all([
    adminClient.from('players').select('id, fname, lname').in('id', playerIds),
    teesIds.length
      ? adminClient.from('tees').select('id, pars, hnds, rating, slope').in('id', teesIds)
      : Promise.resolve({ data: [] }),
  ])

  const playerMap = new Map(
    (playersResult.data ?? []).map(p => [p.id, `${p.fname} ${p.lname}`.trim()])
  )
  const teeMap = new Map(
    ((teesResult as { data: any[] }).data ?? []).map((t: any) => [t.id, {
      pars:   t.pars   as number[],
      hnds:   t.hnds   as number[],
      rating: t.rating as number,
      slope:  t.slope  as number,
    }])
  )

  const appHandicap = league.app_handicap ?? false
  const leagueHoles = league.holes === 9 ? 9 : 18

  // Per-player running totals
  const totals = new Map<string, { birds: number; deuces: number; events: Set<string> }>()

  for (const score of scores) {
    const evt = eventMap.get(score.event_id)
    if (!evt) continue

    const teeData = teeMap.get(score.tees_id) ?? (evt.tees_id ? teeMap.get(evt.tees_id) : undefined)
    if (!teeData) continue

    const totalHoles = (evt.holes === 9 || leagueHoles === 9) ? 9 : 18
    const ddHoles    = (evt.double_birdie_holes as number[] | null) ?? []

    const holeScores: (number | null)[] = [
      score.hole_1, score.hole_2, score.hole_3, score.hole_4, score.hole_5, score.hole_6,
      score.hole_7, score.hole_8, score.hole_9, score.hole_10, score.hole_11, score.hole_12,
      score.hole_13, score.hole_14, score.hole_15, score.hole_16, score.hole_17, score.hole_18,
    ].slice(0, totalHoles)

    const pops  = calcPops(score.playing_handicap, teeData.hnds.slice(0, totalHoles))
    const games = calcGames(holeScores, score.playing_handicap, teeData, pops, appHandicap, ddHoles)

    const existing = totals.get(score.player_id) ?? { birds: 0, deuces: 0, events: new Set() }
    existing.birds  += games.totalBirds
    existing.deuces += games.totalDeuces
    existing.events.add(score.event_id)
    totals.set(score.player_id, existing)
  }

  // Build standings per yearly game type — name drives which metric to use
  const yearlyGames = yearlyGameTypes.map(g => {
    const metric = g.name === 'birds' ? 'birds' : 'deuces'

    const standings = [...totals.entries()]
      .map(([playerId, t]) => ({
        playerId,
        playerName:   playerMap.get(playerId) ?? 'Unknown',
        total:        metric === 'birds' ? Math.round(t.birds * 10) / 10 : t.deuces,
        eventsPlayed: t.events.size,
      }))
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total)

    return { id: g.id, name: g.name, standings }
  })

  return { yearlyGames }
})
