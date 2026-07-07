// server/api/home.get.ts
import {
  serverSupabaseClient,
  serverSupabaseServiceRole,
} from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'

export default defineEventHandler(async (event) => {
  // Initialize both clients with strict Database types
  const userClient  = await serverSupabaseClient<Database>(event)
  const adminClient = await serverSupabaseServiceRole<Database>(event)

  const today = new Date().toISOString().slice(0, 10)

  // BULLETPROOF AUTH FETCH: Use the native Supabase JS method instead of the Nuxt helper
  const { data: authData, error: authError } = await userClient.auth.getUser()
  const user = authData?.user

  // 1. Fetch the player FIRST using adminClient to securely bypass the RLS function loop
  let player = null

  // Added a strict user.id check so "undefined" can never be sent to the DB
  if (user && user.id) {
    const { data, error } = await adminClient
      .from('players')
      .select('id, fname, lname, ghin, tee_type, is_super_admin') 
      .eq('auth_user_id', user.id)
      .single()

    if (error) {
      console.log('--- DEBUG: PLAYER NOT FOUND ---')
      console.log('Auth ID:', user.id)
      console.log('Error:', error.message)
      console.log('-------------------------------')
    } else {
      player = data
    }
  } else {
    console.log('--- DEBUG: NO ACTIVE AUTH SESSION ---')
    console.log('Auth Error:', authError?.message)
  }

  // 2. Fetch all leagues
  const { data: allLeagues, error: leaguesError } = await adminClient
    .from('leagues')
    // Single-line string so TypeScript correctly infers the column types
    .select('id, name, short_name, tee_type, app_handicap, theme_start_color, theme_end_color, holes, course_id, tees_id')
    .eq('active', true)

  if (leaguesError) {
    throw createError({ statusCode: 500, statusMessage: leaguesError.message })
  }

  const safeLeagues = allLeagues || []
  const leagueIds = safeLeagues.map((l) => l.id)

  // 3. Fetch events and scores
  const [nextEventsResult, liveEventsResult, liveScoresResult] = await Promise.all([
    adminClient
      .from('events')
      .select('id, league_id, event_date, status')
      .in('league_id', leagueIds)
      .eq('status', 'scheduled')
      .gte('event_date', today)
      .order('event_date', { ascending: true }),

    adminClient
      .from('events')
      .select('id, league_id, event_date')
      .in('league_id', leagueIds)
      .eq('status', 'live'),

    adminClient
      .from('scores')
      .select('event_id, league_id')
      .in('league_id', leagueIds)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lte('created_at', `${today}T23:59:59.999Z`),
  ])

  // Build lookup maps
  const nextEventByLeague: Record<string, string | null> = {}
  const liveLeagueIds = new Set<string>()

  for (const event of nextEventsResult.data || []) {
    if (!nextEventByLeague[event.league_id]) {
      nextEventByLeague[event.league_id] = event.event_date
    }
  }

  for (const event of liveEventsResult.data || []) {
    liveLeagueIds.add(event.league_id)
  }

  for (const score of liveScoresResult.data || []) {
    if (score.league_id) liveLeagueIds.add(score.league_id)
  }

  // Check which live events the current player has a score in
  const playerActiveLeagueIds = new Set<string>()
  const liveEventIds = (liveEventsResult.data ?? []).map(e => e.id)

  if (player?.id && liveEventIds.length) {
    const { data: playerLiveScores } = await adminClient
      .from('scores')
      .select('league_id')
      .eq('player_id', player.id)
      .in('event_id', liveEventIds)
    for (const s of playerLiveScores ?? []) {
      if (s.league_id) playerActiveLeagueIds.add(s.league_id)
    }
  }

  // 4. Fetch league memberships (Safely guarded by strict null checks)
  const playerLeagueIds = new Set<string>()
  const adminLeagueIds = new Set<string>()  

  if (player && player.id) {
    const { data: memberships } = await adminClient
      .from('league_players')
      .select('league_id, is_player, is_admin')
      .eq('player_id', player.id)
      .eq('active', true)

    for (const m of memberships || []) {
      if (m.is_player) playerLeagueIds.add(m.league_id)
      if (m.is_admin) adminLeagueIds.add(m.league_id)
    }

    if (player.is_super_admin) {
      safeLeagues.forEach((l) => adminLeagueIds.add(l.id))
    }
  }

  // 5. Map everything together for the frontend
  const leagues = safeLeagues.map((league) => ({
    ...league,
    nextEventDate:        nextEventByLeague[league.id] ?? null,
    isLive:               liveLeagueIds.has(league.id),
    isMember:             playerLeagueIds.has(league.id),
    isAdmin:              adminLeagueIds.has(league.id),
    playerHasActiveRound: playerActiveLeagueIds.has(league.id),
  }))

  return { player, leagues }
})