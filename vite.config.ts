import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  server: {
    proxy: { '/api': 'http://127.0.0.1:8787' }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
