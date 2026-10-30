import { cp, mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import initSqlJs from 'sql.js'
import { expect, test } from 'vitest'
import { loadGameData } from '../src/db/gameData.ts'
import { buildDatabases, buildDataset, outputFiles, readDataset, type Manifest } from './build-db.ts'

const FIXTURE = fileURLToPath(new URL('fixtures/basic', import.meta.url))

// A copy of the fixture with one file edited, to test validation errors.
async function brokenFixture(file: string, edit: (source: string) => string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'factorio-fixture-'))
  await cp(FIXTURE, dir, { recursive: true })
  await writeFile(join(dir, file), edit(await readFile(join(dir, file), 'utf8')))
  return dir
}

test('the fixture round-trips through SQLite unchanged', async () => {
  const data = await readDataset(FIXTURE)
  const SQL = await initSqlJs()
  const db = new SQL.Database((await buildDataset('fixture', FIXTURE)).bytes)
  expect(loadGameData(db)).toEqual(data)
})

test('the database can be queried with SQL', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database((await buildDataset('fixture', FIXTURE)).bytes)
  const producers = db.exec("SELECT recipe FROM recipe_result WHERE id = 'light-oil' ORDER BY recipe")[0].values.flat()
  expect(producers).toEqual(['advanced-oil-processing', 'heavy-oil-cracking'])
})

test('reports an unknown reference with its file and line', async () => {
  const dir = await brokenFixture('recipes.yml', (s) => s.replace('{ type: item, id: copper-cable, amount: 3 }', '{ type: item, id: copper-wire, amount: 3 }'))
  await expect(readDataset(dir)).rejects.toThrow(/recipes\.yml:34: 3\.ingredients\.1\.id: unknown item "copper-wire"/)
})

test('reports wrong types and unknown fields, all at once', async () => {
  const dir = await brokenFixture('items.yml', (s) => s.replace('stack_size: 100 }', 'stack_size: lots }').replace('order: c\n', 'ordr: c\n'))
  const error = await readDataset(dir).catch((e: Error) => e.message)
  expect(error).toMatch(/items\.yml:10: 4\.stack_size: expected a number above 0/)
  expect(error).toMatch(/items\.yml:3: 2: missing field "order"/)
  expect(error).toMatch(/items\.yml:6: 2\.ordr: unknown field "ordr"/)
})

test('reports YAML syntax errors with the line', async () => {
  const dir = await brokenFixture('belts.yml', (s) => s.replace('speed: 30 }', 'speed: 30'))
  await expect(readDataset(dir)).rejects.toThrow(/belts\.yml:\d+: /)
})

test('reports a recipe no machine can make', async () => {
  const dir = await brokenFixture('recipes.yml', (s) => s.replace('categories: [chemistry]', 'categories: [alchemy]'))
  await expect(readDataset(dir)).rejects.toThrow(/recipes\.yml:\d+: 5\.categories: no machine can craft any of: alchemy/)
})

test('builds every dataset folder and a manifest', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'factorio-data-'))
  await mkdir(join(dataDir, 'test-game'))
  await cp(FIXTURE, join(dataDir, 'test-game', '1.0'), { recursive: true })

  const datasets = await buildDatabases(dataDir)
  expect(datasets.map((d) => d.id)).toEqual(['test-game-1.0'])

  const files = outputFiles(datasets)
  const manifest: Manifest = JSON.parse(files.find((f) => f.fileName === 'manifest.json')!.source as string)
  expect(manifest.datasets[0]).toMatchObject({ id: 'test-game-1.0', name: 'Fixture', version: '0' })
  expect(manifest.datasets[0].file).toMatch(/^test-game-1\.0\.[0-9a-f]{8}\.sqlite\.gz$/)
})
