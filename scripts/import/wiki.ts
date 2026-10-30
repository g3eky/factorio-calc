// English names and icons from the official Factorio wiki (wiki.factorio.com).
// Responses are cached in node_modules/.cache so re-imports don't hit the wiki again.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const API = 'https://wiki.factorio.com/api.php'
const INFOBOX_NAMESPACE = 3002
const HEADERS = { 'User-Agent': 'factorio-calc data import (https://github.com/g3eky/factorio-calc)' }

export class Wiki {
  private cacheDir: string

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir
  }

  private async cached(key: string, fetcher: () => Promise<Buffer>): Promise<Buffer> {
    const path = join(this.cacheDir, createHash('sha256').update(key).digest('hex').slice(0, 16))
    const hit = await readFile(path).catch(() => undefined)
    if (hit) return hit
    const data = await fetcher()
    await mkdir(this.cacheDir, { recursive: true })
    await writeFile(path, data)
    return data
  }

  private async api(params: Record<string, string>): Promise<any> {
    const url = `${API}?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`
    const body = await this.cached(url, async () => {
      const response = await fetch(url, { headers: HEADERS })
      if (!response.ok) throw new Error(`${url}: ${response.status}`)
      return Buffer.from(await response.arrayBuffer())
    })
    return JSON.parse(body.toString('utf8'))
  }

  // Internal name -> English name, from the wiki's infobox pages ("Infobox:Iron plate" has
  // "internal-name = iron-plate").
  async names(): Promise<Map<string, string>> {
    const titles: string[] = []
    let next: Record<string, string> = {}
    do {
      const page = await this.api({ action: 'query', list: 'allpages', apnamespace: String(INFOBOX_NAMESPACE), aplimit: '500', ...next })
      titles.push(...page.query.allpages.map((p: { title: string }) => p.title))
      next = page.continue ?? {}
    } while (Object.keys(next).length)

    const names = new Map<string, string>()
    for (let i = 0; i < titles.length; i += 50) {
      const batch = await this.api({ action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: titles.slice(i, i + 50).join('|') })
      for (const page of batch.query.pages) {
        const content: string = page.revisions?.[0]?.slots?.main?.content ?? ''
        const internal = /^\|\s*internal-name\s*=\s*([a-z0-9-]+)\s*$/m.exec(content)?.[1]
        const type = /^\|\s*prototype-type\s*=\s*([a-z0-9-]+)\s*$/m.exec(content)?.[1]
        // Technologies and archived pages reuse item names ("Advanced circuit (research)").
        if (!internal || type === 'technology' || /\((research|archived)\)$/.test(page.title)) continue
        names.set(internal, page.title.replace(/^Infobox:/, ''))
      }
    }
    return names
  }

  // Downloads "File:<name>.png" for each key. Missing files are left out.
  async icons(files: Map<string, string>): Promise<Map<string, Buffer>> {
    const keys = [...files.keys()]
    const urls = new Map<string, string>()
    for (let i = 0; i < keys.length; i += 50) {
      const batch = keys.slice(i, i + 50)
      const titles = batch.map((k) => `File:${files.get(k)}.png`)
      const info = await this.api({ action: 'query', prop: 'imageinfo', iiprop: 'url', titles: titles.join('|') })
      // Titles come back normalised ("Iron_plate" -> "Iron plate"); match on that.
      const normalised = new Map<string, string>((info.query.normalized ?? []).map((n: { from: string; to: string }) => [n.from, n.to]))
      const byTitle = new Map<string, string>(
        info.query.pages.filter((p: any) => p.imageinfo).map((p: any) => [p.title, p.imageinfo[0].url]),
      )
      batch.forEach((key, j) => {
        const url = byTitle.get(normalised.get(titles[j]) ?? titles[j])
        if (url) urls.set(key, url)
      })
    }

    const icons = new Map<string, Buffer>()
    const queue = [...urls]
    const worker = async () => {
      for (let entry = queue.shift(); entry; entry = queue.shift()) {
        const [key, url] = entry
        icons.set(
          key,
          await this.cached(url, async () => {
            const response = await fetch(url, { headers: HEADERS })
            if (!response.ok) throw new Error(`${url}: ${response.status}`)
            return Buffer.from(await response.arrayBuffer())
          }),
        )
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
    return icons
  }
}
