# 13 Crafting tree

## Goal

See the production chain as a flow diagram: a box per production row, arrows for the items that move between them with their rates, laid out from your targets on the left to raw resources on the right.

## Scope

In:
- Production gets two tabs, **Table** (as now) and **Tree**. Both show the same result and settings. The last one shown is remembered (`factorio-calc:v1:production-view`), and **T** switches between them (as **/** jumps to the Catalog's search; both listed in About, and ignored while typing or in a dialog).
- Tree: a box per production row (recipe icon and name, machine and count), a box per raw resource and import, and an arrow per item from each row that makes it to each row that uses it, labelled with its rate. Fluids drawn in the fluid colour. Your targets are marked.
- Clicking a box selects that row and opens the same Needed by / Needs panel as the table. Following a link in the panel selects that box and scrolls to it.
- An endless canvas: drag anywhere to pan, with no stop at the diagram's edges; the mouse wheel zooms around the pointer (20% to 200%), a sideways swipe pans. The graph paper moves with it. Buttons zoom out, in, to fit (centred), and back to 100%. Following a panel link or tabbing to a box off screen pans to it.
- **Find in tree:** a search box in the toolbar rings every box whose name matches, and brings the first into view; Enter and Shift+Enter step through them ("2 of 3"), Esc clears it.
- An icon button makes the tree and its panel fill the browser tab (not the browser's full screen), over the rest of the page; the button or Esc puts it back.
- Production fills the space left on the sheet and its table, tree and panel scroll inside it, so the page itself doesn't scroll on desktop. On phones the table and tree get a scroll area of 75% of the screen. Saved lists scroll on their own after about five.

Out:
- Editing machines, modules or recipes from the tree (use the table, or the panel's links).
- Dragging boxes, or saving a layout.

## Decisions

- **Layout by [elkjs](https://github.com/kieler/elkjs)** (decided): the Eclipse Layout Kernel's layered layout, Eclipse Public License 2.0. It runs in its own Web Worker (`elk-worker.min.js`, loaded as a separate file), so laying out never blocks the page, and it's only downloaded when the Tree tab is first opened. The service worker caches it with the rest of the site, so the tree works offline.
- **Shared items appear once.** When several rows make an item and several use it, each arrow carries a share in proportion: maker's output × user's input ÷ everything made.
- **Boxes are HTML, arrows are SVG.** Boxes reuse the icon and tooltip parts; ELK only gets their sizes. Arrows are drawn from ELK's routes with an arrowhead.
- While a new layout is worked out, the last one stays on screen (dimmed), as the table keeps its last result.
- Narrow screens: the Needed by / Needs panel goes below the diagram instead of beside it.

## Steps

1. Add elkjs. Build the graph from a result (pure, tested).
2. Lay it out in the ELK worker, latest request wins.
3. Draw it: boxes, arrows, rate labels, target marks, zoom.
4. Table / Tree tabs; selection and the panel shared with the table.
5. Check: tests, build, axe, layout of a large chain (all science packs) under one frame of main-thread work.

## Done when

- `./run test` passes, with tests for the graph: every row and raw resource is a box, and each item's arrows add up to what's used. ✔ 61 tests (3 new in `src/planner/flowGraph.test.ts`).
- The tree for red, green and military science matches the table: same rows, same machine counts. ✔ 20 row boxes, 4 raw resources, 31 arrows.
- Clicking a box opens the panel; the panel's links move the selection in the tree. ✔ Beside the tree on wide screens, below it when the card is under 1000 px.
- No main-thread task over 50 ms while laying out the all-science chain. ✔ Six science packs on Nauvis (44 rows, 97 arrows): no long tasks, also at 4× CPU slowdown; about 0.5 s in the worker. Clicking a box and opening the panel took one 108 ms task at 4× (about 27 ms at full speed).
- No axe violations in light or dark. ✔ After darkening the machine count in a selected box, and making the panel's headings level 3 (they skipped from 2 to 4).
