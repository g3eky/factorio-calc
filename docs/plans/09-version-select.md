# 09 Version select

## Goal

Switch between datasets, such as base game and Space Age, and between game versions, from the header.

## Scope

In:
- Importing the base game (no DLC) for the same version as Space Age.
- A version select in the header listing every dataset in the manifest.
- Keeping each dataset's settings and calculation separately.

Out:
- Factorio 1.1 or older. The importer and data model are built for 2.x; older versions would need their own mapping.

## Design

- The select reads `db/manifest.json`. Picking a dataset downloads its database and icon atlas (cached afterwards) and swaps `GameData` without a page reload. A loading state covers the swap.
- The last chosen dataset is remembered in `localStorage`. The default for new visitors is the newest Space Age.
- Settings and calculations are already stored per dataset id (06), so switching back restores exactly what was there.
- Things the new dataset doesn't have (e.g. Space Age items when switching to base) are dropped from the view with a notice; they aren't deleted from the other dataset's state.
- Features that depend on DLC (planets, quality) hide when the dataset doesn't include them, based on `game.yml`.

## Steps

1. Import the base game.
2. Version select and dataset switching.
3. Hide DLC-only features per dataset.

## Done when

- Switching from Space Age to base and back restores both calculations.
- Base game shows no planet or quality controls.
- The second switch to a dataset loads from the browser cache (no network request for the database).
