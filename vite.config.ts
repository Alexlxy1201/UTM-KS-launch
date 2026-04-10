import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repoBase =
  process.env.DEPLOY_BASE ||
  (process.env.GITHUB_ACTIONS === 'true' ? '/UTM-KS-launch/' : '/')

// https://vite.dev/config/
export default defineConfig({
  base: repoBase,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})
