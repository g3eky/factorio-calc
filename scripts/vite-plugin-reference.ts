// Dev server only: serves the reference screenshots in screenshots/ (git-ignored, never built)
// for the gallery's compare view, by number in name order: /__reference/1.png, 2.png, …

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Plugin } from 'vite'

export function referencePlugin({ dir }: { dir: string }): Plugin {
  return {
    name: 'factorio-reference',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = /\/__reference\/(\d+)\.png$/.exec(req.url ?? '')
        if (!match) return next()
        const files = (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.png')).sort()
        const file = files[Number(match[1]) - 1]
        if (!file) {
          res.statusCode = 404
          return res.end()
        }
        res.setHeader('Content-Type', 'image/png')
        res.end(await readFile(join(dir, file)))
      })
    },
  }
}
