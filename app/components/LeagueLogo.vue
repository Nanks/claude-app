<script setup lang="ts">
// LeagueLogo.vue
// Maps a league's firebase_id or short_name to its custom SVG logo component.
// Falls back to a gradient badge with short_name text for leagues
// without a custom logo (e.g. Aftermath, theBFG).
//
// Nuxt 4 note: resolveComponent() requires literal strings — cannot
// be used with dynamic variables. Use an explicit component map instead.

import TheSmssLogo  from '~/components/TheSmssLogo.vue'
import TheSscLogo   from '~/components/TheSscLogo.vue'
import TheT4gLogo   from '~/components/TheT4gLogo.vue'
import TheVegasLogo from '~/components/TheVegasLogo.vue'

interface Props {
  shortName:        string
  themeStartColor:  string
  themeEndColor:    string
  size?:            'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

// Explicit map of short_name → logo component
// Add new entries here as leagues get custom logos
const logoMap: Record<string, Component> = {
  'SM$S':     TheSmssLogo,
  'The SSC':  TheSscLogo,
  'T4G':      TheT4gLogo,
  'Vegas':    TheVegasLogo,
}

const logoComponent = computed(() => logoMap[props.shortName] ?? null)

const sizeClasses: Record<string, string> = {
  sm: 'size-10',
  md: 'size-14',
  lg: 'size-20',
}

const fallbackTextSize: Record<string, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}

// Truncate short_name to 4 chars for fallback badge
const displayName = computed(() =>
  props.shortName.length > 4
    ? props.shortName.slice(0, 4)
    : props.shortName
)

const gradientStyle = computed(() => ({
  background: `linear-gradient(135deg, ${props.themeStartColor}, ${props.themeEndColor})`,
}))
</script>

<template>
  <div
    class="rounded-xl shrink-0 overflow-hidden"
    :class="sizeClasses[size]"
    :aria-label="`${shortName} league logo`"
  >
    <!-- Custom SVG logo — passes theme colors as props -->
    <component
      :is="logoComponent"
      v-if="logoComponent"
      :start-color="themeStartColor"
      :end-color="themeEndColor"
      class="w-full h-full"
    />

    <!-- Fallback gradient badge -->
    <div
      v-else
      class="w-full h-full flex items-center justify-center
             font-bold text-white select-none"
      :class="fallbackTextSize[size]"
      :style="gradientStyle"
    >
      {{ displayName }}
    </div>
  </div>
</template>