import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Which build this is. The OTA release script pins BUILD_TIME so the
    // number in the update manifest matches the bundle it describes.
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(Number(process.env.WAYPOINT_BUILD_TIME) || Date.now()),
  },
  build: {
    // The release script builds the over-the-air bundle somewhere other
    // than dist so it doesn't disturb a site build.
    outDir: process.env.WAYPOINT_OUT_DIR || 'dist',
  },
  plugins: [
    react(),
    tailwindcss(),
    // A native bundle is copied into the app and does not need a service
    // worker. Keeping it web-only avoids a second cache layer that can
    // serve stale assets after a native app update.
    mode !== 'capacitor' && VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
      includeAssets: ['favicon-32.png', 'favicon-64.png', 'apple-touch-icon.png', 'logo-mark.png'],
      manifest: {
        name: 'Waypoint — One Dashboard. Every Goal.',
        short_name: 'Waypoint',
        description: 'One Dashboard. Every Goal.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ].filter(Boolean),
}))
