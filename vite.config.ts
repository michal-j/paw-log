/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tokens from './docs/design-system/tokens.json' with { type: 'json' };

const colour = (name: string) => tokens.color.tokens.find((t) => t.name === name)?.value;

// Bump when the icon files change: a new URL makes iOS and Android fetch the icons again
// instead of reusing a cached copy (the precache below ignores `v` when matching). Keep the
// `?v=` on the apple-touch-icon and icon links in index.html in step.
const ICON_VERSION = '2';

export default defineConfig({
  plugins: [
    react(),
    {
      // Dev only: once /harness.html has set its session cookie, every page is the harness, so a
      // reload on /day/… stays on the fake backend instead of the unconfigured real app.
      name: 'pawlog-harness-reload',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const page = req.headers.accept?.includes('text/html') && !req.url?.startsWith('/harness.html');
          if (page && /(?:^|;\s*)pawlog_harness=1/.test(req.headers.cookie ?? '')) req.url = '/harness.html';
          next();
        });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PawLog',
        short_name: 'PawLog',
        description: 'A health timeline for a dog: meals, medication, symptoms and vet events.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: colour('ground'),
        theme_color: colour('mint'),
        icons: [
          { src: `icon-192.png?v=${ICON_VERSION}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `icon-512.png?v=${ICON_VERSION}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: `icon-512-maskable.png?v=${ICON_VERSION}`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html', // app shell also serves /demo
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/], // icon URLs carry ?v=ICON_VERSION
      },
    }),
  ],
  // PGlite (WASM Postgres) backs the dev-only harness (harness.html, tests/harness); it must not be pre-bundled.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  // Tests on PGlite build a fresh database per test (about 1 s alone); with several such files running
  // in parallel the first test of a file can pass 5 s, so the timeout is longer than vitest's default.
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'], testTimeout: 20000 },
});
