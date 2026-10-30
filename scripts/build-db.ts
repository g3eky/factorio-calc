// Builds one SQLite database per dataset folder (data/<game>/<version>/).
// Run directly to write the databases to dist/db/: node scripts/build-db.ts

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { parse } from 'yaml'

export interface Dataset {
  id: string
  name: string
  version: string
  bytes: Uint8Array
}

export interface OutputFile {
  fileName: string
  source: Uint8Array | string
}

export interface Manifest {
  datasets: { id: string; name: string; version: string; file: string }[]
}

const SCHEMA = `
  CREATE TABLE item (id TEXT PRIMARY KEY, name TEXT NOT NULL);
`

async function readYaml<T>(path: string): Promise<T> {
  return parse(await readFile(path, 'utf8')) as T
}

async function datasetDirs(dataDir: string): Promise<{ id: string; dir: string }[]> {
  const result = []
  for (const game of await readdir(dataDir, { withFileTypes: true })) {
    if (!game.isDirectory()) continue
    for (const version of await readdir(join(dataDir, game.name), { withFileTypes: true })) {
      if (!version.isDirectory()) continue
      result.push({ id: `${game.name}-${version.name}`, dir: join(dataDir, game.name, version.name) })
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id))
}

export async function buildDataset(id: string, dir: string): Promise<Dataset> {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(SCHEMA)
  const game = await readYaml<{ name: string; version: string }>(join(dir, 'game.yml'))
  const items = await readYaml<{ id: string; name: string }[]>(join(dir, 'items.yml'))
  const insert = db.prepare('INSERT INTO item VALUES (?, ?)')
  for (const item of items) insert.run([item.id, item.name])
  insert.free()
  const bytes = db.export()
  db.close()
  return { id, name: game.name, version: game.version, bytes }
}

export async function buildDatabases(dataDir: string): Promise<Dataset[]> {
  const dirs = await datasetDirs(dataDir)
  return Promise.all(dirs.map(({ id, dir }) => buildDataset(id, dir)))
}

function hash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 8)
}

// The databases with content-hashed names, plus a manifest listing them.
export function outputFiles(datasets: Dataset[]): OutputFile[] {
  const files: OutputFile[] = []
  const manifest: Manifest = { datasets: [] }
  for (const dataset of datasets) {
    const fileName = `${dataset.id}.${hash(dataset.bytes)}.sqlite`
    files.push({ fileName, source: dataset.bytes })
    manifest.datasets.push({ id: dataset.id, name: dataset.name, version: dataset.version, file: fileName })
  }
  files.push({ fileName: 'manifest.json', source: JSON.stringify(manifest, null, 2) })
  return files
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const outDir = join(root, 'dist', 'db')
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })
  for (const file of outputFiles(await buildDatabases(join(root, 'data')))) {
    await writeFile(join(outDir, file.fileName), file.source)
    console.log(`dist/db/${file.fileName}`)
  }
}
