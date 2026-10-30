# 03 UI kit

## Goal

Build the set of Factorio-styled components that every screen is made from, with a gallery page showing them all, so later stages only assemble screens.

## Scope

In:
- Themed components in `src/ui/`, one folder each.
- The item picker, which is the most complex and most used component.
- A gallery page for checking looks, states and smoothness.
- Rules for motion and performance, written into `docs/ui.md`.

Out:
- Calculator screens (05).

## Design

**Look.** Match the in-game menus: dark grey window frames with a light top edge and dark bottom edge, inset darker panels for content, square slots for icons, the grey/green/red/orange button styles with a pressed state that shifts down, and Titillium Web with the game's bold headings. Collect reference screenshots of the game's menus in `docs/ui/` first and compare against them.

**Built with CSS, not game sprites.** Borders, bevels and gradients are drawn with CSS (`box-shadow`, gradients) using tokens from `src/theme/`. This stays sharp at any zoom, needs no extra assets and keeps us from shipping more of Wube's art.

**Components:**

| Component | Notes |
|---|---|
| `Window` | Frame with title bar and optional close/action buttons. |
| `Panel` | Inset content area. |
| `Button`, `IconButton` | Default, confirm (green), danger (red), selected (orange). |
| `Slot` | Icon with an amount in the corner (the game's outlined number style) and an optional quality badge. |
| `Tooltip` | Game-style tooltip with a title bar; follows the pointer; no layout shift. |
| `Select`, `Tabs`, `Checkbox`, `Radio`, `NumberInput`, `TextInput` | Game-style form controls. |
| `ScrollPane` | Game-style scrollbars. |
| `ItemPicker` | Group tabs with large icons, a grid of slots by subgroup, search as you type, keyboard navigation. Same layout as the game's item/signal picker. |
| `Icon` | Draws one icon from the atlas by id. |

**Smooth by default:**
- Animate only `transform` and `opacity`; standard durations and easings are theme tokens.
- No layout shift: fixed slot sizes, reserved space for loading content.
- Inputs respond on the next frame; heavy work goes to a worker (04).
- Long grids are virtualised if they can't keep 60 fps.
- `prefers-reduced-motion` turns animations off.

**Accessible:** everything usable by keyboard, visible focus styled to match the game, ARIA roles on custom controls.

**Gallery:** `#/gallery`, available in dev builds only. Shows every component in every state.

## Steps

1. Collect reference screenshots; extend theme tokens (colours, bevels, spacing, motion).
2. Build the simple components, then `Slot`, `Tooltip` and `ItemPicker`.
3. Build the gallery.
4. Write `docs/ui.md` with the look and motion rules.
5. Component tests for behaviour (keyboard, focus, search) with Vitest.

## Done when

- The gallery shows every component and state; side by side with the reference screenshots they look like the game.
- The item picker opens, searches and switches tabs across the full Space Age item list with no dropped frames (Chrome performance panel, 4× CPU slowdown).
- Everything in the gallery works by keyboard only.
- `./run test` passes.

## Open questions

- Component tests need a DOM library (`@testing-library/react` + `jsdom`, dev dependencies). OK to add?
