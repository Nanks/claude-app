// server/api/leagues/[id]/roster.get.ts
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

  const access = { isAdmin: false, myPlayerId: null as string | null }

  if (user?.id) {
    const { data: me } = await adminClient
      .from('players')
      .select('id, is_super_admin')
      .eq('auth_user_id', user.id)
      .single()

    if (me) {
      access.myPlayerId = me.id

      if (me.is_super_admin) {
        access.isAdmin = true
      } else {
        const { data: membership } = await adminClient
          .from('league_players')
          .select('is_admin')
          .eq('league_id', leagueId)
          .eq('player_id', me.id)
          .single()

        if (membership?.is_admin) access.isAdmin = true
      }
    }
  }

  // ── League config + tees ───────────────────────────────────
  // Use tees:tees_id(...) to resolve the FK join correctly.
  // Par is derived from the pars array — no par column exists on tees.
  const { data: leagueData } = await adminClient
    .from('leagues')
    .select(`
      app_handicap,
      course_id,
      tee_type,
      tees:tees_id (
        id,
        rating,
        slope,
        pars
      )
    `)
    .eq('id', leagueId)
    .single()

  // Derive total par from the pars array (sum of all 18 holes)
  const tees = leagueData?.tees as {
    id: string
    rating: number
    slope: number
    pars: number[]
  } | null

  const par = tees?.pars
    ? tees.pars.reduce((sum: number, p: number) => sum + p, 0)
    : 72

  const leagueConfig = {
    app_handicap: leagueData?.app_handicap ?? false,
    tee_type:     leagueData?.tee_type ?? 'mixed',
    rating:       tees?.rating ?? 72.0,
    slope:        tees?.slope  ?? 113,
    par,
  }

  // ── Active roster ──────────────────────────────────────────
  const { data: rosterData, error: rosterError } = await adminClient
    .from('league_players')
    .select(`
      player_id,
      is_admin,
      joined_at,
      players (
        id,
        fname,
        lname,
        tee_type,
        ghin,
        phone
      )
    `)
    .eq('league_id', leagueId)
    .eq('active', true)
    .eq('is_player', true)

  if (rosterError) {
    throw createError({ statusCode: 500, statusMessage: rosterError.message })
  }

  // ── League handicaps ───────────────────────────────────────
  const { data: handicapData } = await adminClient
    .from('player_league_handicaps')
    .select('player_id, handicap_value')
    .eq('league_id', leagueId)

  const handicapMap = new Map(
    (handicapData ?? []).map((h) => [h.player_id, h.handicap_value])
  )

  // ── Shape roster rows ──────────────────────────────────────
  const roster = (rosterData ?? [])
    .filter((r) => r.players)
    .map((r) => {
      // Supabase returns FK joins as an object, not an array.
      // Guard with Array.isArray for safety.
      const player = Array.isArray(r.players) ? r.players[0] : r.players as {
        id: string
        fname: string
        lname: string
        tee_type: string
        ghin: number | null
        phone: string
      }

      const ghinIndex = player.ghin ?? null

      // For app_handicap leagues use the stored league handicap.
      // For GHIN leagues calculate the standard course handicap:
      //   handicap = round((index × slope / 113) + (rating - par))
      let handicap: number | string | null = null

      if (leagueConfig.app_handicap) {
        handicap = handicapMap.get(player.id) ?? ghinIndex
      } else if (ghinIndex !== null) {
        const courseHcp =
          (ghinIndex * (leagueConfig.slope / 113)) +
          (leagueConfig.rating - leagueConfig.par)
        handicap = Math.round(courseHcp)
      }

      return {
        id:        player.id,
        firstName: player.fname,
        lastName:  player.lname,
        phone:     player.phone,
        teeType:   player.tee_type,
        ghin:      ghinIndex,
        isAdmin:   r.is_admin,
        handicap,
        joinedAt:  r.joined_at,
      }
    })
    .sort((a, b) => a.lastName.localeCompare(b.lastName))

  return { roster, access, leagueConfig }
})