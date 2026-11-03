# 02 Data import

## Goal

Fill `data/space-age/<version>/` with the complete Space Age data, names and icons, generated from public sources so it's correct and repeatable for future versions.

## Scope

In:
- `./run import [version]`: downloads the game's prototype definitions, runs them, and converts the result to YAML.
- English display names.
- Icons for items, fluids, recipes with their own icon, machines and planets, packed into one image.

Out:
- Other languages.
- Base game and other versions (09). The importer takes a mod list, so it works for them, but only Space Age is imported now.

## Sources and licences

| What | Source | Terms |
|---|---|---|
| Recipes, items, machines, modules, … | [wube/factorio-data](https://github.com/wube/factorio-data), Wube's public copy of the game's Lua prototype definitions. | Its README lists "online references, cheat sheets, and calculators" as intended uses. We ship only derived numbers, not Wube's Lua. |
| English names | Infobox pages on [wiki.factorio.com](https://wiki.factorio.com). | Wiki text is CC BY-NC-SA 3.0: credit the wiki, non-commercial, share alike. |
| Icons | Images on wiki.factorio.com. | Wube's art; not covered by the wiki's CC licence. Factorio's terms of service don't permit redistributing art assets. Chosen knowingly, like other fan calculators; credit Wube and remove them if asked. |

## Design

**Running the data stage.** `scripts/import/dump.lua` runs Factorio's data stage (core, then each mod's `settings`, `data`, `data-updates`, `data-final-fixes`) with LuaJIT and writes `data.raw` as JSON. This is the same process the game runs at startup, so generated content such as recycling recipes and barrel recipes comes out exactly as in the game.
- **Sandboxed:** Wube's Lua gets only pure functions (string, table, math) and the Factorio globals it needs. No file, OS, network, debug or code-loading access.
- **Lua 5.2 compatibility:** Factorio uses Lua 5.2; LuaJIT is 5.1. The runner moves a `(` that starts a line onto the previous line, so 5.2's newline-before-call syntax parses (a small scanner skips strings and comments).
- **Deterministic:** Factorio iterates tables in a fixed order and the data stage depends on it, so `data.raw` and its per-type tables iterate in insertion order.
- **Not in the repo:** graphics, sounds and menu simulations are stubbed; they don't affect any numbers.

**Conversion.** `scripts/import/convert.ts` turns `data.raw` into the 01 data model. It:
- Keeps only what the calculator needs and fills in the game's defaults (e.g. a recipe with no `energy_required` takes 0.5 s; crafting machines idle at 1/30 of their power).
- Drops hidden items and anything no machine can make or mine (e.g. hand-crafting-only recipes).
- Converts 2.1's `independent_probability` and `shared_probability` (a slice of one shared roll) into one chance per result.
- Writes in a stable order, so re-importing the same version gives no diff and a new version gives a readable one.

**Names.** Each wiki infobox has the prototype's internal name; its page title is the English name. Technology and archived pages are skipped. Anything without a wiki page gets a name made from its id (`iron-plate` → `Iron plate`).

**Icons.** Wiki icons are named after the English name (`File:Iron plate.png`). The importer downloads them (cached in `node_modules/.cache/factorio-calc/`), resizes them to 64 px with `sharp`, and packs them into `icons.webp` + `icons.json`, with an 8 px gap around each icon filled with copies of its own edge pixels (otherwise shrinking an icon blends in its neighbours, drawn as thin lines along its edges). The build copies the atlas to `dist/db/` with a content hash and stores positions in the database.

**Version folder.** The exact game version: `data/space-age/2.1.24/`.

## Steps

1. Lua runner with sandbox, compatibility shim and deterministic order.
2. Converter with unit tests for each rule above.
3. Wiki names and icons; atlas packing.
4. Icon atlas in the build and manifest.
5. Import Space Age 2.1.24; commit the result.
6. Check against the wiki.

## Done when

- `./run import` twice in a row produces no diff. ✔
- The imported data passes validation and `./run build` succeeds. ✔
- Recipes match the wiki. ✔ All 259 recipes that have a recipe in their wiki infobox were compared automatically (time, ingredients, results). All match; the wiki writes chance-based results as fractional amounts (uranium processing: 0.007 U-235), which matches our amount × probability.
- All icons display correctly. ✔ Checked visually in the atlas; 9 have no wiki image (car, fluoroketone barrels and their recipes, iron/copper ore melting).

## Results

Space Age 2.1.24: 287 items, 22 fluids, 612 recipes (313 of them recycling), 24 machines, 419 icons. Database 688 KB, icon atlas 966 KB.
