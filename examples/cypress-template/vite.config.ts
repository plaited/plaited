import { defineConfig } from 'vite'
// https://vitejs.dev/config/
export default defineConfig({
  esbuild: {
    jsxImportSource: 'plaited',
    jsx: 'automatic',
  },
})
