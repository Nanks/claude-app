// server/api/events/[id].put.ts
import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database, EventStatus } from '~~/shared/types/database.types'

export default defineEventHandler(async (event) => {
  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'Event ID is required' })

  const userClient  = await serverSupabaseClient<Database>(event)
  const adminClient = serverSupabaseServiceRole<Database>(event)

  // Bulletproof auth: use the native Supabase method, not the Nuxt helper
  const { data: authData } = await userClient.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  // ── Resolve player ────────────────────────────────────────
  const { data: me } = await adminClient
    .from('players')
    .select('id, is_super_admin')
    .eq('auth_user_id', userId)
    .single()

  if (!me) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  // ── Find event to get league_id ───────────────────────────
  const { data: existingEvent } = await adminClient
    .from('events')
    .select('id, league_id')
    .eq('id', eventId)
    .single()

  if (!existingEvent) throw createError({ statusCode: 404, statusMessage: 'Event not found' })

  // ── Admin check for that league ───────────────────────────
  let isAdmin = me.is_super_admin
  if (!isAdmin) {
    const { data: membership } = await adminClient
      .from('league_players')
      .select('is_admin')
      .eq('league_id', existingEvent.league_id)
      .eq('player_id', me.id)
      .eq('active', true)
      .maybeSingle()

    isAdmin = membership?.is_admin ?? false
  }

  if (!isAdmin) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

  // ── Validate body ─────────────────────────────────────────
  const body = await readBody(event)
  const { event_date, status, holes, per, money, course_id, tees_id, game_type_ids } = body

  if (event_date && !/^\d{4}-\d{2}-\d{2}$/.test(event_date)) {
    throw createError({ statusCode: 400, statusMessage: 'event_date must be YYYY-MM-DD' })
  }

  // ── Build patch ───────────────────────────────────────────
  const patch: Record<string, unknown> = {}
  if (event_date  !== undefined) patch.event_date = event_date
  if (status      !== undefined) patch.status     = status as EventStatus
  if (holes       !== undefined) patch.holes      = Number(holes) || 18
  if (per         !== undefined) patch.per        = Number(per) || 0
  if (money       !== undefined) patch.money      = Number(money) || 0
  if (course_id   !== undefined) patch.course_id  = course_id
  if (tees_id     !== undefined) patch.tees_id    = tees_id || null  // '' → null

  // ── Update event ──────────────────────────────────────────
  if (Object.keys(patch).length > 0) {
    const { error } = await adminClient
      .from('events')
      .update(patch)
      .eq('id', eventId)

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  }

  // ── Sync event_games if provided ──────────────────────────
  if (game_type_ids !== undefined) {
    const ids = (game_type_ids as number[]).filter((id) => typeof id === 'number')

    await adminClient.from('event_games').delete().eq('event_id', eventId)

    if (ids.length > 0) {
      const { error: gamesError } = await adminClient
        .from('event_games')
        .insert(ids.map((game_type_id) => ({ event_id: eventId, game_type_id })))

      if (gamesError) throw createError({ statusCode: 500, statusMessage: gamesError.message })
    }
  }

  return { id: eventId }
})
