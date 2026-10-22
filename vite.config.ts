import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const API_TARGET = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000'
// GitHub Codespaces forwards ports through https://<name>-5173.app.github.dev on port 443.
const inCodespaces = Boolean(process.env.CODESPACES)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  build: {
    rolldownOptions: {
      output: {
        // Vendor chunks change rarely, so browsers keep them cached across app releases.
        codeSplitting: {
          groups: [
            {
              name: 'react',
              // Not react-dom/server: see the next group.
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/](?!server|cjs[\\/]react-dom-server)/,
            },
            // Only the readable data export (features/me/exportHtml.ts) renders React to a
            // string: react-dom/server gets its own chunk, loaded on demand.
            {
              name: 'react-dom-server',
              test: /node_modules[\\/]react-dom[\\/](server|cjs[\\/]react-dom-server)/,
            },
            { name: 'auth0', test: /node_modules[\\/]@auth0[\\/]/ },
            { name: 'ui', test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react)[\\/]/ },
            { name: 'vendor', test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Same-origin calls to /api/* are forwarded to FastAPI, so the browser never does CORS.
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
    allowedHosts: ['.app.github.dev'],
    hmr: inCodespaces ? { clientPort: 443 } : undefined,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
})
