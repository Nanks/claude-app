// server/api/leagues/[id]/push/broadcast.post.ts
// Admin-only: broadcast a push notification to league members.
// Body: { title, body, target: 'members' | 'event', url? }
//   target='members' → all active league players with subscriptions
//   target='event'   → players who have a score in today's live/scheduled event

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'
import { sendPushToPlayers } from '#server/utils/webpush'

export default defineEventHandler(async (event) => {
  const leagueId = getRouterParam(event, 'id')
  if (!leagueId) throw createError({ statusCode: 400, statusMessage: 'League ID required' })

  const userClient  = await serverSupabaseClient<Database>(event)
  const adminClient = serverSupabaseServiceRole<Database>(event)

  // ── Auth + admin check ────────────────────────────────────────
  const { data: authData } = await userClient.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

  const { data: me } = await adminClient
    .from('players')
    .select('id, is_super_admin')
    .eq('auth_user_id', userId)
    .single()

  if (!me) throw createError({ statusCode: 403, statusMessage: 'Forbidden' })

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

  // ── Body ──────────────────────────────────────────────────────
  const body   = await readBody(event)
  const title  = (body.title  as string | undefined)?.trim()
  const msg    = (body.body   as string | undefined)?.trim()
  const target = (body.target as string | undefined) ?? 'members'
  const url    = (body.url    as string | undefined) ?? `/leagues/${leagueId}`

  if (!title || !msg) {
    throw createError({ statusCode: 400, statusMessage: 'title and body are required' })
  }

  // ── Resolve player IDs ────────────────────────────────────────
  let playerIds: string[]

  if (target === 'event') {
    // Players scoring in today's live/scheduled event for this league
    const today = new Date().toISOString().slice(0, 10)

    const { data: todayEvent } = await adminClient
      .from('events')
      .select('id')
      .eq('league_id', leagueId)
      .in('status', ['scheduled', 'live'])
      .eq('event_date', today)
      .maybeSingle()

    if (!todayEvent) {
      throw createError({ statusCode: 404, statusMessage: 'No active event today for this league' })
    }

    const { data: scores } = await adminClient
      .from('scores')
      .select('player_id')
      .eq('event_id', todayEvent.id)

    playerIds = [...new Set((scores ?? []).map(s => s.player_id))]
  }
  else {
    // All active league members
    const { data: members } = await adminClient
      .from('league_players')
      .select('player_id')
      .eq('league_id', leagueId)
      .eq('active', true)

    playerIds = (members ?? []).map(m => m.player_id)
  }

  if (!playerIds.length) {
    return { ok: true, sent: 0, stale: 0, message: 'No players to notify' }
  }

  const result = await sendPushToPlayers(adminClient, playerIds, { title, body: msg, url })

  return { ok: true, ...result }
})
