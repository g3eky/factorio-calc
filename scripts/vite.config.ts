import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { dbPlugin } from './vite-plugin-db.ts'

// Paths are resolved from this file, so commands work from any directory.
const fromRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url))

export default defineConfig({
  root: fromRoot('src'),
  base: '/factorio-calc/',
  publicDir: false,
  build: { outDir: fromRoot('dist'), emptyOutDir: true },
  plugins: [react(), dbPlugin({ dataDir: fromRoot('data') })],
  test: {
    root: fromRoot('.'),
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})
