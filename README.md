# Factorio calculator

A production calculator for Factorio. Pick a game version, pick what you want to make, and see the machines, inputs and rates needed.

It's a static website hosted on GitHub Pages. Everything runs in your browser: the game data is downloaded as a SQLite database, the solver (a linear program, [HiGHS](https://highs.dev)) runs in a Web Worker, and your calculations and settings are saved in your browser's local storage. Nothing is sent to a server. After the first visit it works offline.

**What it does:** Factorio 2.1 base game and Space Age. Targets per second, minute, hour, belt or machine; machines, modules, beacons and productivity research; cycles and byproducts (oil cracking, Kovarex, recycling); per-planet production with surface conditions and imports; quality, including upcycling loops.

## Run it locally

Needs Node.js 24 and bash.

```sh
./run setup     # install dependencies
./run dev       # start the dev server
```

`./run help` lists all commands:

| Command | Does |
|---|---|
| `./run setup` | Install dependencies. |
| `./run dev` | Start the dev server; reloads on code and data changes. |
| `./run build` | Type-check and build the static site into `dist/`. |
| `./run preview` | Serve the built site locally. |
| `./run db` | Build only the SQLite databases into `dist/db/`. |
| `./run test` | Run the tests. |
| `./run import` | Re-import game data (needs [LuaJIT](https://luajit.org)); see `docs/plans/02-data-import.md`. |

The component gallery is at `#/gallery` while `./run dev` is running.

## Repo layout

| Path | Holds |
|---|---|
| `src/` | Site source code (React + TypeScript). |
| `data/` | Game data as YAML, one folder per game and version. |
| `scripts/` | The scripts behind `./run`, the YAML → SQLite build, and tool config. |
| `docs/` | Documentation. `docs/plans/` has one plan per implementation stage. |

## Contributing

Start with [`AGENTS.md`](AGENTS.md) for how the project works, then the plan for the current stage in [`docs/plans/`](docs/plans/).

## Credits

Factorio is a game by [Wube Software](https://factorio.com). This is an unofficial fan project and is not affiliated with Wube. Game data comes from Wube's [factorio-data](https://github.com/wube/factorio-data); names and icons from the [official Factorio wiki](https://wiki.factorio.com). Factorio's names and art belong to Wube Software.

## License

The code is under the [MIT License](LICENSE). Game data and icons in `data/` belong to Wube Software, and the fonts in `src/theme/fonts/` are under the SIL Open Font License.
