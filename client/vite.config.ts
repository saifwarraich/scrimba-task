import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    // In local dev the client (5173) and API (3000) are separate origins.
    // Proxy /api to the backend so the client can always use same-origin
    // relative paths — which is also how it runs in production (Fastify
    // serves this build, so client + API share one origin).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        player: 'player.html',
      },
    },
  },
})
