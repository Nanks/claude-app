// server/api/leagues/[id]/recalculate.post.ts
import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import { recalculateLeagueHandicap } from '~~/server/utils/handicap'

export default defineEventHandler(async (event) => {
  const leagueId = getRouterParam(event, 'id')
  if (!leagueId) throw createError({ statusCode: 400, statusMessage: 'League ID is required' })

  const adminClient = serverSupabaseServiceRole(event)       // not async
  const userClient  = await serverSupabaseClient(event)

  // Verify the requesting user is a league admin
  const { data: authData } = await userClient.auth.getUser()
  const authUser = authData?.user

  if (!authUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

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
      throw createError({ statusCode: 403, statusMessage: 'Only league admins can recalculate handicaps' })
    }
  }

  // Fetch all active players in this league
  const { data: players } = await adminClient
    .from('league_players')
    .select('player_id, players ( ghin )')
    .eq('league_id', leagueId)
    .eq('active', true)
    .eq('is_player', true)

  if (!players || players.length === 0) {
    return { completed: 0, total: 0 }
  }

  const total     = players.length
  let   completed = 0

  for (const p of players) {
    const player = Array.isArray(p.players) ? p.players[0] : p.players as { ghin: number | null } | null
    if (player) {
      await recalculateLeagueHandicap(
        adminClient,
        p.player_id,
        leagueId,
        player.ghin ?? 0,
      )
      completed++
    }
  }

  return { completed, total }
})