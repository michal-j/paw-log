/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tokens from './docs/design-system/tokens.json' with { type: 'json' };

const colour = (name: string) => tokens.color.tokens.find((t) => t.name === name)?.value;

// Bump when the icon files change: a new URL makes iOS and Android fetch the icons again
// instead of reusing a cached copy. Keep the `?v=` on the apple-touch-icon and icon links in
// index.html in step.
const ICON_VERSION = '2';

export default defineConfig({
  plugins: [
    react(),
    {
      // index.html (launch cover, theme colour) cannot import the stylesheet's variables before JS runs,
      // so `%token:name%` there is replaced with the value from tokens.json (JCB-82).
      name: 'pawlog-html-tokens',
      transformIndexHtml: (html) =>
        html.replace(/%token:([a-z-]+)%/g, (_m, name: string) => {
          const value = colour(name);
          if (!value) throw new Error(`index.html: unknown colour token "${name}"`);
          return value;
        }),
    },
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
    // Manifest only (Add to Home Screen). No service worker (JCB-71): a page it controls hands it every
    // request, Supabase calls included, and in the installed iPhone app that stalled writes until a
    // restart. `selfDestroying` ships an sw.js that unregisters itself and clears its caches, for
    // phones that installed the old one; src/serviceWorker.ts unregisters it from the page too.
    VitePWA({
      selfDestroying: true,
      injectRegister: false,
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PawLog',
        short_name: 'PawLog',
        description: 'A health timeline for a dog: meals, medication, symptoms and vet events.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: colour('mint'),
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
    }),
  ],
  // PGlite (WASM Postgres) backs the dev-only harness (harness.html, tests/harness); it must not be pre-bundled.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  // Tests on PGlite build a fresh database per test (about 1 s alone). With many such files running at once
  // (CI runners, laptops) the first test of a file can pass 5 s or time out in findBy*, so: a longer test
  // timeout, a longer Testing Library async timeout (tests/setup.ts), and at most 3 files in parallel.
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    maxWorkers: 3,
  },
});
