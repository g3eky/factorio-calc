# 10 Release

## Goal

Make the site fast to load, work offline after the first visit, and ready to share publicly.

## Scope

In:
- Offline support and caching.
- Load performance and bundle size.
- Error handling for a failed download or unsupported browser.
- Accessibility and cross-browser checks.
- Public-facing polish: favicon, page title and description, link preview image, README screenshot.

Out:
- New calculator features.

## Design

- **Offline:** a small service worker caches the app shell, the current dataset's database and icons. New deploys are picked up on the next visit, with a "new version available" notice instead of a surprise reload.
- **Load budget:** first screen visible in under 1 s on a fast connection; app JS under 200 KB gzipped, not counting sql.js and the solver's WebAssembly, which load in parallel with the database.
- **Errors:** if the database or WebAssembly can't load, show a game-style error window with a retry button.

## Steps

1. Service worker and update notice.
2. Measure and trim the bundle; lazy-load what the first screen doesn't need.
3. Error states.
4. Accessibility pass with axe and keyboard-only use.
5. Test on Chrome, Firefox and Safari, desktop and phone.
6. Public polish; check the licensing question from 02 is resolved.

## Done when

- Lighthouse: Accessibility, Best Practices and SEO 100. Performance 91 on desktop and 74 on simulated slow-4G mobile. ✘ for the ≥ 95 performance target, and measured on the local preview server, not the live site (not deployed yet). Total blocking time 0 ms, layout shift 0.002. On mobile the remaining time is downloading 315 KB of JavaScript and the 685 KB SQLite WebAssembly, which the local preview server sends uncompressed; GitHub Pages compresses JavaScript, so the live numbers should be better. Re-measure after deploying.
- With the network off, a second visit loads and calculates. ✔ Checked in Chrome over the DevTools protocol.
- No axe violations on the main screen and settings window. ✔ (axe-core injected into the production build.)
- Licensing and credits are settled and shown on the site. ✔ The About window credits Wube, factorio-data, the wiki (CC BY-NC-SA 3.0 text), Titillium Web, HiGHS and sql.js; the README too. The icons remain Wube's art, used knowingly (see 02).

## What changed

- **Offline:** a service worker (`src/sw/sw.js`, built by `scripts/vite-plugin-sw.ts`) caches the app shell at install, and the page tells it which game data it loaded. Hashed files are cache-first; `index.html` and the database manifest are network-first. A notice offers to reload when a new version is deployed.
- **Smaller downloads:** databases ship gzipped (Space Age 688 KB → 157 KB) and are unpacked in the browser with `DecompressionStream`, only if the server didn't already. The default database and SQLite are preloaded from `index.html`.
- **No layout shift on load:** `index.html` paints the header immediately, and the app shows the planner's layout while loading.
- **Errors:** if the data can't load, the planner layout shows a game-style message with a retry button.
- **Accessibility:** drop-downs are named by their label and value; windows are named regions; slot and module button names include what they show; muted text contrast raised to 4.5:1.
- **Polish:** favicon, description and link preview metadata, `preview.png`, README screenshot, About window.

## Not done

- Firefox and Safari: only Chrome was tested (headless, over the DevTools protocol).
- Lighthouse on the live site, after the first deploy.
