// GET /api/leagues/[id]/players/search?q=term
// Returns players NOT already active in this league whose name matches q.
// Admin only.

import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAuth } from '#server/utils/requireAuth'

export default defineEventHandler(async (event) => {
  const leagueId = getRouterParam(event, 'id')
  if (!leagueId) throw createError({ statusCode: 400, statusMessage: 'League ID required' })

  const adminClient = serverSupabaseServiceRole(event)
  const authUser    = await requireAuth(event)

  const { data: me } = await adminClient
    .from('players')
    .select('id, is_super_admin')
    .eq('auth_user_id', authUser.id)
    .single()

  if (!me) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  if (!me.is_super_admin) {
    const { data: membership } = await adminClient
      .from('league_players')
      .select('is_admin')
      .eq('league_id', leagueId)
      .eq('player_id', me.id)
      .eq('active', true)
      .maybeSingle()

    if (!membership?.is_admin) {
      throw createError({ statusCode: 403, statusMessage: 'Admins only' })
    }
  }

  const q = ((getQuery(event).q as string) ?? '').trim()
  if (q.length < 2) return { players: [] }

  // Collect IDs already active in this league so we can exclude them
  const { data: existing } = await adminClient
    .from('league_players')
    .select('player_id')
    .eq('league_id', leagueId)
    .eq('active', true)

  const existingIds = (existing ?? []).map(e => e.player_id)

  let qb = adminClient
    .from('players')
    .select('id, fname, lname, ghin')
    .or(`fname.ilike.%${q}%,lname.ilike.%${q}%`)
    .eq('active', true)
    .order('lname')
    .limit(10)

  if (existingIds.length > 0) {
    qb = qb.not('id', 'in', `(${existingIds.join(',')})`)
  }

  const { data: players } = await qb

  return { players: players ?? [] }
})
