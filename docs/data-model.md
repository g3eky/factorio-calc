# Data model

Game data for one dataset lives in `data/<game>/<version>/` as YAML. The build validates it and writes one SQLite database per dataset; the browser reads that database back into `GameData`.

All three use the same names, defined once in `src/db/types.ts`. Ids and field names follow Factorio's own prototype names (`iron-plate`, `energy_required` → `time`, …).

**Units:** time in seconds, power in watts, energy in joules, speeds and rates per second. Effects (`speed`, `productivity`, `consumption`, `pollution`, `quality`) are fractions: `0.5` means +50%.

**Optional fields** are left out rather than set to `null`.

## Files

### `game.yml`

| Field | Meaning |
|---|---|
| `name` | Display name, e.g. `Space Age`. |
| `version` | Game version the data comes from. |
| `mods` | Mods loaded to produce the data. |
| `source` | Where the data came from. |

### `groups.yml`

Item groups (the tabs of the in-game item picker) and their subgroups (rows).

| Field | Meaning |
|---|---|
| `id`, `name`, `order` | Group id, display name, sort key. |
| `subgroups[]` | `id` and `order` of each row in the group. |

### `items.yml`

| Field | Meaning |
|---|---|
| `id`, `name` | |
| `subgroup`, `order` | Position in the item picker. |
| `stack_size` | Items per inventory stack. |
| `fuel?` | `category` (e.g. `chemical`), `value` (J), `burnt_result?` (item left after burning). |
| `spoil?` | `time` (s) until it spoils, `result?` (item it spoils into). |

### `fluids.yml`

| Field | Meaning |
|---|---|
| `id`, `name`, `subgroup`, `order` | As for items. |
| `default_temperature` | °C. |
| `fuel_value?` | J per unit, for fluids that burn. |

### `recipes.yml`

| Field | Meaning |
|---|---|
| `id`, `name` | |
| `categories` | Crafting categories; any machine with one of them can make it. |
| `time` | Seconds at crafting speed 1. |
| `ingredients[]` | `type` (`item` or `fluid`), `id`, `amount`. |
| `results[]` | `type`, `id`, then either `amount` or `amount_min` + `amount_max`; optional `probability` (0–1), `extra_fraction` (added expected amount, used by recycling), `ignored_by_productivity` (amount that productivity bonuses don't multiply). |
| `main_product?` | The result the recipe is named and shown after, when it has several. |
| `subgroup?`, `order` | Position in the item picker. |
| `hidden?` | Not shown in the game's crafting menu (e.g. recycling). |
| `allowed_effects` | Module effects that apply to this recipe. |
| `max_productivity` | Productivity cap (3 = +300%). |
| `surface_conditions?` | `property`, `min?`, `max?`: where the recipe can be made. |

Expected output of one craft: `(amount, or (amount_min + amount_max) / 2) × probability + extra_fraction`. Productivity multiplies only the part above `ignored_by_productivity`.

### `machines.yml`

Everything that makes or extracts things.

| Field | Meaning |
|---|---|
| `id`, `name` | |
| `kind` | `crafting`, `mining`, `offshore-pump` or `boiler`. |
| `categories` | Crafting categories (crafting) or resource categories (mining). |
| `speed` | Crafting speed, mining speed, or pumping speed in units/s. |
| `energy` | `type` (`electric`, `burner`, `heat`, `fluid`, `void`), `usage` (W), `drain?` (W, electric idle draw), `fuel_categories?` (burner). |
| `module_slots` | |
| `allowed_effects` | Module effects the machine accepts. |
| `base_effect?` | Built-in effects, e.g. the foundry's `productivity: 0.5`. |
| `surface_conditions?` | Where it can be placed. |
| `boiler?` | `input_fluid`, `output_fluid`, `target_temperature` (°C). |

### `resources.yml`

Things mined from the map.

| Field | Meaning |
|---|---|
| `id`, `name` | |
| `category` | Resource category; mining machines list the categories they mine. |
| `mining_time` | Seconds per mining operation at mining speed 1. |
| `results[]` | As for recipes. |
| `required_fluid?` | `id` and `amount` per mining operation (e.g. sulfuric acid for uranium). |
| `infinite?` | Depleting fluid wells like crude oil. |

### `modules.yml`

| Field | Meaning |
|---|---|
| `id`, `name` | Same id as the module's item. |
| `category` | `speed`, `productivity`, `efficiency`, `quality`. |
| `tier` | 1–3. |
| `effects` | Effects at normal quality. |

### `beacons.yml`

| Field | Meaning |
|---|---|
| `id`, `name` | |
| `distribution_effectivity` | Share of module effects passed on, at normal quality. |
| `distribution_effectivity_per_quality` | Added per quality level. |
| `profile` | Strength multiplier by number of beacons affecting a machine (`profile[n-1]` for n beacons). |
| `module_slots`, `power` (W), `allowed_effects` | |

### `belts.yml`

| Field | Meaning |
|---|---|
| `id`, `name` | |
| `speed` | Items/s for a full belt (both lanes). |

### `planets.yml`

| Field | Meaning |
|---|---|
| `id`, `name` | |
| `kind` | `planet` or `platform`. |
| `surface_properties` | Property id → value. Missing properties use their default. |
| `resources` | Resource ids found there. |
| `fluids` | Fluids offshore pumps can pump there (from its tiles). |
| `gathered` | Items gathered without a recipe: plant harvests, fish, asteroid chunks on platforms. |

### `surface-properties.yml`

| Field | Meaning |
|---|---|
| `id`, `name`, `default_value` | E.g. `pressure`, default 1000 hPa. |

### `qualities.yml`

| Field | Meaning |
|---|---|
| `id`, `name`, `level` | `normal` is level 0. |
| `next?`, `next_probability?` | The next tier up, and the base chance of skipping to it. |

### `research.yml`

Infinite and repeatable productivity research.

| Field | Meaning |
|---|---|
| `id`, `name` | Technology id and name. |
| `kind` | `recipe-productivity` or `mining-productivity`. |
| `recipes` | Recipes it affects (empty for mining productivity). |
| `change` | Productivity added per level. |
| `max_level?` | Missing means unlimited. |

### `icons.webp` and `icons.json`

The icon atlas written by the importer: 64 px icons in one image, and their positions. Keys are `<kind>/<id>` with kind `item`, `fluid`, `recipe`, `machine` or `planet`. A recipe only has its own icon when the game gives it one; otherwise show its main product's.

## Validation

`./run build`, `./run dev` and `./run db` validate every dataset before writing it (`scripts/validate.ts`):

- Each file's shape: required fields, types, allowed values. Unknown fields are errors, to catch typos.
- References between files: ingredients and results exist, every recipe has a machine, subgroups, surface properties, resources and qualities exist.
- Ids are unique within each file.

All problems are reported at once as `file:line: path: message`.

## SQLite

The schema is `scripts/schema.sql`. Each file is a table; icon positions go in `icon_atlas` and `icon`. Lists that are queried get their own tables (`recipe_category`, `recipe_ingredient`, `recipe_result`, `machine_category`, `item_subgroup`); other nested values are stored as JSON text. `src/db/gameData.ts` reads it back into `GameData`.

## Test fixture

`scripts/fixtures/basic/` is a small hand-written dataset that uses every field. It's only used by tests and never shipped.
