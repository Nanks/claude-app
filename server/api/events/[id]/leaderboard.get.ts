// server/api/events/[id]/leaderboard.get.ts
import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { calcPops, calcGames, runLeaguePass } from '#server/utils/gameLogic'


export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Event ID required' })

  const adminClient = serverSupabaseServiceRole<Database>(event)
  const userClient  = await serverSupabaseClient<Database>(event)

  // ── Auth (public read for league members, non-blocking) ──
  const { data: authData } = await userClient.auth.getUser()
  const userId = authData?.user?.id ?? null

  // ── Fetch event ──────────────────────────────────────────
  const { data: evt, error: evtErr } = await adminClient
    .from('events')
    .select('id, league_id, course_id, tees_id, event_date, status, holes, per, money, double_birdie_holes, bbb_pairings')
    .eq('id', eventId)
    .single()

  if (evtErr || !evt) throw createError({ statusCode: 404, statusMessage: 'Event not found' })

  // ── Parallel fetch: league, event_games, scores, tees ───
  const [
    { data: league },
    { data: eventGamesData },
    { data: scoresData },
    { data: allTees },
  ] = await Promise.all([
    adminClient
      .from('leagues')
      .select('id, name, short_name, app_handicap, tee_type, per')
      .eq('id', evt.league_id)
      .single(),
    adminClient
      .from('event_games')
      .select('game_type_id')
      .eq('event_id', eventId),
    adminClient
      .from('scores')
      .select('id, player_id, tees_id, playing_handicap, hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9, hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18')
      .eq('event_id', eventId),
    adminClient
      .from('tees')
      .select('id, name, rating, slope, pars, hnds'),
  ])

  if (!league) throw createError({ statusCode: 404, statusMessage: 'League not found' })

  type ScoreRow = {
    id: string; player_id: string; tees_id: string; playing_handicap: number
    hole_1: number|null; hole_2: number|null; hole_3: number|null; hole_4: number|null
    hole_5: number|null; hole_6: number|null; hole_7: number|null; hole_8: number|null
    hole_9: number|null; hole_10: number|null; hole_11: number|null; hole_12: number|null
    hole_13: number|null; hole_14: number|null; hole_15: number|null; hole_16: number|null
    hole_17: number|null; hole_18: number|null
  }
  const scores = (scoresData as unknown as ScoreRow[] | null) ?? []

  // ── Game type names ──────────────────────────────────────
  const gameTypeIds = (eventGamesData ?? []).map((eg) => eg.game_type_id)
  let gameNames: { id: number; name: string }[] = []

  if (gameTypeIds.length > 0) {
    const { data: gtData } = await adminClient
      .from('game_types')
      .select('id, name')
      .in('id', gameTypeIds)

    gameNames = (gtData ?? []).map((g) => ({ id: g.id, name: g.name }))
  }

  // ── Player names ─────────────────────────────────────────
  const playerIds = [...new Set(scores.map((s) => s.player_id))]
  let playerMap = new Map<string, { fname: string; lname: string; tee_type: string }>()

  if (playerIds.length > 0) {
    const { data: playersData } = await adminClient
      .from('players')
      .select('id, fname, lname, tee_type')
      .in('id', playerIds)

    for (const p of playersData ?? []) {
      playerMap.set(p.id, { fname: p.fname, lname: p.lname, tee_type: p.tee_type })
    }
  }

  // ── Tee lookup ───────────────────────────────────────────
  const teeMap = new Map(
    (allTees ?? []).map((t) => [t.id, {
      id:     t.id,
      name:   t.name,
      rating: t.rating,
      slope:  t.slope,
      pars:   t.pars as number[],
      hnds:   t.hnds as number[],
    }])
  )

  // Fall back to event-level tees when a score has no tees_id
  const eventTee = evt.tees_id ? teeMap.get(evt.tees_id) : undefined

  const totalHoles    = evt.holes === 9 ? 9 : 18
  const appHandicap   = league.app_handicap ?? false
  const ddHoles       = (evt.double_birdie_holes as number[] | null) ?? []
  const activeGames   = (gameNames).map((g) => g.name)

  // ── Per-player game calculation ──────────────────────────
  type PlayerRow = {
    player_id:        string
    fname:            string
    lname:            string
    tee_type:         string
    tees_id:          string
    tee_name:         string
    playing_handicap: number
    pars:             number[]
    scores:           (number | null)[]
    pops:             number[]
    net:              number[]
    totalNet:         number
    birds:            number[]
    totalBirds:       number
    deuces:           number[]
    totalDeuces:      number
    chicago:          number[]
    totalChicago:     number
    totalGross:       number
    holesPlayed:      number
  }

  const players: PlayerRow[] = []

  for (const score of scores) {
    const teeData = teeMap.get(score.tees_id) ?? eventTee
    if (!teeData) continue

    const allHoles: (number | null)[] = [
      score.hole_1,  score.hole_2,  score.hole_3,  score.hole_4,
      score.hole_5,  score.hole_6,  score.hole_7,  score.hole_8,
      score.hole_9,  score.hole_10, score.hole_11, score.hole_12,
      score.hole_13, score.hole_14, score.hole_15, score.hole_16,
      score.hole_17, score.hole_18,
    ]
    const holeScores = allHoles.slice(0, totalHoles)

    const pops   = calcPops(score.playing_handicap, teeData.hnds.slice(0, totalHoles))
    const games  = calcGames(holeScores, score.playing_handicap, teeData, pops, appHandicap, ddHoles)
    const player = playerMap.get(score.player_id)

    players.push({
      player_id:        score.player_id,
      fname:            player?.fname ?? '',
      lname:            player?.lname ?? '',
      tee_type:         player?.tee_type ?? 'mens',
      tees_id:          score.tees_id,
      tee_name:         teeData.name,
      playing_handicap: score.playing_handicap,
      pars:             teeData.pars.slice(0, totalHoles) as number[],
      ...games,
    })
  }

  // Sort Net Score leaderboard: fewest net over par first
  players.sort((a, b) => {
    const diff = a.totalNet - b.totalNet
    if (Math.abs(diff) > 0.0001) return diff
    // Tiebreak: last 9
    const a9 = a.net.slice(9).reduce((s, v) => s + v, 0)
    const b9 = b.net.slice(9).reduce((s, v) => s + v, 0)
    return a9 - b9
  })

  // ── Cross-player game pass ───────────────────────────────
  const passPlayers = players.map((p) => ({
    id:       p.player_id,
    name:     `${p.fname} ${p.lname}`.trim(),
    tee_type: p.tee_type,
    games:    {
      scores:      p.scores,
      pops:        p.pops,
      net:         p.net,
      totalNet:    p.totalNet,
      birds:       p.birds,
      totalBirds:  p.totalBirds,
      deuces:      p.deuces,
      totalDeuces: p.totalDeuces,
      totalGross:  p.totalGross,
      holesPlayed: p.holesPlayed,
    },
  }))

  const gameResults = runLeaguePass(passPlayers, totalHoles, activeGames, evt.event_date)

  // BBB pairings are blind — only revealed once the event is marked complete.
  // Use the frozen pairings stored at completion time so they never change.
  if (evt.status === 'complete') {
    const stored = evt.bbb_pairings
    if (stored?.length) gameResults.blindBestBall = stored as typeof gameResults.blindBestBall
    // else: no stored pairings (event completed before this feature); fall back to computed
  } else {
    gameResults.blindBestBall = []
  }

  // ── Yearly game types (tabs only — season standings are on their own page) ──
  let yearlyGameTypes: { id: number; name: string }[] = []

  const { data: lyg } = await adminClient
    .from('league_yearly_games')
    .select('yearly_game_type_id')
    .eq('league_id', evt.league_id)

  if (lyg?.length) {
    const ygtIds = lyg.map((g) => g.yearly_game_type_id)
    const { data: ygtData } = await adminClient
      .from('yearly_game_types')
      .select('id, name')
      .in('id', ygtIds)
    yearlyGameTypes = ygtData ?? []
  }

  // Visibility + admin check
  let canView = evt.status === 'live' || evt.status === 'complete'
  let isAdmin = false

  if (userId) {
    const { data: myPlayer } = await adminClient
      .from('players')
      .select('id, is_super_admin')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (myPlayer) {
      isAdmin = myPlayer.is_super_admin ?? false

      const { data: membership } = await adminClient
        .from('league_players')
        .select('is_admin')
        .eq('league_id', evt.league_id)
        .eq('player_id', myPlayer.id)
        .eq('active', true)
        .maybeSingle()

      if (!isAdmin && membership?.is_admin) isAdmin = true
      canView = canView || !!membership
    }
  }

  if (!canView) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  return {
    event: {
      id:                  evt.id,
      event_date:          evt.event_date,
      status:              evt.status,
      holes:               totalHoles,
      per:                 evt.per || league.per || 0,
      money:               evt.money,
      double_birdie_holes: ddHoles,
    },
    league: {
      id:           league.id,
      name:         league.name,
      short_name:   league.short_name,
      app_handicap: appHandicap,
      tee_type:     league.tee_type,
      per:          league.per,
    },
    games: gameNames,
    players,
    gameResults,
    yearlyGameTypes,
    isAdmin,
  }
})
