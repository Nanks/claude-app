// server/api/example-admin-route.ts
import { serverSupabaseServiceRole } from '#supabase/server'
import { requireAuth } from '#server/utils/requireAuth'

export default defineEventHandler(async (event) => {
  // Verify the requesting user is authenticated first
  await requireAuth(event)

  // Admin client — bypasses RLS, use only for trusted server operations
  const adminClient = serverSupabaseServiceRole(event)

  const { data, error } = await adminClient
    .from('players')
    .select('*')

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data
})