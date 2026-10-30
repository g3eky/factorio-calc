import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

export interface Manifest {
  datasets: { id: string; name: string; version: string; file: string; icons?: string }[]
}

export const dbUrl = (file: string) => `${import.meta.env.BASE_URL}db/${file}`

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`)
  return response
}

export async function loadManifest(): Promise<Manifest> {
  return (await fetchOk(dbUrl('manifest.json'))).json()
}

// Databases are shipped gzipped (.sqlite.gz). Some servers already unzip them on the way
// (Content-Encoding: gzip), so check for gzip's magic bytes before unpacking.
async function unpack(response: Response): Promise<ArrayBuffer> {
  const bytes = await response.arrayBuffer()
  const view = new Uint8Array(bytes, 0, 2)
  if (view[0] !== 0x1f || view[1] !== 0x8b) return bytes
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
}

let sqlJs: ReturnType<typeof initSqlJs> | undefined

export async function openDatabase(file: string): Promise<Database> {
  sqlJs ??= initSqlJs({ locateFile: () => wasmUrl })
  const [SQL, buffer] = await Promise.all([sqlJs, fetchOk(dbUrl(file)).then(unpack)])
  return new SQL.Database(new Uint8Array(buffer))
}
