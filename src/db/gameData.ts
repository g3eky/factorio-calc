// Reads a dataset's database back into GameData, the in-memory form the calculator uses.

import type { Database, SqlValue } from 'sql.js'
import type { GameData, Ingredient, Result } from './types.ts'

type Row = Record<string, SqlValue>

function rows(db: Database, sql: string): Row[] {
  const statement = db.prepare(sql)
  const result: Row[] = []
  while (statement.step()) result.push(statement.getAsObject())
  statement.free()
  return result
}

// Drops null columns, so optional fields are absent rather than null, as in the YAML.
function present<T extends object>(row: Record<string, unknown>): T {
  return Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null)) as T
}

const parse = <T>(value: SqlValue): T | undefined => (value === null ? undefined : JSON.parse(value as string))

function groupBy<T>(list: Row[], key: string, map: (row: Row) => T): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const row of list) {
    const k = row[key] as string
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(map(row))
  }
  return groups
}

export function loadGameData(db: Database): GameData {
  const [game] = rows(db, 'SELECT * FROM game')
  const subgroups = groupBy(rows(db, 'SELECT * FROM item_subgroup ORDER BY rowid'), 'group_id', (r) => ({
    id: r.id as string,
    order: r.order as string,
  }))
  const recipeCategories = groupBy(rows(db, 'SELECT * FROM recipe_category ORDER BY rowid'), 'recipe', (r) => r.category as string)
  const ingredients = groupBy(rows(db, 'SELECT * FROM recipe_ingredient ORDER BY recipe, position'), 'recipe', (r) => {
    const { recipe: _, position: __, ...rest } = r
    return rest as unknown as Ingredient
  })
  const results = groupBy(rows(db, 'SELECT * FROM recipe_result ORDER BY recipe, position'), 'recipe', (r) => {
    const { recipe: _, position: __, ...rest } = r
    return present<Result>(rest)
  })
  const machineCategories = groupBy(rows(db, 'SELECT * FROM machine_category ORDER BY rowid'), 'machine', (r) => r.category as string)

  return {
    game: { name: game.name as string, version: game.version as string, mods: parse(game.mods)!, source: game.source as string },
    groups: rows(db, 'SELECT * FROM item_group ORDER BY rowid').map((r) => ({
      id: r.id as string,
      name: r.name as string,
      order: r.order as string,
      subgroups: subgroups.get(r.id as string) ?? [],
    })),
    items: rows(db, 'SELECT * FROM item ORDER BY rowid').map((r) => {
      const { fuel_category, fuel_value, burnt_result, spoil_time, spoil_result, ...rest } = r
      return present({
        ...rest,
        fuel: fuel_category === null ? null : present({ category: fuel_category, value: fuel_value, burnt_result }),
        spoil: spoil_time === null ? null : present({ time: spoil_time, result: spoil_result }),
      })
    }),
    fluids: rows(db, 'SELECT * FROM fluid ORDER BY rowid').map((r) => present(r)),
    recipes: rows(db, 'SELECT * FROM recipe ORDER BY rowid').map((r) =>
      present({
        ...r,
        hidden: r.hidden ? true : null,
        categories: recipeCategories.get(r.id as string) ?? [],
        ingredients: ingredients.get(r.id as string) ?? [],
        results: results.get(r.id as string) ?? [],
        allowed_effects: parse(r.allowed_effects),
        surface_conditions: parse(r.surface_conditions) ?? null,
      }),
    ),
    machines: rows(db, 'SELECT * FROM machine ORDER BY rowid').map((r) =>
      present({
        ...r,
        categories: machineCategories.get(r.id as string) ?? [],
        energy: parse(r.energy),
        allowed_effects: parse(r.allowed_effects),
        base_effect: parse(r.base_effect) ?? null,
        surface_conditions: parse(r.surface_conditions) ?? null,
        boiler: parse(r.boiler) ?? null,
      }),
    ),
    resources: rows(db, 'SELECT * FROM resource ORDER BY rowid').map((r) =>
      present({ ...r, results: parse(r.results), required_fluid: parse(r.required_fluid) ?? null, infinite: r.infinite ? true : null }),
    ),
    modules: rows(db, 'SELECT * FROM module ORDER BY rowid').map((r) => ({ ...present(r), effects: parse(r.effects) })),
    beacons: rows(db, 'SELECT * FROM beacon ORDER BY rowid').map((r) => ({
      ...present(r),
      profile: parse(r.profile),
      allowed_effects: parse(r.allowed_effects),
    })),
    belts: rows(db, 'SELECT * FROM belt ORDER BY rowid').map((r) => present(r)),
    planets: rows(db, 'SELECT * FROM planet ORDER BY rowid').map((r) => ({
      ...present(r),
      surface_properties: parse(r.surface_properties),
      resources: parse(r.resources),
    })),
    surface_properties: rows(db, 'SELECT * FROM surface_property ORDER BY rowid').map((r) => present(r)),
    qualities: rows(db, 'SELECT * FROM quality ORDER BY rowid').map((r) => present(r)),
    research: rows(db, 'SELECT * FROM research ORDER BY rowid').map((r) => ({ ...present(r), recipes: parse(r.recipes) })),
  } as GameData
}

export interface IconAtlas {
  size: number
  width: number
  height: number
  // Icon key ("item/iron-plate") -> [x, y] in pixels.
  positions: Map<string, [number, number]>
}

export function loadIcons(db: Database): IconAtlas | undefined {
  const [atlas] = rows(db, 'SELECT * FROM icon_atlas')
  if (!atlas) return undefined
  return {
    size: atlas.size as number,
    width: atlas.width as number,
    height: atlas.height as number,
    positions: new Map(rows(db, 'SELECT * FROM icon').map((r) => [r.key as string, [r.x as number, r.y as number]])),
  }
}
