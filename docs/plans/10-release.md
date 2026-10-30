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

- Lighthouse on the live site: Performance, Accessibility, Best Practices ≥ 95.
- With the network off, a second visit loads and calculates.
- No axe violations on the main screen and settings window.
- Licensing and credits are settled and shown on the site.
