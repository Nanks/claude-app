// server/api/scores/index.get.ts
// Accessible at GET /api/scores

import { requireAuth } from '#server/utils/requireAuth'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
  // Throws 401 automatically if no valid session
  const user = await requireAuth(event)

  const client = await serverSupabaseClient(event)

  const { data, error } = await client
    .from('scores')
    .select('*')
    .eq('player_id', user.id)

  if (error) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message,
    })
  }

  return data
})