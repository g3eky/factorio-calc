// Imports a dataset: game data from Wube's wube/factorio-data repo (run through dump.lua with
// LuaJIT), English names and icons from the Factorio wiki. Writes data/<game>/<version>/.
// Usage: node scripts/import/import.ts [version]

import { execFileSync } from 'node:child_process'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { DATA_FILES, type GameData } from '../../src/db/types.ts'
import { readDataset } from '../build-db.ts'
import { packAtlas } from './atlas.ts'
import { convert, nameFromId, type Raw } from './convert.ts'
import { themeCss } from './theme.ts'
import { Wiki } from './wiki.ts'

const DEFAULT_VERSION = '2.1.24'
const ICON_SIZE = 64
const DATASETS = [
  { game: 'space-age', name: 'Space Age', mods: ['base', 'elevated-rails', 'recycler', 'quality', 'space-age'] },
  { game: 'base', name: 'Base game', mods: ['base'] },
]

const root = fileURLToPath(new URL('../..', import.meta.url))
const cache = join(root, 'node_modules', '.cache', 'factorio-calc')
const exists = (path: string) => stat(path).then(() => true, () => false)

async function factorioData(version: string): Promise<string> {
  const dir = join(cache, `factorio-data-${version}`)
  if (await exists(join(dir, 'base', 'info.json'))) return dir
  console.log(`Downloading wube/factorio-data ${version}`)
  const response = await fetch(`https://codeload.github.com/wube/factorio-data/tar.gz/refs/tags/${version}`)
  if (!response.ok) throw new Error(`No factorio-data release ${version} (${response.status})`)
  await mkdir(cache, { recursive: true })
  const archive = join(cache, `factorio-data-${version}.tar.gz`)
  await writeFile(archive, Buffer.from(await response.arrayBuffer()))
  execFileSync('tar', ['xzf', archive, '-C', cache])
  await rm(archive)
  return dir
}

// Wiki file names for each icon key; recipes only when the game gives them their own icon.
function iconFiles(data: GameData, raw: Raw): Map<string, string> {
  const files = new Map<string, string>()
  for (const item of data.items) files.set(`item/${item.id}`, item.name)
  for (const fluid of data.fluids) files.set(`fluid/${fluid.id}`, fluid.name)
  for (const recipe of data.recipes) {
    const own = raw.recipe[recipe.id]
    if ((own.icon || own.icons) && !recipe.categories.includes('recycling')) files.set(`recipe/${recipe.id}`, recipe.name)
  }
  for (const machine of data.machines) files.set(`machine/${machine.id}`, machine.name)
  for (const planet of data.planets) files.set(`planet/${planet.id}`, planet.name)
  return files
}

async function importDataset(version: string, dataset: (typeof DATASETS)[number], wiki: Wiki): Promise<void> {
  const source = await factorioData(version)
  const rawPath = join(cache, `${dataset.game}-${version}.json`)
  console.log(`Running the data stage for ${dataset.mods.join(', ')}`)
  execFileSync('luajit', [join(root, 'scripts', 'import', 'dump.lua'), source, rawPath, ...dataset.mods], { stdio: 'inherit' })
  const raw: Raw = JSON.parse(await readFile(rawPath, 'utf8'))

  console.log('Fetching names from the wiki')
  const names = await wiki.names()
  const game = { name: dataset.name, version, mods: dataset.mods, source: `wube/factorio-data ${version}; names and icons from wiki.factorio.com` }
  const data = convert(raw, game, names)

  const outDir = join(root, 'data', dataset.game, version)
  await rm(outDir, { recursive: true, force: true })
  await mkdir(outDir, { recursive: true })
  const yaml = (value: unknown) => stringify(value, { lineWidth: 0 })
  await writeFile(join(outDir, 'game.yml'), yaml(data.game))
  for (const [key, file] of Object.entries(DATA_FILES)) await writeFile(join(outDir, file), yaml(data[key as keyof typeof DATA_FILES]))

  console.log('Fetching icons from the wiki')
  const files = iconFiles(data, raw)
  const icons = await wiki.icons(files)
  const atlas = await packAtlas(icons, ICON_SIZE)
  await writeFile(join(outDir, 'icons.webp'), atlas.image)
  await writeFile(join(outDir, 'icons.json'), JSON.stringify(atlas.index, null, 1) + '\n')

  const missing = [...files.keys()].filter((k) => !icons.has(k))
  const unnamed = [...data.items, ...data.fluids, ...data.recipes].filter((x) => x.name === nameFromId(x.id) && !names.has(x.id))
  await readDataset(outDir)
  console.log(
    `${outDir}: ${data.items.length} items, ${data.fluids.length} fluids, ${data.recipes.length} recipes, ` +
      `${data.machines.length} machines, ${Object.keys(atlas.index.icons).length} icons`,
  )
  console.log(`No wiki icon (${missing.length}): ${missing.join(', ')}`)
  console.log(`Names made from ids (${unnamed.length}), e.g. ${unnamed.slice(0, 10).map((x) => x.id).join(', ')}`)
}

const version = process.argv[2] ?? DEFAULT_VERSION
const wiki = new Wiki(join(cache, 'wiki'))
for (const dataset of DATASETS) await importDataset(version, dataset, wiki)

// The site's theme numbers come from the game's GUI styles, which Space Age's dump includes.
const themePath = join(root, 'src', 'theme', 'game.css')
await writeFile(themePath, themeCss(JSON.parse(await readFile(join(cache, `${DATASETS[0].game}-${version}.json`), 'utf8'))))
console.log(`${themePath}: written`)
