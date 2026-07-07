// server/api/me/today.get.ts
// Returns today's event status for the authenticated player.
// Used by the home page to decide whether to show Start/Resume modal.

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'

export default defineEventHandler(async (event) => {
  const userClient  = await serverSupabaseClient<Database>(event)
  const adminClient = serverSupabaseServiceRole<Database>(event)

  const { data: authData } = await userClient.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) return null

  // ── Resolve player ────────────────────────────────────────────
  const { data: player } = await adminClient
    .from('players')
    .select('id, fname, lname, tee_type, ghin, is_super_admin')
    .eq('auth_user_id', userId)
    .single()

  if (!player) return null

  // Allow client to pass its local date so we don't drift on UTC boundaries
  const query = getQuery(event)
  const today = (query.date as string) || new Date().toISOString().slice(0, 10)

  // ── Find leagues this player actively plays in ────────────────
  const { data: memberships } = await adminClient
    .from('league_players')
    .select('league_id')
    .eq('player_id', player.id)
    .eq('active', true)
    .eq('is_player', true)

  if (!memberships?.length) return null
  const memberLeagueIds = memberships.map(m => m.league_id)

  // ── Find today's scheduled/live events in those leagues ───────
  const { data: todayEvents } = await adminClient
    .from('events')
    .select('id, league_id, course_id, tees_id, event_date, status, holes, per, money')
    .in('league_id', memberLeagueIds)
    .in('status', ['scheduled', 'live'])
    .eq('event_date', today)
    .limit(5)

  if (!todayEvents?.length) return null
  const evt = todayEvents[0]!

  // ── Check this player's score for the event ───────────────────
  const { data: myScore } = await adminClient
    .from('scores')
    .select('id, hole_1, hole_2, hole_3, hole_4, hole_5, hole_6, hole_7, hole_8, hole_9, hole_10, hole_11, hole_12, hole_13, hole_14, hole_15, hole_16, hole_17, hole_18')
    .eq('event_id', evt.id)
    .eq('player_id', player.id)
    .maybeSingle()

  // Suppress the modal if the player already has any score today — resume via league card/menu
  if (myScore) return null

  // ── Parallel: league, course, games, league players, handicaps, tees ──
  const [
    { data: league },
    { data: course },
    { data: eventGames },
    { data: leaguePlayerRows },
    { data: myMembership },
  ] = await Promise.all([
    adminClient.from('leagues').select('id, name, short_name, tee_type, app_handicap, theme_start_color, theme_end_color').eq('id', evt.league_id).single(),
    adminClient.from('courses').select('name').eq('id', evt.course_id).single(),
    adminClient.from('event_games').select('game_type_id').eq('event_id', evt.id),
    adminClient.from('league_players').select('player_id').eq('league_id', evt.league_id).eq('active', true).eq('is_player', true),
    adminClient.from('league_players').select('is_admin').eq('league_id', evt.league_id).eq('player_id', player.id).eq('active', true).maybeSingle(),
  ])

  const isAdmin = player.is_super_admin || myMembership?.is_admin || false

  const leaguePlayerIds = (leaguePlayerRows ?? []).map(lp => lp.player_id)

  const [gameTypesResult, playerRowsResult, handicapRowsResult, teesResult] = await Promise.all([
    eventGames?.length
      ? adminClient.from('game_types').select('name').in('id', eventGames.map(eg => eg.game_type_id))
      : { data: [] },
    adminClient.from('players').select('id, fname, lname, tee_type, tees_id, ghin').in('id', leaguePlayerIds),
    adminClient.from('player_league_handicaps').select('player_id, handicap_value').eq('league_id', evt.league_id).in('player_id', leaguePlayerIds).order('calculated_at', { ascending: false }),
    adminClient.from('tees').select('id, name, rating, slope, tee_types, pars').eq('course_id', evt.course_id).eq('active', true),
  ])

  const handicapMap = new Map<string, number>()
  for (const h of handicapRowsResult.data ?? []) {
    if (!handicapMap.has(h.player_id)) handicapMap.set(h.player_id, h.handicap_value)
  }

  const leaguePlayers = (playerRowsResult.data ?? [])
    .map(p => ({
      id:              p.id,
      fname:           p.fname,
      lname:           p.lname,
      tee_type:        p.tee_type,
      tees_id:         p.tees_id,
      ghin:            p.ghin,
      handicap_value:  handicapMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => a.lname.localeCompare(b.lname) || a.fname.localeCompare(b.fname))

  const isMixed = league?.tee_type === 'mixed'

  const courseTees = (teesResult.data ?? []).map(t => {
    const pars = t.pars as number[]
    return {
      id:        t.id,
      name:      t.name,
      rating:    t.rating,
      slope:     t.slope,
      tee_types: t.tee_types as string[],
      par_total: pars.slice(0, evt.holes).reduce((a, b) => a + b, 0),
    }
  })

  return {
    event: {
      id:                 evt.id,
      league_id:          evt.league_id,
      course_id:          evt.course_id,
      tees_id:            evt.tees_id,
      event_date:         evt.event_date,
      status:             evt.status,
      holes:              evt.holes,
      per:                evt.per,
      money:              evt.money,
      course_name:        course?.name ?? '',
      league_name:        league?.name ?? '',
      league_short:       league?.short_name ?? '',
      theme_start_color:  league?.theme_start_color ?? '#6b7280',
      theme_end_color:    league?.theme_end_color   ?? '#374151',
      is_mixed:           isMixed,
      app_handicap:       league?.app_handicap ?? false,
      game_names:         (gameTypesResult.data ?? []).map(g => g.name),
    },
    myPlayerId:   player.id,
    isAdmin,
    leaguePlayers,
    courseTees,
  }
})
