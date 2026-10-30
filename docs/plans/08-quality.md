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

- 08a: a legendary assembling machine 3 with four legendary speed module 3s crafts at 18.75 (1.25 × 2.5 × (1 + 4 × 0.5 × 2.5)), as in game. ✔ Beacon quality (+0.2 effectivity per level) and beacon module quality are tested too.
- 08b: the share of output at each tier matches hand calculation (5% quality: 4.5% uncommon, 0.5% rare), and an upcycling loop (quality modules on circuits, normal circuits recycled back into plates and cable) uses exactly the hand-calculated ore. ✔
- `./run test` passes. ✔
- In Chrome: uncommon electronic circuits with quality module 3s show quality badges on targets, slots and surplus, and the rare/epic/legendary leftovers. ✔

## Decisions

- **2.1 quality numbers:** Factorio 2.1 sets `next_probability` to 1 and adds `chain_probability` (0.1): a craft upgrades one tier with the quality chance, then each further tier with the chain probability. Legendary is level 5. Both are imported.
- **Bonuses:** crafting machines +30% speed per quality level; modules' positive effects +30% per level (penalties unchanged); beacons +0.2 effectivity per level. Quality doesn't change mining drill speed here.
- **When tiers are expanded:** every item recipe also runs at higher tiers only when a target asks for a higher tier. Quality modules always split output, so with no quality targets the better items show up as surplus.
- **No source for quality:** higher-quality items can't be mined or imported. Higher-tier ingredients nothing makes simply get no supply; if a quality target can't be met, the error says to add quality modules.
- Machine quality is a setting (default) and per row; module, beacon and beacon module quality are part of each module setup.
