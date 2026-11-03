// Packs icons into one WebP sprite atlas, so the site loads one small image instead of hundreds.

import sharp from 'sharp'

export interface AtlasIndex {
  size: number
  width: number
  height: number
  // Icon key ("item/iron-plate") -> [x, y] in pixels.
  icons: Record<string, [number, number]>
}

// Space around each icon, filled with copies of its own edge pixels. A browser shrinking an icon
// (64 px down to 14 px) blends pixels from just outside it; without this they'd be the neighbouring
// icons, drawn as thin lines along the edges.
const GUTTER = 8

export async function packAtlas(icons: Map<string, Buffer>, size: number): Promise<{ image: Buffer; index: AtlasIndex }> {
  const keys = [...icons.keys()].sort()
  const columns = Math.ceil(Math.sqrt(keys.length))
  const rows = Math.max(Math.ceil(keys.length / columns), 1)
  const cell = size + 2 * GUTTER
  const index: AtlasIndex = { size, width: columns * cell, height: rows * cell, icons: {} }

  const tiles = await Promise.all(
    keys.map(async (key, i) => {
      const x = (i % columns) * cell
      const y = Math.floor(i / columns) * cell
      index.icons[key] = [x + GUTTER, y + GUTTER]
      const input = await sharp(icons.get(key)!)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: GUTTER, bottom: GUTTER, left: GUTTER, right: GUTTER, extendWith: 'copy' })
        .png()
        .toBuffer()
      return { input, left: x, top: y }
    }),
  )
  const image = await sharp({ create: { width: index.width, height: index.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(tiles)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 })
    .toBuffer()
  return { image, index }
}
