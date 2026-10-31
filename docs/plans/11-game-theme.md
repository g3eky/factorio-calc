# 11 Game theme

## Goal

Make the UI look like Factorio's own menus: the same frames, buttons, slots, tabs, fields, scrollbars, tooltips, fonts and colours, at the same sizes. Stage 03 approximated the look from memory; this stage takes every value from the game's own definitions and checks the result against screenshots of the game. Also add an Interface settings screen with a UI scale, like the game's.

## Scope

In:
- Every component in `src/ui/`, and the screens built from them (planner, settings, item picker, popovers).
- Fonts, colours, sizes, paddings and spacing taken from the game's style definitions.
- Hover, pressed, selected and disabled states, including the game's hover glow and 1 px pressed offset.
- A compare view in the dev gallery, next to the reference screenshots.
- An Interface settings screen with UI scale.

Out:
- The game's GUI sprite sheet: everything is drawn with CSS (decided, see Decisions).
- Sounds (the game clicks on buttons).
- New features or layout changes beyond what matching the game needs.

## Decisions

- **CSS, not the game's sprites.** Frames, bevels, textures and glows are drawn with CSS, using the exact sizes and colours from `style.lua` and colours sampled from the reference screenshots. No more of Wube's art is shipped. The result is a close match, not pixel-identical; the user signs off on each component.
- **Reference screenshots** live in `screenshots/` at the top level, git-ignored (they're Wube's art and about 28 MB).
- **UI scale** is a setting on a new Interface settings screen.

## Sources

**`core/prototypes/style.lua`** in wube/factorio-data (already downloaded by `./run import`) defines every GUI style the game uses (about 10,000 lines). For each style it gives:
- Font, font colour per state (`default_font_color = {1, 1, 1}`, headings `{255, 230, 192}`, buttons black, disabled `{179, 179, 179}`), and the font sizes in `fonts.lua` (`default` is 14 px).
- Sizes and spacing: e.g. a button's `minimal_width = 108`, `minimal_height = 28`, 8 px side padding; paddings and spacing between children for frames and flows.
- Behaviour: `clicked_vertical_offset = 1` (content moves down 1 px when pressed).
- Which sprite each state uses (`base = {position = {0, 17}, corner_size = 8}` …): not used for drawing, but it tells which states look different and how wide their borders are (`corner_size`).

**Reference screenshots** in `screenshots/`, taken on a Retina screen (2 screenshot pixels per game pixel at 100% UI scale):

| # | Screen | Use it for |
|---|---|---|
| 2, 3 | Main menu (3: Single player hovered) | Buttons: default, hovered, green confirm, red exit; window frame and title |
| 4, 5 | Quickbar (5: a slot hovered) | Slots: empty, hovered |
| 6 | Character and crafting windows | Windows side by side, inventory grid, item group tabs, title bar buttons |
| 7 | Crafting with a recipe tooltip | Tooltip: title bars, sections, ingredients list |
| 8 | Crafting, hovering a group tab | Large tabs: hovered, selected; small tooltip |
| 9 | Production statistics | Tabs, small buttons, inside frames, deep panels |
| 10, 11 | Factoriopedia (11: with a tooltip) | Item grid by subgroup (our item picker), search button, tooltip |
| 12 | Achievements | Scroll pane and scrollbar, list rows |
| 13–15 | Tips and tricks | List with a selected row, headings, panels, buttons |
| 16, 17 | Alerts configuration (17: close hovered) | Table headers, rows, checkboxes, close button |
| 18 | Game menu | Large buttons: green, default, red |
| 19 | Interface settings | Checkboxes, sliders, dropdowns, text fields, Back/Confirm buttons; the model for our Interface settings screen |

Screenshot 1 (27 Oct, 5120 × 2880) is a desktop screenshot, not of Factorio; it isn't used.

## Design

**Generated from the game, not hand-tuned.** A new import step reads `data.raw["gui-style"]` from the data dump (the Lua runner already produces it) and writes `src/theme/game.css`: custom properties and one rule set per game style we use (`button`, `green_button`, `red_button`, `slot_button`, `frame`, `inside_shallow_frame`, `inside_deep_frame`, `frame_title`, `draggable_space`, `tab`, `textbox`, `dropdown`, `checkbox`, `radiobutton`, `slider`, `scroll_pane`, `tooltip`, …) with exact sizes, paddings, font sizes and font colours per state. Components use these instead of today's hand-written values. Re-importing a new game version updates them.

**Drawn with CSS.** What `style.lua` can't give (the look of the sprites) is drawn with borders, gradients, inset shadows and glows. The colours for each are sampled from the reference screenshots and kept as named tokens in `src/theme/tokens.css` (frame edge light and dark, button face top and bottom, slot well, hover glow, …), with a comment naming the screenshot they came from.

**Fonts.** The game's `default` font is Titillium Web at 14 px, with semibold and bold for buttons and headings; switch from today's 15 px and match each style's font from `fonts.lua`.

**UI scale.** A new **Interface** screen in the settings window, laid out like the game's interface settings (screenshot 19), starting with UI scale: 75% to 200% in the game's steps, default 100%. It scales the whole page with CSS `zoom` on the root, so every size from `style.lua` stays in game pixels. It's an interface preference, so it's stored once for the site (`factorio-calc:v1:interface`), not per game version, and applied before the first paint to avoid a jump.

**Compare view.** The dev gallery gets a compare view: each component next to a crop of the matching reference screenshot, scaled to 1 game pixel = 1 CSS pixel, with a toggle to overlay it at 50%. Crops are defined in the gallery as (screenshot, rectangle) pairs, loaded from `screenshots/` by the dev server only; nothing from that folder is built or shipped.

**Keep what works.** Motion rules, keyboard behaviour, accessibility and performance from 03, 05 and 10 stay. Where the game's look conflicts with accessibility (contrast of disabled or muted text, focus visibility), keep the accessible version and note it in `docs/ui.md`.

## Steps

1. Add `gui-style` to the importer: generate `src/theme/game.css` from `style.lua`, with a test that checks known values (button at least 108 × 28 with 8 px side padding, heading colour, 14 px default font, 1 px pressed offset).
2. Sample colours from the screenshots into named tokens.
3. Compare view in the gallery, serving crops of `screenshots/` in dev only.
4. Retheme components one by one, comparing each with its screenshot: window and title bar, panels, buttons, slots, large tabs and tabs, text fields, dropdown, checkbox and radio, scrollbars, tooltip, item picker (against Factoriopedia), popover and modal.
5. Interface settings screen with UI scale (and a slider component, styled from screenshot 19).
6. Re-check the screens: planner, settings, popovers, phone layout, each UI scale.
7. Re-run axe, the interaction timing probe and Lighthouse; update `docs/ui.md`.

## Done when

- `src/theme/game.css` is generated from the game's `style.lua`, and its test passes.
- Every component's size, padding, font and font colours equal the `style.lua` values (checked by the test and in the browser's computed styles).
- In the compare view, each component is a close match to its screenshot, and the user signs off on it.
- UI scale works from 75% to 200%: everything scales together, nothing overlaps, it's remembered, and the page doesn't jump on load.
- No regressions: `./run test` passes, no axe violations, no long tasks over 50 ms in the timing probe, layout shift still under 0.01.
