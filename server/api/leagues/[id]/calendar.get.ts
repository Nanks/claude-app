// server/api/leagues/[id]/calendar.get.ts
import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'

export default defineEventHandler(async (event) => {
  const leagueId = getRouterParam(event, 'id')
  if (!leagueId) throw createError({ statusCode: 400, statusMessage: 'League ID is required' })

  const adminClient = serverSupabaseServiceRole<Database>(event)
  const userClient  = await serverSupabaseClient<Database>(event)

  // ── Auth ───────────────────────────────────────────────────
  const { data: authData } = await userClient.auth.getUser()
  const user = authData?.user

  let isAdmin = false

  if (user?.id) {
    const { data: me } = await adminClient
      .from('players')
      .select('id, is_super_admin')
      .eq('auth_user_id', user.id)
      .single()

    if (me) {
      if (me.is_super_admin) {
        isAdmin = true
      } else {
        const { data: membership } = await adminClient
          .from('league_players')
          .select('is_admin')
          .eq('league_id', leagueId)
          .eq('player_id', me.id)
          .eq('active', true)
          .maybeSingle()

        isAdmin = membership?.is_admin ?? false
      }
    }
  }

  // ── League ────────────────────────────────────────────────
  const { data: league, error: leagueError } = await adminClient
    .from('leagues')
    .select('id, name, short_name, theme_start_color, theme_end_color, course_id, tees_id, holes, per, tee_type')
    .eq('id', leagueId)
    .single()

  if (leagueError || !league) {
    throw createError({ statusCode: 404, statusMessage: 'League not found' })
  }

  // ── Parallel: events, courses, all tees, game types ───────
  const [
    { data: rawEvents,   error: eventsError },
    { data: coursesData },
    { data: allTeesData },
    { data: gameTypesData },
  ] = await Promise.all([
    adminClient
      .from('events')
      .select('id, event_date, status, holes, per, money, course_id, tees_id, double_birdie_holes')
      .eq('league_id', leagueId)
      .order('event_date', { ascending: true }),
    adminClient
      .from('courses')
      .select('id, name')
      .eq('active', true)
      .order('name'),
    adminClient
      .from('tees')
      .select('id, course_id, name, tee_types')
      .eq('active', true)
      .order('name'),
    adminClient
      .from('game_types')
      .select('id, name')
      .order('name'),
  ])

  if (eventsError) {
    throw createError({ statusCode: 500, statusMessage: eventsError.message })
  }

  // ── Event games (depends on event IDs) ────────────────────
  const eventIds = (rawEvents ?? []).map((e) => e.id)

  const { data: eventGamesData } = eventIds.length > 0
    ? await adminClient
        .from('event_games')
        .select('event_id, game_type_id')
        .in('event_id', eventIds)
    : { data: [] as { event_id: string; game_type_id: number }[] }

  // ── Build lookup maps ─────────────────────────────────────
  const teeById     = new Map((allTeesData ?? []).map((t) => [t.id, t.name]))
  const gameTypeById = new Map((gameTypesData ?? []).map((g) => [g.id, g.name]))

  const gamesByEvent = new Map<string, number[]>()
  for (const eg of (eventGamesData ?? [])) {
    if (!gamesByEvent.has(eg.event_id)) gamesByEvent.set(eg.event_id, [])
    gamesByEvent.get(eg.event_id)!.push(eg.game_type_id)
  }

  // ── Shape events ──────────────────────────────────────────
  const events = (rawEvents ?? []).map((evt) => {
    const gameTypeIds = gamesByEvent.get(evt.id) ?? []
    return {
      id:                  evt.id,
      event_date:          evt.event_date,
      status:              evt.status,
      holes:               evt.holes,
      per:                 evt.per,
      money:               evt.money,
      course_id:           evt.course_id,
      tees_id:             evt.tees_id,
      tee_name:            evt.tees_id ? (teeById.get(evt.tees_id) ?? null) : null,
      double_birdie_holes: evt.double_birdie_holes as number[] | null,
      game_type_ids:       gameTypeIds,
      game_names:          gameTypeIds.map((id) => gameTypeById.get(id) ?? '').filter(Boolean),
    }
  })

  // ── Shape courses with tees ───────────────────────────────
  const courses = (coursesData ?? []).map((course) => ({
    id:   course.id,
    name: course.name,
    tees: (allTeesData ?? []).filter((t) => t.course_id === course.id),
  }))

  const gameTypes = (gameTypesData ?? []).map((g) => ({ id: g.id, name: g.name }))

  return {
    league,
    events,
    courses,
    gameTypes,
    isAdmin,
  }
})
