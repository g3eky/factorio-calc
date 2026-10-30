# 00 Repo setup

## Goal

Set up the repo so that `./run dev` serves an empty themed page that loads a SQLite database built from `data/`, and every push to `main` deploys the static site to GitHub Pages.

## Scope

In:
- Tooling, folder structure, build and deploy pipeline.
- A minimal YAML → SQLite step, proved end to end with a tiny placeholder dataset.
- An empty app shell that loads the database in the browser and shows a count of rows, to prove the pipeline.

Out (later stages):
- The real game data and its full schema.
- The calculator, solver and UI components.
- The version select (the shell hard-codes the one dataset).

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Runtime | Node.js 24 LTS | Runs `.ts` scripts directly (built-in type stripping), so no extra TS runner is needed. |
| Package manager | npm | Ships with Node; nothing extra to install. |
| Task runner | `./run` (bash) | One entry point at the top level; each command is its own script in `scripts/`. No npm scripts. |
| Language | TypeScript | Types for the database rows and calculator maths catch mistakes early. |
| UI | React 19 | Requested. |
| Build tool | Vite | Fast dev server, compiles React/TS to static files, built-in CSS Modules. |
| Styling | CSS Modules + CSS custom properties | No extra library. Theme colours, borders and spacing live in one tokens file as variables. |
| Font | Titillium Web (self-hosted, SIL Open Font License) | The font Factorio's UI uses. Self-hosted so the site makes no third-party requests. |
| YAML parsing | `yaml` (npm) | Well-maintained YAML 1.2 parser with good error locations. |
| SQLite (build and browser) | `sql.js` | SQLite compiled to WebAssembly. Using the same library to write the database at build time and read it in the browser avoids format or version mismatches. |
| Tests | Vitest | Uses the Vite config; no separate setup. |
| Hosting | GitHub Pages, deployed by GitHub Actions | Free static hosting; deploys on push to `main`. |

## Folder structure

```
run                     the only entry point: ./run <command>
package.json            dependencies only
package-lock.json
.gitignore
.github/workflows/
  deploy.yml            build and deploy to GitHub Pages on push to main
data/
  space-age/
    2.0/                one folder per game and version (exact patch version chosen in the data stage)
      game.yml          name, version, which DLC/mods it covers
      items.yml         one file per kind of thing (items, recipes, machines, ...)
docs/
  plans/
scripts/
  setup.sh dev.sh build.sh preview.sh db.sh test.sh   one per ./run command
  build-db.ts           reads data/<game>/<version>/*.yml, returns SQLite bytes; also runnable from the CLI
  vite-plugin-db.ts     serves the databases in dev, emits them into dist/db/ in build
  vite.config.ts        Vite + Vitest config (passed with --config)
  tsconfig.json         types for the scripts
src/
  index.html
  tsconfig.json         types for the app
  app/                  entry point (main.tsx), App shell
  db/                   loads sql.js and a database, runs queries
  theme/                tokens.css, fonts, global styles
  settings/             typed read/write of preferences in localStorage
```

`node_modules/` also sits at the top level (git-ignored). It can't move: Node finds packages by walking up from each file, and the top level is the only folder above both `src/` and `scripts/`. That's also why `package.json` and the lockfile stay there.

Later stages add areas under `src/` (for example `ui/` for themed parts and `calculator/`) as they're needed.

## How the data pipeline works

1. `scripts/build-db.ts` finds every `data/<game>/<version>/` folder, parses its YAML, validates it, and writes the rows into a new sql.js database. It returns the bytes.
2. `scripts/vite-plugin-db.ts` calls it:
   - **Dev:** serves `/db/manifest.json` and `/db/<game>-<version>.sqlite` from memory, and rebuilds when a file in `data/` changes.
   - **Build:** emits `dist/db/<game>-<version>.<hash>.sqlite` and `dist/db/manifest.json`. The manifest lists each dataset's id, display name and hashed file name.
3. In the browser, `src/db/` fetches the manifest, downloads the chosen database, and opens it with sql.js. The sql.js `.wasm` file is bundled by Vite as a static asset.
4. `./run db` runs `build-db.ts` on its own and writes the databases to `dist/db/`, so they can be inspected with the `sqlite3` CLI.

YAML errors fail the build with the file name and line number.

## Storage

- `localStorage` holds user preferences under one versioned key (for example `factorio-calc:v1`), read and written only through `src/settings/`.
- If the stored value is missing, unreadable, or from an older version, fall back to defaults instead of crashing.

## GitHub Pages

- The site is served from `https://<user>.github.io/factorio-calc/`, so Vite's `base` is `/factorio-calc/`. All asset and database URLs must be built from `import.meta.env.BASE_URL`.
- No client-side router for now. If one is added later, it must use hash URLs, since Pages can't rewrite paths to `index.html`.
- One-time repo setting: **Settings → Pages → Source: GitHub Actions**.
- `deploy.yml`: checkout → set up Node 24 with npm cache → `./run setup` → `./run test` → `./run build` → `actions/upload-pages-artifact` (from `dist/`) → `actions/deploy-pages`.

## Commands

`./run <command> [args]` runs `scripts/<command>.sh` with the remaining args. `./run` or `./run help` lists the commands with a one-line description each, taken from a comment at the top of each script. An unknown command prints the list and exits non-zero.

| Command | Does |
|---|---|
| `./run setup` | `npm ci`: installs dependencies from the lockfile. |
| `./run dev` | Vite dev server with the database plugin. |
| `./run build` | Type-checks `src/` and `scripts/` (`tsc --noEmit -p`), then `vite build` to `dist/`. |
| `./run preview` | Serves `dist/` locally, under the same `/factorio-calc/` base as Pages. |
| `./run db` | Builds only the databases into `dist/db/`. |
| `./run test` | Runs Vitest once. |

Each script starts with `set -euo pipefail` and `cd`s to the repo root, so commands work from any folder.

## Steps

1. Add `.gitignore` (`node_modules/`, `dist/`, `.DS_Store`, editor swap files).
2. Write `run` and `scripts/setup.sh`. `npm init`; add React, Vite, TypeScript, `yaml`, `sql.js`, Vitest. Add `src/tsconfig.json`, `scripts/tsconfig.json` and `scripts/vite.config.ts` (`root` = `src/`, `build.outDir` = `dist/`, `base: '/factorio-calc/'`; paths resolved from the config file, not the working directory).
3. Write the remaining `scripts/*.sh` commands.
4. Add the theme tokens and self-hosted Titillium Web in `src/theme/`.
5. Add a placeholder dataset in `data/space-age/2.0/` (a `game.yml` and a few items).
6. Write `scripts/build-db.ts` and `scripts/vite-plugin-db.ts`, with a Vitest test that builds the placeholder data and queries the result.
7. Write `src/db/` and an App shell that loads the database and shows "N items loaded" in a themed panel.
8. Write `src/settings/` with a test for the fall-back-to-defaults behaviour.
9. Add `.github/workflows/deploy.yml`; enable Pages from Actions in the repo settings.

## Done when

- The top level contains only `run`, `AGENTS.md`, `README.md`, `package.json`, `package-lock.json`, `.gitignore`, and the folders `.github/`, `data/`, `docs/`, `scripts/`, `src/` (plus git-ignored `node_modules/` and `dist/`).
- `./run help` lists every command; `./run nope` prints the list and exits non-zero.
- `./run test` passes.
- `./run build` succeeds and `dist/` contains `index.html`, the bundled JS/CSS, the sql.js `.wasm`, `db/manifest.json` and one hashed `.sqlite` file.
- `./run preview` shows the themed panel with the correct item count, with no console errors.
- Editing a YAML file while `./run dev` is running updates the count after a reload.
- A push to `main` deploys, and the live Pages URL shows the same panel.
