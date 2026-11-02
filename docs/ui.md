# UI

The site should feel like Factorio's own menus, and every interaction should be smooth. Components live in `src/ui/`, one folder each; `#/gallery` (dev builds only) shows them all in every state.

## Look

The theme comes from the factorio-companion app (see `docs/plans/12-companion-theme.md`): a flat, editorial, industrial look.

- **Tokens:** every colour, shadow and font is a token in `src/theme/tokens.css`, with the companion's names (`--bg`, `--panel`, `--panel-sunken`, `--line`, `--line-strong`, `--ink`, `--ink-dim`, `--ink-faint`, `--accent`, `--accent-ink`, `--accent-soft`, …). No colour literal outside that file.
- **Light and dark:** light is the base. Dark is defined behind `prefers-color-scheme` and behind `[data-theme="dark"]`, so the System/Light/Dark setting (header button, Settings → Interface) wins either way. `index.html` applies the saved choice before the first paint.
- **Fonts** (self-hosted, SIL Open Font License, `src/theme/fonts/`): Saira Condensed for headings, labels and buttons (uppercase, letter-spaced); IBM Plex Sans for text; IBM Plex Mono for numbers.

| Element | Look |
|---|---|
| Window | Card: panel colour, thin line, 4 px radius, soft shadow; heading in condensed uppercase with a rule line after it. |
| Panel | A tile inside a card; `deep` is the sunken variant. |
| Button | Ghost button: condensed uppercase, strong line, accent on hover. Confirm and selected are filled with the accent; danger is a quiet ✕ that turns accent. |
| Slot | A cell: transparent until hovered, then panel colour with a line; selected has an accent border and soft accent fill. Counts in mono, white with a dark outline. |
| Tabs | A segmented control; `large` tabs are filter pills. |
| Item picker | The companion's rail: a pill per category plus "All" (the default), then every item under a heading per category. |
| Fields and drop-downs | Sunken panel, strong line, 3 px radius; numbers in mono, right-aligned. |
| Tooltip, popover, modal | Cards with a shadow. |
| Results table | One card; rows split by lines, sunken on hover; rates and power in mono accent. |
| Totals | Tiles: small condensed uppercase label, large mono number. |
| Header | Panel with a line under it, the belt-hazard stripe, uppercase brand. |
| Main area | Graph-paper background. |

Icons come from the dataset's atlas through `<Icon kind id />`. Recipes without their own icon show their main product; anything without an icon shows its initials.

**Spacing** is 4 px between items in a row or column, 8 px between groups, 12 px inside tiles, as in the companion.

## Motion and smoothness

- Animate only `transform` and `opacity`; durations and easing are tokens (`--duration-fast`, `--duration`, `--ease`). Colour changes on hover are instant.
- No layout shift: fixed sizes for slots, the item picker grid, and anything that loads.
- Pointer-following (tooltips) updates the DOM directly, never re-rendering React.
- Heavy work (solving) runs in a Web Worker, so input stays responsive.
- `prefers-reduced-motion` sets all durations to 0.

## Keyboard and accessibility

- Everything works by keyboard; focus shows an accent outline.
- Tabs and pills: arrow keys. Select: arrows, Home/End, Enter/Space, Escape. Item picker: type to search, Enter picks the first match, arrows move between slots, ArrowDown from search enters the list.
- Custom controls use the matching ARIA roles (`tablist`, `listbox`, `tooltip`), and icon-only buttons have labels.
