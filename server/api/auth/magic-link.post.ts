// server/api/auth/magic-link.post.ts
// Validates the player's name + email before allowing a magic-link sign-in.
//
// First sign-in:  fname+lname found, no email on record
//   → create Supabase auth user, link to player, store email
// Returning:      fname+lname found, email already stored
//   → verify email matches; no DB changes needed
//
// On success the client calls signInWithOtp({ email, shouldCreateUser: false })
// which sends the magic link. We never create users from the client side.

import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~~/shared/types/database.types'

export default defineEventHandler(async (event) => {
  const body  = await readBody(event)
  const fname = (body.fname ?? '').trim()
  const lname = (body.lname ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()

  if (!fname || !lname) {
    throw createError({ statusCode: 400, statusMessage: 'First and last name are required.' })
  }
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'A valid email address is required.' })
  }

  const admin = serverSupabaseServiceRole<Database>(event)

  // ── Find player by name (case-insensitive) ────────────────────
  const { data: player, error: lookupErr } = await admin
    .from('players')
    .select('id, fname, lname, email, auth_user_id, active')
    .ilike('fname', fname)
    .ilike('lname', lname)
    .maybeSingle()

  if (lookupErr) {
    throw createError({ statusCode: 500, statusMessage: 'Database error. Please try again.' })
  }

  if (!player || !player.active) {
    throw createError({
      statusCode: 403,
      statusMessage: 'No active player found with that name. Contact your league admin.',
    })
  }

  // ── Returning player: email must match ────────────────────────
  if (player.email) {
    if (player.email.toLowerCase() !== email) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Name and email don\'t match our records.',
      })
    }
    // All good — auth user already exists; client will send the magic link
    return { ok: true }
  }

  // ── First sign-in: create auth user and link to this player ──
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,   // mark email as confirmed — the magic link click is the verification
  })

  if (createErr) {
    if (createErr.status === 422 || createErr.message.toLowerCase().includes('already')) {
      // Auth user with this email already exists (e.g. duplicate or prior attempt).
      // We can't retrieve their UUID without getUserByEmail, so surface a clear message.
      throw createError({
        statusCode: 409,
        statusMessage:
          'An account with this email already exists. Contact your league admin to resolve it.',
      })
    }
    throw createError({ statusCode: 500, statusMessage: 'Could not create account. Please try again.' })
  }

  const authUserId = created.user.id

  // Link the player record — email + auth_user_id
  const { error: updateErr } = await admin
    .from('players')
    .update({ email, auth_user_id: authUserId, updated_at: new Date().toISOString() })
    .eq('id', player.id)

  if (updateErr) {
    // Roll back the auth user so we don't leave an orphan
    await admin.auth.admin.deleteUser(authUserId)
    throw createError({ statusCode: 500, statusMessage: 'Could not link your account. Please try again.' })
  }

  return { ok: true }
})
