import { expect, test } from 'vitest'
import { defaultDataset } from './GameProvider.tsx'

const dataset = (id: string, version: string) => ({ id, name: id, version, file: `${id}.sqlite` })

test('new visitors get the newest Space Age', () => {
  const datasets = [dataset('base-2.1.24', '2.1.24'), dataset('space-age-2.1.9', '2.1.9'), dataset('space-age-2.1.24', '2.1.24'), dataset('base-2.2.0', '2.2.0')]
  expect(defaultDataset(datasets)?.id).toBe('space-age-2.1.24')
  expect(defaultDataset([dataset('base-2.1.9', '2.1.9'), dataset('base-2.1.10', '2.1.10')])?.id).toBe('base-2.1.10')
  expect(defaultDataset([])).toBeUndefined()
})
