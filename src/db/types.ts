// The shape of one dataset. The YAML files in data/, the SQLite tables and the in-browser
// GameData all use these names, which follow Factorio's own prototype field names.
// Units: time in seconds, power in watts, energy in joules, rates per second.

export type Id = string
export type EffectName = 'speed' | 'productivity' | 'consumption' | 'pollution' | 'quality'
export type Effects = Partial<Record<EffectName, number>>

export interface Game {
  name: string
  version: string
  mods: string[]
  source: string
}

export interface Group {
  id: Id
  name: string
  order: string
  subgroups: { id: Id; order: string }[]
}

export interface Item {
  id: Id
  name: string
  subgroup: Id
  order: string
  stack_size: number
  fuel?: { category: Id; value: number; burnt_result?: Id }
  spoil?: { time: number; result?: Id }
}

export interface Fluid {
  id: Id
  name: string
  subgroup: Id
  order: string
  default_temperature: number
  fuel_value?: number
}

export interface Ingredient {
  type: 'item' | 'fluid'
  id: Id
  amount: number
}

export interface Result {
  type: 'item' | 'fluid'
  id: Id
  // Either a fixed amount or a range; then a probability and an extra fractional amount.
  amount?: number
  amount_min?: number
  amount_max?: number
  probability?: number
  extra_fraction?: number
  // How much of the result is excluded from productivity bonuses.
  ignored_by_productivity?: number
}

export interface SurfaceCondition {
  property: Id
  min?: number
  max?: number
}

export interface Recipe {
  id: Id
  name: string
  categories: Id[]
  time: number
  ingredients: Ingredient[]
  results: Result[]
  main_product?: Id
  subgroup?: Id
  order: string
  hidden?: boolean
  allowed_effects: EffectName[]
  max_productivity: number
  surface_conditions?: SurfaceCondition[]
}

export type MachineKind = 'crafting' | 'mining' | 'offshore-pump' | 'boiler'

export interface Energy {
  type: 'electric' | 'burner' | 'heat' | 'fluid' | 'void'
  usage: number
  drain?: number
  fuel_categories?: Id[]
}

export interface Machine {
  id: Id
  name: string
  kind: MachineKind
  // Crafting categories for crafting machines, resource categories for mining drills.
  categories: Id[]
  // Crafting speed, mining speed, or pumping speed in units per second.
  speed: number
  energy: Energy
  module_slots: number
  allowed_effects: EffectName[]
  base_effect?: Effects
  surface_conditions?: SurfaceCondition[]
  // Boilers: heats input_fluid into output_fluid at target_temperature.
  boiler?: { input_fluid: Id; output_fluid: Id; target_temperature: number }
}

export interface Resource {
  id: Id
  name: string
  category: Id
  mining_time: number
  results: Result[]
  required_fluid?: { id: Id; amount: number }
  infinite?: boolean
}

export interface Module {
  id: Id
  name: string
  category: Id
  tier: number
  effects: Effects
}

export interface Beacon {
  id: Id
  name: string
  distribution_effectivity: number
  distribution_effectivity_per_quality: number
  profile: number[]
  module_slots: number
  power: number
  allowed_effects: EffectName[]
}

export interface Belt {
  id: Id
  name: string
  speed: number
}

export interface Planet {
  id: Id
  name: string
  kind: 'planet' | 'platform'
  surface_properties: Record<Id, number>
  resources: Id[]
  // Fluids offshore pumps can pump there (lava on Vulcanus, heavy oil on Fulgora, ...).
  fluids: Id[]
  // Items gathered without a recipe: plant harvests, fish, asteroid chunks.
  gathered: Id[]
}

export interface SurfaceProperty {
  id: Id
  name: string
  default_value: number
}

export interface Quality {
  id: Id
  name: string
  level: number
  next?: Id
  next_probability?: number
}

export interface Research {
  id: Id
  name: string
  kind: 'recipe-productivity' | 'mining-productivity'
  // Productivity bonus per level, for each recipe it affects (none for mining productivity).
  recipes: Id[]
  change: number
  max_level?: number
}

export interface GameData {
  game: Game
  groups: Group[]
  items: Item[]
  fluids: Fluid[]
  recipes: Recipe[]
  machines: Machine[]
  resources: Resource[]
  modules: Module[]
  beacons: Beacon[]
  belts: Belt[]
  planets: Planet[]
  surface_properties: SurfaceProperty[]
  qualities: Quality[]
  research: Research[]
}

// One YAML file per GameData key (except `game`, which is game.yml).
export const DATA_FILES = {
  groups: 'groups.yml',
  items: 'items.yml',
  fluids: 'fluids.yml',
  recipes: 'recipes.yml',
  machines: 'machines.yml',
  resources: 'resources.yml',
  modules: 'modules.yml',
  beacons: 'beacons.yml',
  belts: 'belts.yml',
  planets: 'planets.yml',
  surface_properties: 'surface-properties.yml',
  qualities: 'qualities.yml',
  research: 'research.yml',
} as const satisfies Record<Exclude<keyof GameData, 'game'>, string>
