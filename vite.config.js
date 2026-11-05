import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // API_PORT lets the dev proxy follow the backend if 5001 is taken.
        target: `http://localhost:${process.env.API_PORT || 5001}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
