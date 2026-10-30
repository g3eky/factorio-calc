# 08 Quality

## Goal

Support the quality system: higher-quality machines, modules and beacons, and planning production of higher-quality items.

## Scope

Split in two, because the second part is much harder:

**08a Quality of equipment.** Choose the quality of each machine, module and beacon; their stats scale with quality. Small change to the calculator's rate maths.

**08b Producing quality items.** Targets can be a quality level (e.g. legendary quantum processors). Quality modules make a share of output come out at higher quality; recycling sends unwanted quality back. This turns each item into five (one per tier) and adds loops, which the LP from 04 can solve.

## Design

- Quality tiers and their bonuses come from the data (`quality.yml`, added to the data model).
- `Slot` shows the quality badge (03).
- 08b: each process runs at an input quality and produces outputs spread over higher tiers by the quality chance. Recycling processes return ingredients at the same quality. The LP then finds the cheapest mix.
- Defaults keep quality off, so people who don't use it see no change.

## Steps

1. Quality data in the data model and import.
2. 08a: quality on equipment, UI and tests.
3. 08b: quality-split processes, recycling loops, quality targets, UI and tests.

## Done when

- 08a: a legendary assembling machine 3 with legendary speed modules gives the in-game crafting speed.
- 08b: the expected number of legendary outputs per normal input for a simple upcycling loop matches a hand calculation and an existing calculator within 1%.
- `./run test` passes.

## Open questions

- Is 08b wanted, or is 08a enough?
