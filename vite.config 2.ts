/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tokens from './docs/design-system/tokens.json' with { type: 'json' };

const colour = (name: string) => tokens.color.tokens.find((t) => t.name === name)?.value;

export default defineConfig({
  plugins: [
    react(),
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
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html', // app shell also serves /demo
      },
    }),
  ],
  test: { environment: 'jsdom', include: ['tests/**/*.test.{ts,tsx}'] },
});
