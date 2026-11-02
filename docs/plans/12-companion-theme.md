# 12 Companion theme

## Goal

Replace the game-menu look (stage 11) with the theme of the factorio-companion app (`../factorio-companion/src/frontend/src/styles/`): a flat, editorial industrial look, light by default with a dark variant and a toggle.

## Scope

In:
- Its tokens (palette, shadows, graph-paper background), fonts and component styles, applied to every component in `src/ui/` and every screen.
- A theme toggle: System, Light, Dark. In the header and in Settings → Interface; saved for the site and applied before the first paint.
- The item picker in the companion's rail layout: category filter pills (with "All"), then every item under a heading per category, in one scrolling list.

Out:
- The companion's layout and features (index view, chain tree): only the look comes across.

## Decisions

- **Replaces the game look** (decided). The game theme generator (`scripts/import/theme.ts`, `src/theme/game.css`), the compare view and the reference screenshot plugin are removed. AGENTS.md and `docs/ui.md` describe the new look. `screenshots/` stays git-ignored, since the folder is still there locally.
- **Fonts self-hosted** (decided): Saira Condensed (500, 600, 700) for display text, IBM Plex Sans (400, 500, 600) for body text, IBM Plex Mono (400, 500, 600) for numbers. All SIL Open Font License. The companion loads them from Google Fonts at runtime; this site makes no requests to other servers. They replace Titillium Web.
- **Same token names as the companion** (`--bg`, `--panel`, `--panel-sunken`, `--line`, `--line-strong`, `--ink`, `--ink-dim`, `--ink-faint`, `--accent`, `--accent-ink`, `--accent-soft`, `--fluid`, `--shadow`, `--graph-paper`, `--font-display`, `--font-body`, `--font-mono`), so its styles carry over unchanged. Its rule stays: no colour literal outside `tokens.css`. Dark is defined behind `prefers-color-scheme` and behind `[data-theme="dark"]`, so the toggle wins either way.
- Spacing, layers, motion and UI scale tokens stay from 11 and 05.

## Mapping

| Ours | Companion style |
|---|---|
| Window | Card (`.chain`, `.tile`: panel, line border, 4 px radius, shadow) with a `.section` heading: condensed uppercase, a rule line after it |
| Panel / deep | `.tile` / sunken panel (`.options`) |
| Button | `.ghost-button`; confirm and selected are filled accent (`.pill[aria-pressed]`); remove is `.remove` |
| Slot | `.cell`: transparent, panel and line on hover, accent border and soft accent when selected |
| Tabs | `.views` segmented control |
| Item picker | `.rail`: `.pill` filters, `.group-head` headings, `.grid-row` of cells |
| Text and number fields, drop-downs | Sunken panel, strong line, 3 px radius; numbers in mono |
| Tooltip, popover, modal | Card with shadow |
| Results table | `.chain` rows: line between rows, sunken on hover, rates in mono accent |
| Totals | `.tiles`: condensed uppercase label, big mono number |
| Header | Panel with a line under it, uppercase condensed brand, the belt-hazard stripe |
| Main area | Graph-paper background (`.sheet`) |

## Steps

1. Self-host the fonts.
2. Tokens, global styles, light/dark and the toggle.
3. Restyle components, then screens.
4. Item picker in the rail layout.
5. Remove the game theme pieces; update AGENTS.md, `docs/ui.md`, README screenshot.
6. Check: tests, build, axe in both themes, timing probe, Lighthouse.

## Done when

- Every screen uses only the companion tokens; no colour literal outside `tokens.css`. ✔ (Tokens added beyond the companion's: `--danger`, `--backdrop`, icon count colours and the quality tier colours.)
- The toggle switches System, Light and Dark instantly, is remembered, and doesn't flash the other theme on load. ✔ `index.html` applies the saved theme before the first paint.
- No axe violations in light or dark. ✔ After raising `--ink-faint` (light `#69655f`, dark `#918b81`): the companion's values were 4.1:1 and 4.5:1 on sunken panels.
- `./run test` passes (57 tests). ✔
- No long tasks over 50 ms while typing. ✔ Main-thread tasks stay under 40 ms at 4× CPU slowdown. The "time to next frame" probe from earlier stages can't be used now: headless Chrome on this machine produces about 10 frames a second on every page, even a blank one.
- Layout shift under 0.01. ✔ Lighthouse desktop: 97 / 100 / 100 / 100, layout shift 0.

## Differences from the companion

- `--ink-faint` is a little darker (light) and lighter (dark), for 4.5:1 contrast.
- The picker's rows don't use `content-visibility: auto`: wrapping rows made the list shift on load.
- The fonts are self-hosted instead of loaded from Google Fonts.
