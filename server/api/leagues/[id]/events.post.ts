// server/api/leagues/[id]/events.post.ts
import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database, EventStatus } from '~~/shared/types/database.types'

export default defineEventHandler(async (event) => {
  const leagueId = getRouterParam(event, 'id')
  if (!leagueId) throw createError({ statusCode: 400, statusMessage: 'League ID is required' })

  const userClient  = await serverSupabaseClient<Database>(event)
  const adminClient = serverSupabaseServiceRole<Database>(event)

  // Bulletproof auth: use the native Supabase method, not the Nuxt helper
  const { data: authData } = await userClient.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  // ── Resolve player + admin check ──────────────────────────
  const { data: me } = await adminClient
    .from('players')
    .select('id, is_super_admin')
    .eq('auth_user_id', userId)
    .single()

  if (!me) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  let isAdmin = me.is_super_admin
  if (!isAdmin) {
    const { data: membership } = await adminClient
      .from('league_players')
      .select('is_admin')
      .eq('league_id', leagueId)
      .eq('player_id', me.id)
      .eq('active', true)
      .maybeSingle()

    isAdmin = membership?.is_admin ?? false
  }

  if (!isAdmin) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  // ── League defaults (fallback when caller omits fields) ───
  const { data: league } = await adminClient
    .from('leagues')
    .select('course_id, tees_id, holes, per')
    .eq('id', leagueId)
    .single()

  if (!league) throw createError({ statusCode: 404, statusMessage: 'League not found' })

  // ── Validate body ─────────────────────────────────────────
  const body = await readBody(event)
  const {
    event_date,
    status        = 'scheduled',
    holes         = league.holes ?? 18,
    per           = league.per   ?? 0,
    money         = 1,
    course_id     = league.course_id,
    tees_id,
    game_type_ids = [],
  } = body

  if (!event_date || !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    throw createError({ statusCode: 400, statusMessage: 'event_date must be YYYY-MM-DD' })
  }

  // tees_id: empty string from the form means null (mixed-tee league)
  const resolvedTeesId = tees_id !== undefined
    ? (tees_id || null)
    : (league.tees_id ?? null)

  // ── Insert event ──────────────────────────────────────────
  const { data: newEvent, error } = await adminClient
    .from('events')
    .insert({
      league_id:  leagueId,
      course_id,
      tees_id:    resolvedTeesId,
      event_date,
      status:     status as EventStatus,
      holes:      Number(holes) || 18,
      per:        Number(per)   || 0,
      money:      Number(money) || 0,
    })
    .select('id')
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })

  // ── Insert event_games ────────────────────────────────────
  const ids = (game_type_ids as number[]).filter((id) => typeof id === 'number')
  if (ids.length > 0) {
    const { error: gamesError } = await adminClient
      .from('event_games')
      .insert(ids.map((game_type_id) => ({ event_id: newEvent.id, game_type_id })))

    if (gamesError) throw createError({ statusCode: 500, statusMessage: gamesError.message })
  }

  return { id: newEvent.id }
})
