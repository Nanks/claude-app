// server/api/players/[id]/handicap-audit.get.ts
// Returns the player_league_audit rows for a given player + league.
// Ordered by round_position ascending (1 = most recent).
// Accessible to the player themselves or any league admin.

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')
  const leagueId = getQuery(event).leagueId as string | undefined

  if (!playerId) throw createError({ statusCode: 400, statusMessage: 'Player ID is required' })
  if (!leagueId) throw createError({ statusCode: 400, statusMessage: 'leagueId query param is required' })

  const adminClient = serverSupabaseServiceRole(event)
  const userClient  = await serverSupabaseClient(event)

  // Use getUser() instead of requireAuth so we can handle
  // the 401 gracefully rather than throwing from middleware
  const { data: authData } = await userClient.auth.getUser()
  const authUser = authData?.user

  if (!authUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  // Get the requesting player
  const { data: me } = await adminClient
    .from('players')
    .select('id, is_super_admin')
    .eq('auth_user_id', authUser.id)
    .single()

  if (!me) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  // Allow if: own record, super admin, or league admin
  const isSelf       = me.id === playerId
  const isSuperAdmin = me.is_super_admin

  if (!isSelf && !isSuperAdmin) {
    const { data: membership } = await adminClient
      .from('league_players')
      .select('is_admin')
      .eq('league_id', leagueId)
      .eq('player_id', me.id)
      .eq('active', true)
      .maybeSingle()

    if (!membership?.is_admin) {
      throw createError({ statusCode: 403, statusMessage: 'Unauthorized' })
    }
  }

  // Fetch audit rows
  const { data: history, error } = await adminClient
    .from('player_league_audit')
    .select(`
      id,
      event_date,
      raw_gross,
      adjusted_gross,
      course_rating,
      slope_rating,
      differential,
      is_best,
      is_padding,
      round_position
    `)
    .eq('player_id', playerId)
    .eq('league_id', leagueId)
    .order('round_position', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { history: history ?? [] }
})