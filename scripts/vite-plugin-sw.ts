// Emits sw.js from src/sw/sw.js, with the list of files to cache at install. The list changes
// with every build that changes a file, which is how browsers notice a new version.

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { Plugin } from 'vite'

export function swPlugin({ source, publicFiles }: { source: string; publicFiles: string[] }): Plugin {
  return {
    name: 'factorio-sw',
    apply: 'build',
    async generateBundle(_options, bundle) {
      // The app shell: everything built except the per-dataset files, which are cached as they're used.
      const files = ['index.html', ...publicFiles, ...Object.keys(bundle).filter((f) => !f.startsWith('db/') && f !== 'index.html')].sort()
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 8)
      const code = (await readFile(source, 'utf8'))
        .replace('self.__PRECACHE__', JSON.stringify(files))
        .replace('self.__VERSION__', JSON.stringify(version))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code })
    },
  }
}
