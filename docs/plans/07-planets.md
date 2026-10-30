# 07 Planets

## Goal

Calculate for a specific planet or space platform, using only the recipes, machines and resources available there.

## Scope

In:
- A planet select on the calculation: Nauvis, Vulcanus, Fulgora, Gleba, Aquilo, space platform.
- Surface conditions (pressure, gravity, magnetic field, …) filtering recipes and machines.
- Planet resources: e.g. lava and calcite on Vulcanus, scrap on Fulgora, fruit on Gleba, asteroids in space.
- Space platform production: asteroid collectors and crushing.
- Importing items from another planet as a raw input.
- Per-planet default machines (e.g. foundries on Vulcanus).

Out:
- Planning rocket launches and space logistics between planets.

## Design

- The planet is part of the calculation request. The calculator removes processes that can't run there before solving.
- Items not producible on the chosen planet become imports and are listed separately from local raw resources.
- Spoilable items (Gleba) show their spoil time, and a warning when the chain is slow enough that items would spoil in transit. The calculator doesn't model spoilage loss.

## Steps

1. Surface conditions check in the calculator, with tests.
2. Planet resources and asteroid processes.
3. Imports in the result.
4. Planet select and per-planet defaults in the UI.

## Done when

Tests show (real Space Age 2.1.24 data): ✔
- Vulcanus: iron plates from pumped lava → molten iron in foundries, no iron ore, no imports.
- Fulgora: holmium from mined scrap through scrap recycling, with its byproducts as surplus.
- Space platform: iron from crushed metallic asteroid chunks.
- Gleba: bioflux from gathered yumako and jellynut; biochambers burn nutrients.
- Tungsten on Nauvis is imported, not invented.
- Building all 12 science packs on each planet never uses a recipe or machine whose surface conditions fail there.

The planet select switches results without a reload. ✔ Checked in Chrome: agricultural science on Nauvis shows as an import (biochambers need Gleba's pressure); on Gleba it's built from gathered fruit with spoil times listed.

## Decisions

- **Data:** planets gained `fluids` (from their tiles, for offshore pumps) and `gathered` (plant harvests whose soil tiles are on the planet, fish, and asteroid chunks on platforms). The importer keeps `autoplace` to work these out.
- **Imports:** only items that can't be made on the planet can be imported, at 10× the cost of a local raw resource, so local production always wins when it's possible.
- **Scrap recycling** is on by default: recycling of mined resources isn't a reverse recipe. Other recycling stays off.
- **Burner fuel:** the preferred fuel where a burner accepts it, else the first fuel it does (nutrients for biochambers).
- **Spoilage:** shown as a list of spoiling items with their spoil times; not modelled as a loss.
- Machine preferences are global; machines that don't work on the chosen planet are skipped in favour of the planet's default.
