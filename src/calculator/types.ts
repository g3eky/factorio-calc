// What the calculator is asked, and what it answers. Rates are per second.

export type Kind = 'item' | 'fluid'

export interface Amount {
  kind: Kind
  id: string
  rate: number
  // Quality tier of an item; missing means normal. Fluids have no quality.
  quality?: string
}

export interface ModuleSetup {
  // Module ids in the machine's slots (extra ones beyond the slot count are ignored).
  modules: string[]
  // Quality of those modules; missing means normal.
  quality?: string
  // Beacons, with their own quality and their modules' quality.
  beacons: { id: string; count: number; modules: string[]; quality?: string; moduleQuality?: string }[]
}

// Settings for one process: which machine, and its modules and beacons.
export interface ProcessSettings {
  machine?: string
  // Quality of the machine.
  quality?: string
  setup?: ModuleSetup
}

export interface SolveRequest {
  targets: Amount[]
  // Machine per crafting or resource category; missing ones use defaultMachines().
  machines: Record<string, string>
  // Modules and beacons per machine id, unless a process overrides them.
  setups: Record<string, ModuleSetup>
  // Per process ("recipe/<id>", "resource/<id>"), overriding the defaults above.
  overrides: Record<string, ProcessSettings>
  // Recipes the solver may not use.
  disabled: string[]
  // Research id -> level researched.
  research: Record<string, number>
  // Fuel item for burner machines.
  fuel: string
  // Planet or platform to build on. Without one, everything everywhere is allowed.
  planet?: string
  // Default quality of machines.
  machineQuality?: string
}

export interface ProcessResult {
  key: string
  kind: 'recipe' | 'resource' | 'pump'
  // Recipe or resource id; for pumps, the fluid.
  id: string
  // Quality the recipe runs at; missing means normal.
  quality?: string
  machine: string
  machineQuality?: string
  machines: number
  // Electric power in watts, including idle drain.
  power: number
  inputs: Amount[]
  outputs: Amount[]
  // Effects applied, after limits and caps (fractions).
  speed: number
  productivity: number
  consumption: number
  // Chance of an upgrade per craft (the quality effect).
  qualityEffect: number
}

export interface SolveResult {
  processes: ProcessResult[]
  // Raw resources: mined, pumped or gathered (or, without a planet, with no way to make them).
  raw: Amount[]
  // Things that can't be made on the chosen planet and have to be brought in.
  imports: Amount[]
  // Produced beyond what's needed.
  surplus: Amount[]
  power: number
  // Machine id -> count, fractional.
  machines: Record<string, number>
  warnings: string[]
}

export type SolveResponse = { ok: true; result: SolveResult } | { ok: false; error: string }
