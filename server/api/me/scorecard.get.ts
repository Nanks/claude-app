// server/api/me/scorecard.get.ts
// Returns the active round scorecard for the authenticated player.
// Shows all players whose score rows were entered_by the current player.

import { serverSupabaseServiceRole, serverSupabaseClient } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'

function computePops(playingHandicap: number, hnds: number[]): number[] {
  if (playingHandicap <= 0) return Array(hnds.length).fill(0)
  const base  = Math.floor(playingHandicap / 18)
  const extra = playingHandicap % 18
  return hnds.map(hnd => base + (hnd <= extra ? 1 : 0))
}

export default defineEventHandler(async (event) => {
  const userClient  = await serverSupabaseClient<Database>(event)
  const adminClient = serverSupabaseServiceRole<Database>(event)

  const { data: authData } = await userClient.auth.getUser()
  const userId = authData?.user?.id
  if (!userId) return null

  const { data: me } = await adminClient
    .from('players')
    .select('id')
    .eq('auth_user_id', userId)
    .single()
  if (!me) return null

  // ── Find the active (live) event this player has a score in ──────
  const { data: liveEvents } = await adminClient
    .from('events')
    .select('id')
    .eq('status', 'live')

  if (!liveEvents?.length) return null

  const { data: myScoreRef } = await adminClient
    .from('scores')
    .select('event_id')
    .eq('player_id', me.id)
    .in('event_id', liveEvents.map(e => e.id))
    .maybeSingle()

  if (!myScoreRef) return null
  const eventId = myScoreRef.event_id

  // ── Fetch all players in this scorer's session ────────────────────
  const { data: sessionScores } = await adminClient
    .from('scores')
    .select([
      'id', 'player_id', 'tees_id', 'playing_handicap',
      'hole_1',  'hole_2',  'hole_3',  'hole_4',  'hole_5',  'hole_6',
      'hole_7',  'hole_8',  'hole_9',  'hole_10', 'hole_11', 'hole_12',
      'hole_13', 'hole_14', 'hole_15', 'hole_16', 'hole_17', 'hole_18',
    ].join(', '))
    .eq('event_id', eventId)
    .eq('entered_by', me.id)

  if (!sessionScores?.length) return null

  // ── Parallel fetch: event, players, tees ─────────────────────────
  const playerIds   = sessionScores.map(s => s.player_id)
  const uniqueTeeIds = [...new Set(sessionScores.map(s => s.tees_id))]

  const [
    { data: evt },
    { data: playerRows },
    { data: teeRows },
  ] = await Promise.all([
    adminClient.from('events').select('id, holes, event_date, league_id, course_id, tees_id').eq('id', eventId).single(),
    adminClient.from('players').select('id, fname, lname').in('id', playerIds),
    adminClient.from('tees').select('id, name, pars, hnds').in('id', uniqueTeeIds),
  ])

  if (!evt) return null

  const [
    { data: league },
    { data: course },
    { data: eventGamesWithTypes },
    { data: yearlyGamesWithTypes },
  ] = await Promise.all([
    adminClient.from('leagues').select('name').eq('id', evt.league_id).single(),
    adminClient.from('courses').select('name').eq('id', evt.course_id).single(),
    (adminClient.from('event_games') as any).select('game_types(name)').eq('event_id', eventId),
    (adminClient.from('league_yearly_games') as any).select('yearly_game_types(name)').eq('league_id', evt.league_id),
  ])

  const gameNames: string[]       = (eventGamesWithTypes  ?? []).map((g: any) => g.game_types?.name).filter(Boolean)
  const yearlyNames: string[]     = (yearlyGamesWithTypes ?? []).map((g: any) => g.yearly_game_types?.name).filter(Boolean)
  const showDeuceGame    = gameNames.some(n => n.toLowerCase().includes('deuce pot'))
  const showNetDeuceGame = yearlyNames.some(n => n.toLowerCase().includes('deuce'))

  const playerMap = new Map((playerRows ?? []).map(p => [p.id, p]))
  const teeMap    = new Map((teeRows ?? []).map(t => [t.id, t]))

  // ── Build hole data using the event's primary tee ────────────────
  const primaryTeeId = evt.tees_id ?? sessionScores[0]?.tees_id
  const primaryTee   = teeMap.get(primaryTeeId ?? '')
  const pars = (primaryTee?.pars as number[]) ?? Array(18).fill(4)
  const hnds = (primaryTee?.hnds as number[]) ?? Array.from({ length: 18 }, (_, i) => i + 1)

  const holeData = Array.from({ length: evt.holes }, (_, idx) => ({
    hole: idx + 1,
    par:  pars[idx] ?? 4,
    hnd:  hnds[idx] ?? (idx + 1),
  }))

  // ── Build player rows with pops and hole scores ───────────────────
  const players = sessionScores.map(s => {
    const p   = playerMap.get(s.player_id)
    const tee = teeMap.get(s.tees_id)
    const playerHnds = (tee?.hnds as number[]) ?? Array.from({ length: 18 }, (_, i) => i + 1)
    const pops   = computePops(s.playing_handicap, playerHnds).slice(0, evt.holes)
    const scores = [
      s.hole_1,  s.hole_2,  s.hole_3,  s.hole_4,  s.hole_5,  s.hole_6,
      s.hole_7,  s.hole_8,  s.hole_9,  s.hole_10, s.hole_11, s.hole_12,
      s.hole_13, s.hole_14, s.hole_15, s.hole_16, s.hole_17, s.hole_18,
    ].slice(0, evt.holes)

    return {
      score_id:         s.id,
      player_id:        s.player_id,
      fname:            p?.fname ?? '?',
      lname:            p?.lname ?? '',
      tees_name:        tee?.name ?? '',
      playing_handicap: s.playing_handicap,
      pops,
      scores,
      pars: ((tee?.pars as number[]) ?? Array(18).fill(4)).slice(0, evt.holes),
    }
  }).sort((a, b) => a.lname.localeCompare(b.lname) || a.fname.localeCompare(b.fname))

  return {
    event: {
      id:           evt.id,
      league_id:    evt.league_id,
      holes:        evt.holes,
      event_date:   evt.event_date,
      league_name:  league?.name ?? '',
      course_name:  course?.name ?? '',
    },
    showDeuceGame,
    showNetDeuceGame,
    holeData,
    players,
  }
})
