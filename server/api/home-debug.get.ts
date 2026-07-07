// server/api/home-debug.get.ts
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  const client = await serverSupabaseClient(event)

  // Check 1: What does the leagues table actually contain?
  const { data: leagues, error: leaguesError } = await client
    .from('leagues')
    .select('id, name, active, firebase_id')

  // Check 2: Is the user session being read correctly?
  const userInfo = user

  return {
    userInfo,
    leagueCount: leagues?.length ?? 0,
    leagues,
    leaguesError: leaguesError?.message ?? null,
  }
})