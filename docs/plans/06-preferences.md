# 06 Preferences

## Goal

A settings window for the defaults every calculation starts from, saved in `localStorage`.

## Scope

In:
- Default machine per crafting category, default drill, belt and fuel.
- Default modules and beacons (per machine type).
- Research levels: mining productivity and each recipe productivity tech.
- Recipes disabled by default.
- Display: rate unit, decimal places, show belts or rates.
- Reset to defaults; export and import settings as a JSON file.

Out:
- Anything planet-specific (07).

## Design

- One game-style `Window` with tabs: Machines, Modules, Research, Recipes, Display.
- Per-row overrides from 05 win over these defaults; a row shows when it differs from the default.
- Changes apply immediately (re-solve) and save immediately; no Save button, like the game's settings.
- Settings are stored per dataset id (ready for 09), under the versioned key from 00.
- **Migrations:** each change to the stored shape bumps its version and adds a migration function. Unknown or broken data falls back to defaults and keeps the old value under a backup key instead of deleting it.

## Steps

1. Settings types, defaults and migrations in `src/settings/`.
2. The settings window and its tabs.
3. Wire defaults into the calculator request.
4. Export/import.

## Done when

- Changing a default updates results right away and survives a reload.
- Tests: each migration; broken stored data falls back to defaults and is backed up; export → import round-trips exactly.
- `./run test` passes.
