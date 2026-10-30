# 02 Data import

## Goal

Fill `data/space-age/<version>/` with the complete Space Age data, names and icons, generated from the game itself so it's correct and repeatable for future versions.

## Scope

In:
- `./run import <factorio-path>`: runs the game's data dump and converts it to YAML.
- English display names.
- Item, fluid, recipe, machine and planet icons, packed for fast loading.

Out:
- Other languages.
- Base game and other versions (09). The importer should work for them, but only Space Age is imported now.

## Design

**Source.** Factorio can dump its loaded prototypes from the command line, without starting a game:
- `--dump-data` → `script-output/data-raw-dump.json` (all prototypes)
- `--dump-prototype-locale` → English names and descriptions
- `--dump-icon-sprites` → one PNG per icon

This needs a local Factorio install with Space Age. The import is run by a maintainer and its output is committed, so the site build never needs the game.

**Conversion.** `scripts/import-dump.ts` reads the dump and writes the YAML files from 01. It:
- Keeps only what the calculator needs.
- Fills in the game's defaults (e.g. a recipe with no `energy_required` takes 0.5 s), so the YAML is explicit.
- Writes in a stable order with stable formatting, so re-importing the same version gives no diff and a new version gives a readable one.
- Drops hidden and unusable things (e.g. hidden recipes with no machine), and lists what it dropped.

**Icons.** Icons are the visible bulk of the UI, so they must load as one image, not hundreds. The importer packs them into a sprite atlas (`icons.png` + `icons.json` with positions) inside the dataset folder. The build copies them to `dist/` with a content hash, like the database.

**Version folder.** Use the exact game version (e.g. `data/space-age/2.0.72/`, using whatever is current at import time). Rename the placeholder `2.0/` folder from 00.

## Steps

1. Run the dumps on a local install; check the exact CLI options against that version.
2. Write `scripts/import-dump.ts` and `scripts/import.sh`.
3. Map each prototype type to the 01 YAML files; add fields to the data model if the real data needs them (and update `docs/data-model.md`).
4. Pack icons into the atlas.
5. Import Space Age; commit the result.
6. Spot-check against the game.

## Done when

- `./run import` on the same install twice produces no git diff.
- The imported data passes validation and `./run build` succeeds.
- 20 recipes across all planets match their in-game tooltips (time, ingredients, results, machine). The list checked is recorded at the end of this plan.
- All icons in the atlas display correctly in a debug page.

## Open questions

- **Icon packing** needs an image library (e.g. `sharp`) at import time only. OK to add as a dev dependency?
- **Licensing:** names, data and icons belong to Wube. Fan calculators commonly use them; we should credit Wube and check their terms before the site goes public.
