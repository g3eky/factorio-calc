import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import initSqlJs from 'sql.js'
import { expect, test } from 'vitest'
import { buildDatabases, outputFiles, type Manifest } from './build-db.ts'

test('builds a queryable database and manifest from YAML', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'factorio-data-'))
  const dir = join(dataDir, 'test-game', '1.0')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'game.yml'), 'name: Test\nversion: "1.0"\n')
  await writeFile(join(dir, 'items.yml'), '- id: a\n  name: A\n- id: b\n  name: B\n')

  const datasets = await buildDatabases(dataDir)
  expect(datasets.map((d) => d.id)).toEqual(['test-game-1.0'])

  const SQL = await initSqlJs()
  const db = new SQL.Database(datasets[0].bytes)
  expect(db.exec('SELECT id FROM item ORDER BY id')[0].values).toEqual([['a'], ['b']])

  const files = outputFiles(datasets)
  const manifest: Manifest = JSON.parse(files.find((f) => f.fileName === 'manifest.json')!.source as string)
  expect(manifest.datasets[0].file).toMatch(/^test-game-1\.0\.[0-9a-f]{8}\.sqlite$/)
})
