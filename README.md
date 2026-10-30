# Factorio calculator

A production calculator for Factorio, styled like the game's menus. Pick a game version, pick what you want to make, and see the machines, inputs and rates needed.

It's a static website hosted on GitHub Pages. Everything runs in your browser: the game data is downloaded as a SQLite database, and your preferences are saved in your browser's local storage. Nothing is sent to a server.

> Work in progress. The first target is a single version of Factorio: Space Age; base game and other versions come later.

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

Factorio is a game by [Wube Software](https://factorio.com). This is an unofficial fan project and is not affiliated with Wube.
