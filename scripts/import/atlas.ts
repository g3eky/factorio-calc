// Packs icons into one WebP sprite atlas, so the site loads one small image instead of hundreds.

import sharp from 'sharp'

export interface AtlasIndex {
  size: number
  width: number
  height: number
  // Icon key ("item/iron-plate") -> [x, y] in pixels.
  icons: Record<string, [number, number]>
}

export async function packAtlas(icons: Map<string, Buffer>, size: number): Promise<{ image: Buffer; index: AtlasIndex }> {
  const keys = [...icons.keys()].sort()
  const columns = Math.ceil(Math.sqrt(keys.length))
  const rows = Math.max(Math.ceil(keys.length / columns), 1)
  const index: AtlasIndex = { size, width: columns * size, height: rows * size, icons: {} }

  const tiles = await Promise.all(
    keys.map(async (key, i) => {
      const x = (i % columns) * size
      const y = Math.floor(i / columns) * size
      index.icons[key] = [x, y]
      const input = await sharp(icons.get(key)!)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
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
