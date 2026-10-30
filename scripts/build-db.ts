// Builds one SQLite database per dataset folder (data/<game>/<version>/).
// Run directly to write the databases to dist/db/: node scripts/build-db.ts

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs, { type Database, type SqlValue } from 'sql.js'
import { LineCounter, parseDocument, type Document } from 'yaml'
import { DATA_FILES, type GameData } from '../src/db/types.ts'
import { checkReferences, SCHEMAS, type Path } from './validate.ts'

export interface Dataset {
  id: string
  name: string
  version: string
  bytes: Uint8Array
  // The icon atlas image (icons.webp), if the dataset has one.
  icons?: Uint8Array
}

// icons.json, written by the importer next to icons.webp.
export interface IconIndex {
  size: number
  width: number
  height: number
  icons: Record<string, [number, number]>
}

export interface OutputFile {
  fileName: string
  source: Uint8Array | string
}

export interface Manifest {
  datasets: { id: string; name: string; version: string; file: string; icons?: string }[]
}

const SCHEMA = readFileSync(new URL('schema.sql', import.meta.url), 'utf8')

// Reads and validates every YAML file of a dataset. Throws one error listing every problem.
export async function readDataset(dir: string): Promise<GameData> {
  const errors: string[] = []
  const docs = new Map<keyof GameData, { file: string; doc: Document; lines: LineCounter }>()
  const data: Record<string, unknown> = {}

  const files: [keyof GameData, string][] = [['game', 'game.yml'], ...(Object.entries(DATA_FILES) as [keyof GameData, string][])]
  for (const [key, file] of files) {
    const path = join(dir, file)
    const source = await readFile(path, 'utf8').catch(() => undefined)
    if (source === undefined) {
      if (key === 'game') errors.push(`${path}: missing file`)
      data[key] = []
      continue
    }
    const lines = new LineCounter()
    const doc = parseDocument(source, { lineCounter: lines })
    for (const error of doc.errors) errors.push(`${path}:${error.linePos?.[0].line ?? 1}: ${error.message.split('\n')[0]}`)
    docs.set(key, { file: path, doc, lines })
    data[key] = doc.toJS() ?? []
  }
  if (errors.length) throw new Error(`Invalid data in ${dir}:\n${errors.join('\n')}`)

  const report = (key: keyof GameData, path: Path, message: string) => {
    const { file, doc, lines } = docs.get(key)!
    let line = 1
    for (let depth = path.length; depth >= 0; depth--) {
      const node = doc.getIn(path.slice(0, depth), true) as { range?: [number] } | undefined
      if (node?.range) {
        line = lines.linePos(node.range[0]).line
        break
      }
    }
    errors.push(`${file}:${line}: ${path.join('.') || '(top)'}: ${message}`)
  }
  for (const [key, check] of Object.entries(SCHEMAS) as [keyof GameData, (typeof SCHEMAS)[keyof GameData]][]) {
    if (docs.has(key)) check(data[key], [], (path, message) => report(key, path, message))
  }
  if (!errors.length) checkReferences(data as unknown as GameData, report)
  if (errors.length) throw new Error(`Invalid data in ${dir}:\n${errors.join('\n')}`)
  return data as unknown as GameData
}

const json = (value: unknown) => (value === undefined ? null : JSON.stringify(value))
const nullable = <T>(value: T | undefined) => (value === undefined ? null : value)

function insert(db: Database, table: string, row: Record<string, SqlValue>): void {
  const columns = Object.keys(row)
  db.run(
    `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(row),
  )
}

export function writeDatabase(db: Database, data: GameData): void {
  db.run(SCHEMA)
  const { game } = data
  insert(db, 'game', { name: game.name, version: game.version, mods: json(game.mods), source: game.source })
  for (const g of data.groups) {
    insert(db, 'item_group', { id: g.id, name: g.name, order: g.order })
    for (const s of g.subgroups) insert(db, 'item_subgroup', { id: s.id, group_id: g.id, order: s.order })
  }
  for (const i of data.items) {
    insert(db, 'item', {
      id: i.id,
      name: i.name,
      subgroup: i.subgroup,
      order: i.order,
      stack_size: i.stack_size,
      fuel_category: nullable(i.fuel?.category),
      fuel_value: nullable(i.fuel?.value),
      burnt_result: nullable(i.fuel?.burnt_result),
      spoil_time: nullable(i.spoil?.time),
      spoil_result: nullable(i.spoil?.result),
    })
  }
  for (const f of data.fluids) {
    insert(db, 'fluid', {
      id: f.id,
      name: f.name,
      subgroup: f.subgroup,
      order: f.order,
      default_temperature: f.default_temperature,
      fuel_value: nullable(f.fuel_value),
    })
  }
  for (const r of data.recipes) {
    insert(db, 'recipe', {
      id: r.id,
      name: r.name,
      time: r.time,
      main_product: nullable(r.main_product),
      subgroup: nullable(r.subgroup),
      order: r.order,
      hidden: r.hidden ? 1 : 0,
      allowed_effects: json(r.allowed_effects),
      max_productivity: r.max_productivity,
      surface_conditions: json(r.surface_conditions),
    })
    for (const category of r.categories) insert(db, 'recipe_category', { recipe: r.id, category })
    r.ingredients.forEach((x, position) => insert(db, 'recipe_ingredient', { recipe: r.id, position, type: x.type, id: x.id, amount: x.amount }))
    r.results.forEach((x, position) =>
      insert(db, 'recipe_result', {
        recipe: r.id,
        position,
        type: x.type,
        id: x.id,
        amount: nullable(x.amount),
        amount_min: nullable(x.amount_min),
        amount_max: nullable(x.amount_max),
        probability: nullable(x.probability),
        extra_fraction: nullable(x.extra_fraction),
        ignored_by_productivity: nullable(x.ignored_by_productivity),
      }),
    )
  }
  for (const m of data.machines) {
    insert(db, 'machine', {
      id: m.id,
      name: m.name,
      kind: m.kind,
      speed: m.speed,
      energy: json(m.energy),
      module_slots: m.module_slots,
      allowed_effects: json(m.allowed_effects),
      base_effect: json(m.base_effect),
      surface_conditions: json(m.surface_conditions),
      boiler: json(m.boiler),
    })
    for (const category of m.categories) insert(db, 'machine_category', { machine: m.id, category })
  }
  for (const r of data.resources) {
    insert(db, 'resource', {
      id: r.id,
      name: r.name,
      category: r.category,
      mining_time: r.mining_time,
      results: json(r.results),
      required_fluid: json(r.required_fluid),
      infinite: r.infinite ? 1 : 0,
    })
  }
  for (const m of data.modules) insert(db, 'module', { id: m.id, name: m.name, category: m.category, tier: m.tier, effects: json(m.effects) })
  for (const b of data.beacons) {
    insert(db, 'beacon', {
      id: b.id,
      name: b.name,
      distribution_effectivity: b.distribution_effectivity,
      distribution_effectivity_per_quality: b.distribution_effectivity_per_quality,
      profile: json(b.profile),
      module_slots: b.module_slots,
      power: b.power,
      allowed_effects: json(b.allowed_effects),
    })
  }
  for (const b of data.belts) insert(db, 'belt', { id: b.id, name: b.name, speed: b.speed })
  for (const p of data.planets) {
    insert(db, 'planet', { id: p.id, name: p.name, kind: p.kind, surface_properties: json(p.surface_properties), resources: json(p.resources) })
  }
  for (const s of data.surface_properties) insert(db, 'surface_property', { id: s.id, name: s.name, default_value: s.default_value })
  for (const q of data.qualities) {
    insert(db, 'quality', { id: q.id, name: q.name, level: q.level, next: nullable(q.next), next_probability: nullable(q.next_probability) })
  }
  for (const r of data.research) {
    insert(db, 'research', { id: r.id, name: r.name, kind: r.kind, recipes: json(r.recipes), change: r.change, max_level: nullable(r.max_level) })
  }
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

// Reads icons.json and checks every key names something in the dataset.
async function readIcons(dir: string, data: GameData): Promise<IconIndex | undefined> {
  const path = join(dir, 'icons.json')
  const source = await readFile(path, 'utf8').catch(() => undefined)
  if (source === undefined) return undefined
  const index: IconIndex = JSON.parse(source)
  const known = new Set(
    (['items', 'fluids', 'recipes', 'machines', 'planets'] as const).flatMap((key) =>
      data[key].map((x) => `${key.slice(0, -1)}/${x.id}`),
    ),
  )
  const unknown = Object.keys(index.icons).filter((key) => !known.has(key))
  if (unknown.length) throw new Error(`${path}: icons for unknown things: ${unknown.join(', ')}`)
  return index
}

export async function buildDataset(id: string, dir: string): Promise<Dataset> {
  const data = await readDataset(dir)
  const icons = await readIcons(dir, data)
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('BEGIN')
  writeDatabase(db, data)
  if (icons) {
    insert(db, 'icon_atlas', { size: icons.size, width: icons.width, height: icons.height })
    for (const [key, [x, y]] of Object.entries(icons.icons)) insert(db, 'icon', { key, x, y })
  }
  db.run('COMMIT')
  const bytes = db.export()
  db.close()
  const dataset: Dataset = { id, name: data.game.name, version: data.game.version, bytes }
  if (icons) dataset.icons = await readFile(join(dir, 'icons.webp'))
  return dataset
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
    const entry: Manifest['datasets'][number] = { id: dataset.id, name: dataset.name, version: dataset.version, file: fileName }
    if (dataset.icons) {
      entry.icons = `${dataset.id}.${hash(dataset.icons)}.webp`
      files.push({ fileName: entry.icons, source: dataset.icons })
    }
    manifest.datasets.push(entry)
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
