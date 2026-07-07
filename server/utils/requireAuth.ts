// server/utils/requireAuth.ts
// Auto-imported by Nuxt in the server/ context — no import needed in consumers.

import { serverSupabaseUser } from '#supabase/server'
import type { H3Event } from 'h3'

/**
 * Verifies a valid Supabase session exists for the current request.
 * Throws a 401 if unauthenticated.
 * Use in any server/api route that requires authentication.
 */
export async function requireAuth(event: H3Event) {
  const user = await serverSupabaseUser(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  return user
}