// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-07-01',

  future: {
    compatibilityVersion: 4,
  },

  modules: ['@nuxt/ui', '@nuxtjs/supabase', '@vite-pwa/nuxt','@vercel/speed-insights'],

  app: {
    head: {
      meta: [
        // viewport-fit=cover enables env(safe-area-inset-*) for iOS notch/home indicator
        { key: 'viewport', name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        // theme-color: browser chrome tint + PWA splash screen background
        { key: 'theme-color', name: 'theme-color', content: '#84cc16' },
        // iOS PWA chrome
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Golf League' },
        { name: 'msapplication-TileColor', content: '#84cc16' },
      ],
      link: [
        // Explicit manifest link — @vite-pwa/nuxt doesn't reliably inject this in Nuxt 4
        { key: 'manifest', rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      ],
    },
  },

  runtimeConfig: {
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? '',
    vapidEmail:      process.env.VAPID_EMAIL       ?? '',
    public: {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
    },
  },

  pwa: {
    registerType: 'autoUpdate',

    // generateSW lets Vite-PWA build the service worker automatically —
    // no custom TS file to compile, no srcDir resolution issues.
    // Push/notification-click handlers live in public/push-handler.js and
    // are pulled in via importScripts so they run inside the SW scope.
    strategies: 'generateSW',

    workbox: {
      globPatterns: ['**/*.{js,css,ico,png,svg,webmanifest,html}'],
      navigateFallback: '/offline.html',
      navigateFallbackDenylist: [/^\/api\//],
      importScripts: ['/push-handler.js'],
      runtimeCaching: [
        {
          urlPattern: /^\/api\//,
          handler: 'NetworkOnly' as const,
        },
      ],
    },

    manifest: {
      name: 'Golf League',
      short_name: 'Golf League',
      description: 'Golf league scoring and live leaderboards',
      theme_color: '#84cc16',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        { src: '/favicon-32x32.png',          sizes: '32x32',   type: 'image/png' },
        { src: '/android-chrome-192x192.png',  sizes: '192x192', type: 'image/png' },
        { src: '/android-chrome-512x512.png',  sizes: '512x512', type: 'image/png' },
        { src: '/android-chrome-512x512.png',  sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },

    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600,
    },

    devOptions: {
      enabled: false,
      suppressWarnings: true,
      type: 'module',
    },
  },

  css: ['~/assets/css/main.css'],

  supabase: {
    redirect: true,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      // List pages that don't require auth
      exclude: ['/login', '/confirm'],
    },
    cookieOptions: {
      maxAge: 60 * 60 * 8, // 8-hour session
      sameSite: 'lax',
      secure: true,
    },
    // Enable SSR cookies so server routes can read session
    clientOptions: {
      auth: {
        // implicit avoids PKCE code-verifier cookie being lost when the mail
        // app opens the magic link in a different browser context than the one
        // that requested it (common on iOS — PWA vs Safari vs in-app browser)
        flowType: 'implicit',
      },
    },
    types: '~~/shared/types/database.types.ts',
  },

  ui: {
    theme: {
      defaultVariants: {
        color: 'primary',
        size: 'md',
      },
    },
  },

  fonts: {
    providers: {
      google: false,
      googleicons: false,
    },
  },
})