import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Base path pour GitHub Pages : https://phalekpro.github.io/gamcompetadmin/
  base: '/gamcompetadmin/',
  plugins: [react()],
  server: {
    port: 3001,
    open: true,
    proxy: {
      // Proxy all /api requests to the backend Express server
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
