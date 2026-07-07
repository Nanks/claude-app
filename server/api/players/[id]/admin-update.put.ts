// server/api/players/[id]/admin-update.put.ts
import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const playerId = getRouterParam(event, 'id')
  if (!playerId) throw createError({ statusCode: 400, statusMessage: 'Player ID is required' })

  const adminClient = serverSupabaseServiceRole(event)
  const userClient  = await serverSupabaseClient(event)

  // Auth via getUser() — reliable for client-side $fetch calls
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

  // Verify the requesting user is an admin of a shared league
  if (!me.is_super_admin) {
    // Get leagues the target player belongs to
    const { data: targetLeagues } = await adminClient
      .from('league_players')
      .select('league_id')
      .eq('player_id', playerId)
      .eq('active', true)

    const targetLeagueIds = targetLeagues?.map((r) => r.league_id) ?? []

    if (targetLeagueIds.length === 0) {
      throw createError({ statusCode: 403, statusMessage: 'Player not found in any league' })
    }

    const { data: sharedLeague } = await adminClient
      .from('league_players')
      .select('league_id')
      .eq('player_id', me.id)
      .eq('is_admin', true)
      .eq('active', true)
      .in('league_id', targetLeagueIds)
      .maybeSingle()

    if (!sharedLeague) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not an admin of any league this player belongs to',
      })
    }
  }

  const body = await readBody(event)
  const { fname, lname, phone, ghin, tee_type, active } = body

  const updates: Record<string, any> = {}
  if (fname  !== undefined) updates.fname  = fname.trim()
  if (lname  !== undefined) updates.lname  = lname.trim()
  if (ghin   !== undefined) updates.ghin   = Math.round((Number(ghin)) * 10) / 10
  if (active !== undefined) updates.active = active

  // Sanitize and validate phone if provided
  if (phone !== undefined) {
    const digits = String(phone).replace(/\D/g, '')
    let normalized: string | null = null
    if (digits.length === 10) normalized = `+1${digits}`
    else if (digits.length === 11 && digits.startsWith('1')) normalized = `+${digits}`

    if (!normalized) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid phone number — must be a 10-digit US number' })
    }

    // Check for duplicate phone (another player with the same number)
    const { data: existing } = await adminClient
      .from('players')
      .select('id')
      .eq('phone', normalized)
      .neq('id', playerId)
      .maybeSingle()

    if (existing) {
      throw createError({ statusCode: 409, statusMessage: 'This phone number is already used by another player' })
    }

    updates.phone = normalized
  }

  // If tee_type changed, update tees_id from course defaults.
  // Leagues with a fixed tee_type (anything but 'mixed') override whatever the client sent —
  // e.g. a ladies-only league always assigns ladies tees regardless of form input.
  if (tee_type !== undefined) {
    const { data: membership } = await adminClient
      .from('league_players')
      .select('leagues(course_id, tee_type)')
      .eq('player_id', playerId)
      .eq('is_player', true)
      .eq('active', true)
      .limit(1)
      .single()

    const leagueInfo = membership?.leagues as unknown as { course_id: string; tee_type: string } | null
    const effectiveTeeType = leagueInfo && leagueInfo.tee_type !== 'mixed'
      ? leagueInfo.tee_type
      : tee_type

    updates.tee_type = effectiveTeeType

    if (leagueInfo?.course_id) {
      const { data: defaultTee } = await adminClient
        .from('course_default_tees')
        .select('tees_id')
        .eq('course_id', leagueInfo.course_id)
        .eq('tee_type', effectiveTeeType)
        .maybeSingle()

      if (defaultTee) updates.tees_id = defaultTee.tees_id
    }
  }

  const { error: updateError } = await adminClient
    .from('players')
    .update(updates)
    .eq('id', playerId)

  if (updateError) {
    throw createError({ statusCode: 500, statusMessage: updateError.message })
  }

  return { message: 'Player updated successfully' }
})