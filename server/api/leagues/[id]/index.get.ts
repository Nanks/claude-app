// server/api/leagues/[id].get.ts
// Returns everything the league detail page needs in one request.

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const adminClient = serverSupabaseServiceRole(event)
  const leagueId    = getRouterParam(event, 'id') as string
  const today       = new Date().toISOString().slice(0, 10)

  // Auth is optional — anon users can view public league info
  let playerId: string | null = null
  let isSuperAdmin = false

  const { data: authData } = await serverSupabaseClient(event).auth.getUser()
  const authUser = authData?.user

  if (authUser?.id) {
    const { data: player } = await adminClient
      .from('players')
      .select('id, is_super_admin')
      .eq('auth_user_id', authUser.id)
      .maybeSingle()
    if (player) {
      playerId    = player.id
      isSuperAdmin = player.is_super_admin ?? false
    }
  }

  // ── League ────────────────────────────────────────────────
  const { data: league, error: leagueError } = await adminClient
    .from('leagues')
    .select(`
      id, name, short_name, tee_type, app_handicap,
      theme_start_color, theme_end_color, holes, can_rsvp,
      course_id, tees_id
    `)
    .eq('id', leagueId)
    .single()

  if (leagueError || !league) {
    throw createError({ statusCode: 404, statusMessage: 'League not found' })
  }

  // ── Yearly games for this league ──────────────────────────
  const { data: yearlyGames } = await adminClient
    .from('league_yearly_games')
    .select('yearly_game_types(id, name)')
    .eq('league_id', leagueId)

  const games = (yearlyGames ?? [])
    .map((g: any) => g.yearly_game_types)
    .filter(Boolean) as { id: number; name: string }[]

  // ── Today's event for this league ────────────────────────
  const { data: todayEvent } = await adminClient
    .from('events')
    .select('id, event_date, status')
    .eq('league_id', leagueId)
    .eq('event_date', today)
    .neq('status', 'cancelled')
    .maybeSingle()

  // ── Scores exist today (any player) ──────────────────────
  let hasScoresToday = false
  let playerHasScoreToday = false

  if (todayEvent) {
    const { count: scoreCount } = await adminClient
      .from('scores')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', todayEvent.id)

    hasScoresToday = (scoreCount ?? 0) > 0

    // Check if the signed-in player has a score today
    if (playerId) {
      const { data: playerScore } = await adminClient
        .from('scores')
        .select('id, scorecard_id')
        .eq('event_id', todayEvent.id)
        .eq('player_id', playerId)
        .maybeSingle()

      playerHasScoreToday = !!playerScore
    }
  }

  // ── Player membership ─────────────────────────────────────
  let isMember = false
  let isAdmin  = isSuperAdmin

  if (playerId) {
    const { data: membership } = await adminClient
      .from('league_players')
      .select('is_player, is_admin')
      .eq('league_id', leagueId)
      .eq('player_id', playerId)
      .eq('active', true)
      .maybeSingle()

    isMember = membership?.is_player ?? false
    if (!isAdmin) isAdmin = membership?.is_admin ?? false
  }

  return {
    league,
    games,
    todayEvent: todayEvent ?? null,
    hasScoresToday,
    playerHasScoreToday,
    isMember,
    isAdmin,
    playerId,
  }
})