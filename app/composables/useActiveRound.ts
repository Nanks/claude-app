// composables/useActiveRound.ts
// Tracks whether the current authenticated player has an active round.
// Database types imported explicitly per @nuxtjs/supabase docs.

import type { Database } from '~/types/database.types'

export function useActiveRound() {
  const supabase = useSupabaseClient<Database>()
  const user     = useSupabaseUser()

  const activeEventId = useState<string | null>('activeEventId', () => null)

  async function checkActiveRound() {
    // Guard: user must exist AND have a valid id
    if (!user.value?.id) {
      activeEventId.value = null
      return
    }

    // Step 1: Get the player row for the current auth user
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('id')
      .eq('auth_user_id', user.value.id)
      .single()

    if (playerError || !player) {
      activeEventId.value = null
      return
    }

    // Step 2: Find scheduled or live events (trigger may not have fired yet)
    const { data: liveEvents, error: eventsError } = await supabase
      .from('events')
      .select('id')
      .in('status', ['scheduled', 'live'])

    if (eventsError || !liveEvents || liveEvents.length === 0) {
      activeEventId.value = null
      return
    }

    const liveEventIds = liveEvents.map(e => e.id)

    // Step 3: Check if player has a score row for any live event
    const { data: score, error: scoreError } = await supabase
      .from('scores')
      .select('event_id')
      .eq('player_id', player.id)
      .in('event_id', liveEventIds)
      .maybeSingle()

    if (scoreError) {
      activeEventId.value = null
      return
    }

    activeEventId.value = score?.event_id ?? null
  }

  const hasActiveRound = computed(() => activeEventId.value !== null)

  // Watch the user ID specifically — avoids firing when user object
  // exists but id is still undefined during session hydration
  watch(
    () => user.value?.id,
    (id) => {
      if (id) {
        checkActiveRound()
      } else {
        activeEventId.value = null
      }
    },
    { immediate: true },
  )

  return {
    hasActiveRound,
    activeEventId,
    checkActiveRound,
  }
}