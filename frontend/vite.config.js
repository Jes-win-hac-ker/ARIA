import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy avoids CORS during local development; in deployed environments
// set VITE_API_BASE_URL and rely on backend CORS_ALLOWED_ORIGINS.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || process.env.VITE_API_BASE_URL || 'http://localhost:8000',
        changeOrigin: false,
      },
    },
  },
})
