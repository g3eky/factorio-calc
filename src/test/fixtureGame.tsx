// A Game built from the test fixture, for component tests. No icon atlas, so icons show
// their initials.

import { join } from 'node:path'
import type { ReactNode } from 'react'
import { readDataset } from '../../scripts/build-db.ts'
import { createGame, GameProvider, type Game } from '../db/GameProvider.tsx'

// Tests run from the repo root (jsdom's import.meta.url isn't a file URL).
const FIXTURE = join(process.cwd(), 'scripts/fixtures/basic')

export async function fixtureGame(): Promise<Game> {
  const data = await readDataset(FIXTURE)
  return createGame({ id: 'fixture-0', name: 'Fixture', version: '0', file: 'fixture.sqlite' }, data)
}

export const withGame = (game: Game) => ({ children }: { children: ReactNode }) => <GameProvider game={game}>{children}</GameProvider>
