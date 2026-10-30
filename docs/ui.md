# UI

The site should feel like Factorio's own menus, and every interaction should be smooth. Components live in `src/ui/`, one folder each; `#/gallery` (dev builds only) shows them all in every state.

## Look

Theme tokens are in `src/theme/tokens.css`; use them instead of raw values.

| Element | Look |
|---|---|
| Window | Grey frame (`--color-frame`) with a light top edge and dark bottom edge, bold cream title (`--color-heading`), striped drag-handle filler in the title bar. |
| Panel | Inset area inside a window. `deep` is the darker well behind slot grids. |
| Button | Light-to-dark grey gradient, black bold text. Hover turns orange; pressed shifts down 1 px. Green to confirm, red for destructive actions, solid orange when selected. |
| Slot | Dark square (40 px) with a 32 px icon, white outlined amount in the bottom-right, quality diamond in the bottom-left. Orange ring on hover and focus; solid orange when selected. |
| Tooltip | Dark translucent box with a lighter title bar in cream text. Follows the pointer. |
| Text and number fields | Light grey with black text; orange ring when focused, red when invalid. |
| Tabs | Dark tabs; the selected one joins the panel below. Large 64 px icon tabs for item groups. |
| Scrollbars | Grey thumb on a dark track; orange on hover. |

Font: Titillium Web, self-hosted (`src/theme/fonts/`, SIL Open Font License).

Icons come from the dataset's atlas through `<Icon kind id />`. Recipes without their own icon show their main product; anything without an icon shows its initials.

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
