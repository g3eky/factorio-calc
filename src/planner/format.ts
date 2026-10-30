// Rates and numbers, shown the way the game shows them.

export type RateUnit = 's' | 'min' | 'h'

export const UNIT_SECONDS: Record<RateUnit, number> = { s: 1, min: 60, h: 3600 }
export const UNIT_LABELS: Record<RateUnit, string> = { s: '/s', min: '/min', h: '/h' }

// Short form for slots: 0.25, 2.5, 25, 250, 2.5k, 25k, 2.5M.
export function short(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${trim(n / 1e6, 1)}M`
  if (abs >= 1e4) return `${trim(n / 1e3, 0)}k`
  if (abs >= 1e3) return `${trim(n / 1e3, 1)}k`
  if (abs >= 100) return trim(n, 0)
  if (abs >= 10) return trim(n, 1)
  return trim(n, 2)
}

// Full form for text and tooltips: up to 3 decimals, with thousands separators.
export function long(n: number): string {
  return n.toLocaleString('en', { maximumFractionDigits: Math.abs(n) >= 100 ? 1 : 3 })
}

const trim = (n: number, digits: number) => String(Number(n.toFixed(digits)))

// 90 -> "1.5 min", 18000 -> "5 h".
export function duration(seconds: number): string {
  if (seconds < 60) return `${long(seconds)} s`
  if (seconds < 3600) return `${long(Number((seconds / 60).toPrecision(3)))} min`
  return `${long(Number((seconds / 3600).toPrecision(3)))} h`
}

export function power(watts: number): string {
  const units = ['W', 'kW', 'MW', 'GW', 'TW']
  let i = 0
  while (Math.abs(watts) >= 1000 && i < units.length - 1) {
    watts /= 1000
    i++
  }
  return `${long(Number(watts.toPrecision(4)))} ${units[i]}`
}
