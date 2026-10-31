# UI

The site should feel like Factorio's own menus, and every interaction should be smooth. Components live in `src/ui/`, one folder each; `#/gallery` (dev builds only) shows them all in every state.

## Look

The look is taken from the game (see `docs/plans/11-game-theme.md`):
- **Sizes, paddings, fonts and font colours** come from the game's own GUI styles. `./run import` generates them into `src/theme/game.css` as `--game-<style>-<property>` custom properties (`--game-button-min-width: 108px`, …). Use those in components; don't hard-code what the game defines.
- **Surface colours** are sampled from screenshots of the game and kept in `src/theme/tokens.css`, each with the screenshot it came from.
- **Compare view:** `#/compare` in dev shows each component next to a crop of its screenshot (from the git-ignored `screenshots/` folder). Check it after changing a component.

| Element | Look |
|---|---|
| Window | Dark frame (`--color-frame`) with a light top edge and black outline; 18 px bold cream title; a recessed strip of fine vertical lines as the drag handle. |
| Panel | `Panel` is the lighter section panel (inside shallow frame); `deep` is the dark well behind slot grids and buttons. |
| Button | Flat grey face, light top edge, darker bottom edge, black outline; 14 px semibold black text, at least 108 × 28. Orange with a glow when hovered; moves down 1 px when pressed. Green to confirm, red for destructive actions. `shape="back"`/`"forward"` gives the dialog buttons' arrow ends and 18 px bold text. |
| Slot | Raised dark 40 px square that sits flush with its neighbours; bright orange with a glow when hovered. 13 px bold white amount with a black outline; quality diamond bottom-left. |
| Tabs | Grey buttons with bold black text; the selected tab is dark, joins the panel below and has cream text. Item group tabs are 72 px tall, six to a row. |
| Text fields | Grey recessed field, black text; glows when focused, red outline when invalid. |
| Dropdown | Grey button face with the value and a dark arrow. |
| Checkbox | Recessed grey box; orange with a dark tick when checked; glows on hover. |
| Slider | Dark groove filled orange up to a grey grip-lined thumb, with a tick per step. |
| Tooltip | Cream title bar with dark bold text over a near-black body. |
| Scrollbars | Grey thumb in a dark recessed track; orange on hover. |

Font: Titillium Web (the game's font), self-hosted (`src/theme/fonts/`, SIL Open Font License); 14 px by default.

Icons come from the dataset's atlas through `<Icon kind id />`. Recipes without their own icon show their main product; anything without an icon shows its initials.

**UI scale:** Settings → Interface. CSS `zoom` on the root, with `--ui-scale` set alongside. Anything positioned from pointer or viewport coordinates must divide by `uiZoom()` (`src/ui/zoom.ts`), and full-height layouts use `calc(100vh / var(--ui-scale, 1))`.

## Motion and smoothness

- Animate only `transform` and `opacity`; durations and easing are tokens (`--duration-fast`, `--duration`, `--ease`). Colour changes on hover are instant, as in the game.
- No layout shift: fixed sizes for slots, the item picker grid, and anything that loads.
- Pointer-following (tooltips) updates the DOM directly, never re-rendering React.
- Heavy work (solving) runs in a Web Worker, so input stays responsive.
- `prefers-reduced-motion` sets all durations to 0.

## Keyboard and accessibility

- Everything works by keyboard; focus is shown with the same orange ring as hover.
- Tabs: arrow keys. Select: arrows, Home/End, Enter/Space, Escape. Item picker: type to search, Enter picks the first match, arrows move between slots, ArrowDown from search enters the grid.
- Custom controls use the matching ARIA roles (`tablist`, `listbox`, `tooltip`), and icon-only buttons have labels.
