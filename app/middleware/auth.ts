// Protects all routes not in the exclusion list.
// The @nuxtjs/supabase module can handle this automatically via nuxt.config,
// but a manual middleware gives more control.

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  // Allow public routes
  const publicRoutes = ['/login', '/confirm']
  if (publicRoutes.includes(to.path)) return

  // Redirect unauthenticated users to login
  if (!user.value) {
    return navigateTo('/login')
  }
})