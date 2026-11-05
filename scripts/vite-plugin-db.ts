// Serves the game databases from memory in dev and emits them into dist/db/ on build.

import type { Plugin } from 'vite'
import { buildDatabases, outputFiles, type Manifest, type OutputFile } from './build-db.ts'

const CONTENT_TYPES: Record<string, string> = { json: 'application/json', gz: 'application/gzip', webp: 'image/webp' }

export function dbPlugin({ dataDir }: { dataDir: string }): Plugin {
  return {
    name: 'factorio-db',

    configureServer(server) {
      let files: Promise<OutputFile[]> | undefined
      server.watcher.add(dataDir)
      server.watcher.on('all', (_event, path) => {
        if (path.startsWith(dataDir)) files = undefined
      })

      server.middlewares.use(async (req, res, next) => {
        const prefix = `${server.config.base}db/`
        if (!req.url?.startsWith(prefix)) return next()
        const name = req.url.slice(prefix.length).split('?')[0]
        try {
          files ??= buildDatabases(dataDir).then(outputFiles)
          const file = (await files).find((f) => f.fileName === name)
          if (!file) return next()
          res.setHeader('Content-Type', CONTENT_TYPES[name.split('.').pop()!] ?? 'application/octet-stream')
          res.setHeader('Cache-Control', 'no-cache')
          res.end(file.source)
        } catch (error) {
          files = undefined
          server.config.logger.error(String(error))
          res.statusCode = 500
          res.end(String(error))
        }
      })
    },

    async generateBundle() {
      for (const file of outputFiles(await buildDatabases(dataDir))) {
        this.emitFile({ type: 'asset', fileName: `db/${file.fileName}`, source: file.source })
      }
    },

    // Start downloading the default database and SQLite itself while the app's JavaScript loads.
    transformIndexHtml: {
      order: 'post',
      async handler(_html, ctx) {
        if (!ctx.bundle) return
        const base = ctx.server?.config.base ?? '/'
        const manifest = JSON.parse(String((ctx.bundle['db/manifest.json'] as { source: string }).source)) as Manifest
        const newest = manifest.datasets
          .filter((d) => d.id.startsWith('space-age-'))
          .sort((a, b) => b.version.localeCompare(a.version, 'en', { numeric: true }))[0]
        const sqlWasm = Object.keys(ctx.bundle).find((f) => /sql-wasm.*\.wasm$/.test(f))
        const preload = (href: string) => ({ tag: 'link', attrs: { rel: 'preload', href, as: 'fetch', crossorigin: 'anonymous' }, injectTo: 'head' as const })
        return [
          preload(`${base}db/manifest.json`),
          ...(newest ? [preload(`${base}db/${newest.file}`)] : []),
          ...(sqlWasm ? [preload(`${base}${sqlWasm}`)] : []),
        ]
      },
    },
  }
}
