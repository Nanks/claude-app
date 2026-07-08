// POST /api/leagues/[id]/members
// Adds an existing player to a league by player_id.
// Body: { player_id, tee_type }
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

  const body = await readBody(event)
  const { player_id, tee_type } = body

  if (!player_id) throw createError({ statusCode: 400, statusMessage: 'player_id is required' })

  // Resolve league + effective tee type
  const { data: league } = await adminClient
    .from('leagues')
    .select('course_id, tee_type')
    .eq('id', leagueId)
    .single()

  if (!league) throw createError({ statusCode: 404, statusMessage: 'League not found' })

  const effectiveTeeType = league.tee_type !== 'mixed' ? league.tee_type : tee_type

  if (!effectiveTeeType) {
    throw createError({ statusCode: 400, statusMessage: 'tee_type is required for mixed leagues' })
  }

  const { data: defaultTee } = await adminClient
    .from('course_default_tees')
    .select('tees_id')
    .eq('course_id', league.course_id)
    .eq('tee_type', effectiveTeeType)
    .maybeSingle()

  if (!defaultTee) {
    throw createError({
      statusCode: 400,
      statusMessage: `No default tee found for '${effectiveTeeType}' on this league's course`,
    })
  }

  // Update the player's tee assignment
  await adminClient
    .from('players')
    .update({ tee_type: effectiveTeeType, tees_id: defaultTee.tees_id })
    .eq('id', player_id)

  // Add or reactivate league membership
  const { error: memberError } = await adminClient
    .from('league_players')
    .upsert(
      {
        league_id: leagueId,
        player_id,
        is_player: true,
        is_admin:  false,
        active:    true,
      },
      { onConflict: 'league_id,player_id' },
    )

  if (memberError) {
    throw createError({ statusCode: 500, statusMessage: memberError.message })
  }

  return { ok: true }
})
