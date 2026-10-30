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

Tests show:
- Vulcanus: iron plates via lava → molten iron in foundries.
- Fulgora: scrap recycling solves with its byproducts.
- Space platform: crushing from collected asteroid chunks.
- A recipe whose surface conditions fail on the chosen planet is never used.

The planet select switches results without a reload.

## Open questions

- Should spoilage be modelled as a loss in the calculation, or only shown as a warning? Recommendation: warning only for now.
