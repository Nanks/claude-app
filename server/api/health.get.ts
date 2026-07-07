// server/api/health.get.ts
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)

  const supabasePublic = config.public.supabase as {
    url?: string
    key?: string
  }

  // The module stores private keys under config.supabase (not config.public.supabase)
  const supabasePrivate = config.supabase as {
    secretKey?: string
  }

  return {
    supabaseUrl:    !!supabasePublic?.url,
    supabaseKey:    !!supabasePublic?.key,
    supabaseSecret: !!supabasePrivate?.secretKey,
  }
})