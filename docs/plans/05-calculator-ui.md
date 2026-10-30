# 05 Calculator UI

## Goal

The main screen: choose what to make and how fast, and see the full production chain live as you change it.

## Scope

In:
- Targets, results and per-row settings.
- Restoring the last calculation from `localStorage` on reload.

Out:
- Global defaults screen (06), planets (07), quality (08), version select (09).

## Design

**Targets panel.**
- Add targets with the item picker; set each as a rate (per second, minute or hour), as a number of belts, or as a number of machines.
- Remove or reorder targets.

**Results.** A table with one row per process, grouped by item in production order:
- Recipe icon and name, machine icon and count (e.g. `12.4` with a ⌈13⌉ badge), modules and beacons as slots.
- Inputs and outputs per second as `Slot`s with amounts; power.
- Click a machine or module slot to change it for that row; click an item to choose which recipe makes it.
- Rows can be collapsed into their parent to keep big factories readable.

**Totals bar.** Raw inputs, byproducts, total power, total machines by type.

**Live and smooth.**
- Every change re-solves in the worker (04). The previous result stays on screen until the new one arrives, so nothing flickers.
- Numbers that change get a short highlight; rows that appear or disappear fade, they don't jump.
- If the solver fails, show why in a game-style message, and keep the last good result.

**State.** The current targets and overrides are saved to `localStorage` through `src/settings/` on every change and restored on load.

**Layout.** Desktop first: targets on the left, results on the right. On narrow screens they stack.

## Steps

1. App layout: header, targets panel, results area, totals bar.
2. Targets panel.
3. Results table with rate formatting and unit switching.
4. Per-row overrides and recipe choice.
5. Persistence.
6. Polish: transitions, empty state, error state.

## Done when

- Building "1 of each Space Age science pack per second" from an empty page takes under a minute, and the numbers match the 04 test results.
- Changing a target or override updates results without a visible stall (no long task over 50 ms in the Chrome performance panel).
- Reloading the page restores exactly what was on screen.
- Works in current Chrome, Firefox and Safari, at 1280 px wide and on a phone.

## Open questions

- **Share links:** encode the calculation in the URL hash so it can be shared. The site stays stateless; it only adds a "copy link" button. Add here or in a later stage?
- **Flow diagram:** a Sankey-style graph of the chain, as an alternative to the table. Recommendation: a later stage, after the table is solid.
