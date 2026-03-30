import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // VITE_BASE_URL is set by the GitHub Actions workflow.
  // • Project-page deployment (no custom domain): /IRPG/
  // • Custom-domain deployment:                   /
  base: process.env.VITE_BASE_URL ?? '/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ['pdfjs-dist'],
  },
})
