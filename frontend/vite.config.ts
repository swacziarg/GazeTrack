import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/webgazer-mediapipe': {
        target: 'https://webgazer.cs.brown.edu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/webgazer-mediapipe/, '/mediapipe'),
      },
    },
  },
})
