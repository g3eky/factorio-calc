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

export async function openDatabase(file: string): Promise<Database> {
  const [SQL, buffer] = await Promise.all([
    initSqlJs({ locateFile: () => wasmUrl }),
    fetchOk(dbUrl(file)).then((response) => response.arrayBuffer()),
  ])
  return new SQL.Database(new Uint8Array(buffer))
}
