import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    proxy: { '/api': 'http://127.0.0.1:8787' }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // generateSW registers a catch-all NavigationRoute to index.html
        // by default. Without this, a direct navigation to an /api/*
        // path (e.g. typing it in the address bar) gets served the
        // cached app shell instead of reaching the Vercel function.
        navigateFallbackDenylist: [/^\/api\//]
      },
      manifest: {
        name: 'Tender — private pain journal',
        short_name: 'Tender',
        description: 'A private way to notice pain patterns.',
        theme_color: '#5A314D',
        background_color: '#FFF9F4',
        display: 'standalone'
      }
    })
  ]
});
