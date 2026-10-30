# 01 Data model

## Goal

Define how game data is written as YAML and stored in SQLite, validate it at build time, and give the browser a typed way to load it.

## Scope

In:
- The YAML format for one dataset (`data/<game>/<version>/`).
- The SQLite schema the build writes.
- Validation with clear errors.
- A typed loader in `src/db/` that turns the database into in-memory game data for the calculator.
- A small hand-written fixture dataset that uses every field.

Out:
- The real Space Age data (02).
- Calculation logic (04).

## Design

**Names follow the game.** Ids and field names match Factorio's own prototype names (`iron-plate`, `assembling-machine-2`, `energy_required`, …), so importing from the game in 02 is a straight mapping and anyone who knows Factorio modding can read the files.

**One YAML file per kind of thing:**

| File | Holds |
|---|---|
| `game.yml` | Dataset id, display name, game version, mods/DLC included. |
| `groups.yml` | Item groups and subgroups with their order (drives the item picker, like the in-game crafting menu). |
| `items.yml` | Items: group, order, stack size, fuel value and category, spoil time and result. |
| `fluids.yml` | Fluids: default temperature, group, order. |
| `recipes.yml` | Category, time, ingredients, results (amounts, ranges, probabilities, productivity exclusions), productivity allowed and its cap, allowed module effects, surface conditions. |
| `machines.yml` | Crafting machines: crafting categories, speed, power use and energy source (electric or burner + fuel categories), module slots, built-in effects (e.g. foundry productivity), surface conditions. |
| `resources.yml` | Mineable resources and fluids: mining time, results, required fluid, resource category. |
| `extraction.yml` | Mining drills, pumpjacks, offshore pumps, boilers and other non-recipe producers. |
| `modules.yml` | Modules and their effects. |
| `beacons.yml` | Beacons: slots, distribution effectivity, profile. |
| `logistics.yml` | Belts (and later pipes/inserters) with throughput, for showing results as "belts needed". |
| `planets.yml` | Planets and space platforms with their surface properties. |
| `research.yml` | Productivity research: mining productivity and per-recipe productivity techs, bonus per level. |

**SQLite schema** mirrors the YAML. One table per kind, plus child tables for lists (recipe ingredients, recipe results, machine categories, …). Every table has the id as primary key and foreign keys between them. The schema lives in one `schema.sql` in `scripts/` and is documented in `docs/data-model.md`.

**Validation** runs in `build-db.ts` before writing:
- Each file matches its shape (required fields, types, allowed values).
- Every reference resolves (ingredient → item/fluid, recipe category → at least one machine, …).
- Errors name the file, line and field; all errors are reported at once, not just the first.

**Loading in the browser:** `src/db/` opens the database, reads all tables once, and builds a typed `GameData` object (maps by id, recipes by product, machines by category). The calculator only uses `GameData`, never SQL directly. SQL stays available for search and future features.

## Steps

1. Write `docs/data-model.md`: every file, field, unit and default.
2. Write `scripts/schema.sql`.
3. Write the fixture in `data/fixture/0/`: the iron/copper → electronic circuit chain, basic oil processing (a cycle) and one drill, module, beacon and planet. Exclude it from production builds.
4. Extend `build-db.ts` with validation and the full schema.
5. Write the `GameData` types and loader in `src/db/`.
6. Tests: the fixture builds; broken fixtures (missing ref, wrong type, bad YAML) fail with the right file, line and message; the loader returns the expected `GameData`.

## Done when

- `./run test` passes, including the broken-fixture tests.
- `./run db` builds the fixture, and `sqlite3` shows every table filled.
- `docs/data-model.md` covers every field in the fixture.

## Open questions

- Hand-written validation, or a schema library such as `zod` (a new dependency)? Recommendation: hand-written until it becomes painful.
