import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-maskable.svg', 'offline.html'],
      manifest: {
        name: 'WAN AI Video Studio',
        short_name: 'WAN Studio',
        description:
          'Estudio de creación audiovisual con inteligencia artificial: convierte descripciones de texto en vídeos.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0a0a0f',
        theme_color: '#0a0a0f',
        categories: ['multimedia', 'productivity'],
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precaché de recursos estáticos de la aplicación.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Página de reserva cuando no hay conexión (español).
        navigateFallback: '/offline.html',
        // Las rutas de la API nunca usan la página de reserva.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // No cachear nunca las respuestas privadas de la API.
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
