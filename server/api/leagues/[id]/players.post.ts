// server/api/leagues/[id]/players.post.ts
// Adds a player to a league.
// If the phone number already exists in players, links them.
// If not, creates a new player record then links them.
// Admin only — enforced server-side.

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import { requireAuth } from '#server/utils/requireAuth'

export default defineEventHandler(async (event) => {
  const leagueId = getRouterParam(event, 'id')
  if (!leagueId) throw createError({ statusCode: 400, statusMessage: 'League ID is required' })

  const adminClient = serverSupabaseServiceRole(event)
  const userClient  = await serverSupabaseClient(event)
  const authUser    = await requireAuth(event)

  // Verify the requesting user is an admin of this league
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
      .single()

    if (!membership?.is_admin) {
      throw createError({ statusCode: 403, statusMessage: 'Only league admins can add players' })
    }
  }

  const body = await readBody(event)
  const { fname, lname, phone, ghin, tee_type } = body

  if (!fname || !lname || !phone) {
    throw createError({ statusCode: 400, statusMessage: 'fname, lname and phone are required' })
  }

  // Resolve the default tees_id for this player's tee_type from the league's course.
  // Leagues with a fixed tee_type (anything but 'mixed') override whatever the client sent —
  // e.g. a ladies-only league always assigns ladies tees regardless of form input.
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
      statusMessage: `No default tee found for tee_type '${effectiveTeeType}' on this league's course`,
    })
  }

  // Check if a player with this phone already exists
  let playerId: string

  const { data: existing } = await adminClient
    .from('players')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    playerId = existing.id

    // Update their details in case they changed
    await adminClient
      .from('players')
      .update({ fname, lname, ghin, tee_type, tees_id: defaultTee.tees_id })
      .eq('id', playerId)

  } else {
    // Create new player
    const { data: newPlayer, error: createError_ } = await adminClient
      .from('players')
      .insert({
        fname,
        lname,
        phone,
        ghin,
        tee_type,
        tees_id: defaultTee.tees_id,
        active:  true,
      })
      .select('id')
      .single()

    if (createError_ || !newPlayer) {
      throw createError({ statusCode: 500, statusMessage: createError_?.message ?? 'Failed to create player' })
    }

    playerId = newPlayer.id
  }

  // Add or reactivate league membership
  const { error: memberError } = await adminClient
    .from('league_players')
    .upsert(
      {
        league_id: leagueId,
        player_id: playerId,
        is_player: true,
        is_admin:  false,
        active:    true,
      },
      { onConflict: 'league_id,player_id' }
    )

  if (memberError) {
    throw createError({ statusCode: 500, statusMessage: memberError.message })
  }

  return { playerId, message: 'Player added successfully' }
})