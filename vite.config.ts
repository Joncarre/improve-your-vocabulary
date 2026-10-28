import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { apiDevPlugin } from './scripts/vite-api-plugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    apiDevPlugin(),
    VitePWA({
      // The app shows its own "Nueva versión · Actualizar" prompt (src/app/ReloadPrompt.tsx).
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Improve Your Vocabulary',
        short_name: 'Vocab',
        description: 'Aprende y repasa vocabulario en inglés británico.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A0A0C',
        theme_color: '#0A0A0C',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell, including the lazy route chunks, so it opens offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // Only the Latin subset of the serif font is needed offline.
        globIgnores: ['**/fraunces-latin-ext-*', '**/fraunces-vietnamese-*'],
        navigateFallback: '/index.html',
        // API calls must never be answered with the app shell.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // UK recordings of the free dictionary: once heard, a word also plays offline.
            urlPattern: /^https:\/\/api\.dictionaryapi\.dev\/media\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'dictionary-audio',
              expiration: { maxEntries: 500 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
})
