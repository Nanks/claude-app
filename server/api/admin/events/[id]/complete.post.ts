// server/api/admin/events/[id]/complete.post.ts
// Marks an event as complete, freezes BBB pairings, warns on incomplete scores.
// Body: { force?: boolean }
//   force=false (default) → 422 if any scores are incomplete, listing those players.
//   force=true            → proceeds even with incomplete scores.

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { calcPops, calcGames, runLeaguePass } from '#server/utils/gameLogic'
import { recalculateLeagueHandicap } from '#server/utils/handicap'

type ScoreRow = {
  player_id: string; tees_id: string; playing_handicap: number
  hole_1: number|null; hole_2: number|null; hole_3: number|null; hole_4: number|null
  hole_5: number|null; hole_6: number|null; hole_7: number|null; hole_8: number|null
  hole_9: number|null; hole_10: number|null; hole_11: number|null; hole_12: number|null
  hole_13: number|null; hole_14: number|null; hole_15: number|null; hole_16: number|null
  hole_17: number|null; hole_18: number|null
}

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Event ID required' })

  const body  = await readBody(event).catch(() => ({}))
  const force = !!body?.force

  const adminClient = serverSupabaseServiceRole<Database>(event)
  const userClient  = await serverSupabaseClient<Database>(event)

  // ── Auth ──────────────────────────────────────────────────────
  const { data: authData } = await userClient.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const { data: me } = await adminClient
    .from('players')
    .select('id, is_super_admin')
    .eq('auth_user_id', userId)
    .maybeSingle()
  if (!me) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  // ── Event ─────────────────────────────────────────────────────
  const { data: evt } = await adminClient
    .from('events')
    .select('id, league_id, course_id, tees_id, event_date, status, holes, per, money, double_birdie_holes')
    .eq('id', eventId)
    .single()
  if (!evt) throw createError({ statusCode: 404, statusMessage: 'Event not found' })

  // ── Admin check ───────────────────────────────────────────────
  if (!me.is_super_admin) {
    const { data: membership } = await adminClient
      .from('league_players')
      .select('is_admin')
      .eq('league_id', evt.league_id)
      .eq('player_id', me.id)
      .eq('active', true)
      .maybeSingle()
    if (!membership?.is_admin) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  if (evt.status !== 'live' && evt.status !== 'scheduled') {
    throw createError({ statusCode: 422, statusMessage: `Event is already ${evt.status}` })
  }

  const totalHoles = evt.holes === 9 ? 9 : 18

  // ── Fetch scores ──────────────────────────────────────────────
  const { data: scoresData } = await adminClient
    .from('scores')
    .select('player_id, tees_id, playing_handicap, hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9, hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18')
    .eq('event_id', eventId)

  const scores = (scoresData as unknown as ScoreRow[] | null) ?? []

  // ── Incomplete score check ────────────────────────────────────
  const holeKeys = Array.from({ length: totalHoles }, (_, i) => `hole_${i + 1}` as keyof ScoreRow)
  const incompleteIds = scores
    .filter(s => holeKeys.some(k => s[k] === null))
    .map(s => s.player_id)

  if (incompleteIds.length && !force) {
    const { data: incompletePlayers } = await adminClient
      .from('players')
      .select('id, fname, lname')
      .in('id', incompleteIds)

    throw createError({
      statusCode: 422,
      statusMessage: 'Incomplete scores',
      data: {
        incompleteScores: (incompletePlayers ?? []).map(p => ({
          player_id: p.id,
          name:      `${p.fname} ${p.lname}`,
        })),
      },
    })
  }

  // ── Compute BBB pairings ──────────────────────────────────────
  const [
    { data: league },
    { data: eventGamesData },
    { data: allTees },
  ] = await Promise.all([
    adminClient.from('leagues').select('app_handicap').eq('id', evt.league_id).single(),
    adminClient.from('event_games').select('game_type_id').eq('event_id', eventId),
    adminClient.from('tees').select('id, name, rating, slope, pars, hnds'),
  ])

  const playerIds = [...new Set(scores.map(s => s.player_id))]
  const [{ data: playersData }, gameTypeResult] = await Promise.all([
    adminClient.from('players').select('id, fname, lname, tee_type, ghin').in('id', playerIds),
    eventGamesData?.length
      ? adminClient.from('game_types').select('name').in('id', eventGamesData.map(eg => eg.game_type_id))
      : Promise.resolve({ data: [] as { name: string }[] }),
  ])

  const playerMap  = new Map((playersData ?? []).map(p => [p.id, p]))
  const teeMap     = new Map((allTees ?? []).map(t => [t.id, {
    id:     t.id,
    name:   t.name,
    rating: t.rating,
    slope:  t.slope,
    pars:   t.pars as number[],
    hnds:   t.hnds as number[],
  }]))
  const eventTee   = evt.tees_id ? teeMap.get(evt.tees_id) : undefined
  const appHandicap = league?.app_handicap ?? false
  const ddHoles    = (evt.double_birdie_holes as number[] | null) ?? []
  const activeGames = (gameTypeResult.data ?? []).map(g => g.name)

  const passPlayers = scores.flatMap(score => {
    const teeData = teeMap.get(score.tees_id) ?? eventTee
    if (!teeData) return []
    const allHoles: (number | null)[] = [
      score.hole_1,  score.hole_2,  score.hole_3,  score.hole_4,
      score.hole_5,  score.hole_6,  score.hole_7,  score.hole_8,
      score.hole_9,  score.hole_10, score.hole_11, score.hole_12,
      score.hole_13, score.hole_14, score.hole_15, score.hole_16,
      score.hole_17, score.hole_18,
    ]
    const holeScores = allHoles.slice(0, totalHoles)
    const pops  = calcPops(score.playing_handicap, teeData.hnds.slice(0, totalHoles))
    const games = calcGames(holeScores, score.playing_handicap, teeData, pops, appHandicap, ddHoles)
    const p     = playerMap.get(score.player_id)
    return [{
      id:       score.player_id,
      name:     p ? `${p.fname} ${p.lname}`.trim() : '',
      tee_type: p?.tee_type ?? 'mens',
      games,
    }]
  })

  const { blindBestBall } = runLeaguePass(passPlayers, totalHoles, activeGames, evt.event_date)

  // ── Persist and mark complete ─────────────────────────────────
  const { error: updateErr } = await adminClient
    .from('events')
    .update({ status: 'complete', bbb_pairings: blindBestBall as any })
    .eq('id', eventId)

  if (updateErr) throw createError({ statusCode: 500, statusMessage: 'Failed to update event' })

  // ── Recalculate handicaps for app_handicap leagues ────────────
  // The event is now 'complete' so recalculateLeagueHandicap will include
  // this round's scores when it fetches the player's last 10 completed rounds.
  if (appHandicap) {
    await Promise.all(
      playerIds.map(pid => {
        const p = playerMap.get(pid)
        return recalculateLeagueHandicap(adminClient, pid, evt.league_id, p?.ghin ?? 0)
      })
    )
  }

  return { ok: true }
})
