// server/api/health/db.get.ts
import { serverSupabaseServiceRole } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event)

  const { data, error } = await client
    .from('game_types')
    .select('id, name')

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return {
    connected: true,
    gameTypes: data,
  }
})