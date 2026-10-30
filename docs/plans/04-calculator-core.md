# 04 Calculator core

## Goal

A pure TypeScript calculator that, given what to make and how fast, works out which recipes to run, how many machines, their power, the raw inputs and any byproducts. No UI.

## Scope

In:
- Turning `GameData` plus settings into production processes with effective rates.
- Solving for the process rates, including cycles and byproducts.
- Running in a Web Worker so the UI never blocks.
- Tests against known correct answers.

Out:
- Planet restrictions (07) and quality (08). The design leaves room for them.
- UI (05).

## Design

**Processes.** Everything that turns inputs into outputs becomes a process:
- Recipes in a crafting machine.
- Mining a resource with a drill, pumping with a pumpjack or offshore pump.
- Boilers and other converters that aren't recipes.

For each process the calculator works out the per-second inputs and outputs of one machine, taking into account:
- Machine speed and power, recipe time.
- Result amounts, ranges and probabilities; items excluded from productivity.
- Modules, beacons (with the 2.0 beacon profile, where each extra beacon is weaker) and the machine's built-in effects.
- Productivity research and the recipe's productivity cap.
- Fuel use for burner machines.
- Minimum limits on speed and power the game applies.

**Solving.** A linear program, because real chains have cycles (oil processing, coal liquefaction, Kovarex, asteroid reprocessing, recycling) and byproducts that a simple tree walk can't handle:
- Variables: how many times per second each enabled process runs (≥ 0).
- Constraints: each target item's net output equals the requested rate; every other item's net output is ≥ 0 (extra becomes a byproduct).
- Objective: use as few raw resources as possible, with a small cost per machine to break ties.
- Users can disable recipes (e.g. recycling, barrelling) and the defaults disable the ones that would surprise people.
- Output: process rates, machine counts (fractional and rounded up), power, raw inputs, byproducts, and an explanation when there's no solution (e.g. a needed recipe is disabled).

**Worker.** `src/calculator/` exposes `solve(request) → result`, run in a Web Worker. New requests cancel stale ones, so typing never queues up work.

## Steps

1. Write the request and result types.
2. Build processes and effective rates from `GameData`; unit-test the rate maths on its own.
3. Add the LP solver and the model around it.
4. Move it into a worker with cancellation.
5. Write test cases with known answers.

## Done when

`./run test` passes, with tests including:
- A plain chain: electronic circuits in assembling machines give the textbook 3:2 cable to circuit ratio.
- Advanced oil processing plus cracking: no wasted fluid, correct refinery count.
- Kovarex: solves the cycle.
- Modules + beacons + productivity research: matches hand calculation.
- Foundry and electromagnetic plant built-in productivity.
- Disabling a required recipe gives a clear "no solution" with the reason.

Results for 5 of the cases also match an existing calculator (e.g. FactorioLab) within 0.1%.

Solving for all Space Age science packs at once takes under 50 ms in the worker on a laptop.

## Open questions

- **LP solver:** use a library or write our own simplex? Recommendation: a proven library such as HiGHS compiled to WebAssembly (`highs` on npm, a new dependency). Writing our own is possible but hard to make reliable.
