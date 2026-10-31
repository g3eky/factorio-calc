import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { dbPlugin } from './vite-plugin-db.ts'
import { referencePlugin } from './vite-plugin-reference.ts'
import { swPlugin } from './vite-plugin-sw.ts'

// Paths are resolved from this file, so commands work from any directory.
const fromRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url))

export default defineConfig({
  root: fromRoot('src'),
  base: '/factorio-calc/',
  // Copied as-is: favicon and the link preview image.
  publicDir: fromRoot('src/public'),
  build: { outDir: fromRoot('dist'), emptyOutDir: true },
  plugins: [
    react(),
    dbPlugin({ dataDir: fromRoot('data') }),
    referencePlugin({ dir: fromRoot('screenshots') }),
    swPlugin({ source: fromRoot('src/sw/sw.js'), publicFiles: ['favicon.svg'] }),
  ],
  test: {
    root: fromRoot('.'),
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})
