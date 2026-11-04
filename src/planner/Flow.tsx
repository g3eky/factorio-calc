import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import type { ELK, ElkNode } from 'elkjs/lib/elk-api.js'
import type { SolveResult } from '../calculator/types.ts'
import { useGame } from '../db/GameProvider.tsx'
import { Button } from '../ui/Button/Button.tsx'
import { Icon } from '../ui/Icon/Icon.tsx'
import { TextInput } from '../ui/Input/Input.tsx'
import { cx } from '../ui/cx.ts'
import { uiZoom } from '../ui/zoom.ts'
import { flowGraph, type FlowNode } from './flowGraph.ts'
import { long, short, UNIT_LABELS, UNIT_SECONDS } from './format.ts'
import { amountName, processName } from './Results.tsx'
import type { Calculation } from './state.ts'
import styles from './Flow.module.css'

// ELK and its worker (about 1.6 MB) are only fetched when the tree is first shown. Layout runs in
// the worker, so it never blocks the page.
let elk: Promise<ELK> | undefined
const loadElk = () =>
  (elk ??= Promise.all([import('elkjs/lib/elk-api.js'), import('elkjs/lib/elk-worker.min.js?url')]).then(
    ([api, worker]) => new api.default({ workerUrl: worker.default }),
  ))

const OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'LEFT',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.spacing.nodeNode': '16',
  'elk.layered.spacing.nodeNodeBetweenLayers': '64',
  'elk.layered.spacing.edgeNodeBetweenLayers': '16',
  'elk.edgeLabels.placement': 'CENTER',
  'elk.padding': '[top=16,left=16,bottom=16,right=16]',
}

const PROCESS = { width: 220, height: 56 }
const SOURCE = { width: 180, height: 40 }
const LABEL_HEIGHT = 18
// Rate labels: a 14 px icon, then the rate in an 11 px mono font (about 6.7 px a character).
const labelWidth = (text: string) => 14 + 4 + Math.ceil(text.length * 6.7) + 6

interface Box {
  node: FlowNode
  x: number
  y: number
  width: number
  height: number
}

interface Line {
  id: string
  kind: 'item' | 'fluid'
  item: { kind: 'item' | 'fluid'; id: string; quality?: string }
  rate: string
  path: string
  label?: { x: number; y: number; width: number }
}

interface Layout {
  width: number
  height: number
  boxes: Box[]
  lines: Line[]
}

const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.8, 1, 1.25, 1.5, 2]
const MIN_ZOOM = 0.2
const MAX_ZOOM = 2

interface Props {
  result: SolveResult
  calc: Calculation
  selectedKey: string | undefined
  onSelect: (key: string) => void
  // The tree and its panel fill the browser tab.
  expanded: boolean
  onExpand: (expanded: boolean) => void
}

// The production chain as a flow diagram: your targets on the left, raw resources on the right.
// An endless canvas: drag anywhere to pan, the wheel zooms around the pointer, nothing stops at the
// diagram's edges. Pan and zoom are one transform set straight on the DOM, so moving re-renders nothing.
export function Flow({ result, calc, selectedKey, onSelect, expanded, onExpand }: Props) {
  const game = useGame()
  const scale = UNIT_SECONDS[calc.unit]
  const unit = UNIT_LABELS[calc.unit]
  const graph = useMemo(() => flowGraph(result), [result])
  const [layout, setLayout] = useState<Layout>()
  const [laying, setLaying] = useState(true)
  // Shown in the toolbar; the view itself lives in `view`.
  const [zoom, setZoom] = useState(1)
  const seq = useRef(0)
  const pane = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLDivElement>(null)
  // Canvas offset in the pane (CSS pixels) and zoom.
  const view = useRef({ x: 0, y: 0, z: 1 })
  const placed = useRef(false)
  // Dragging pans: where the pointer and the view were when it went down.
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean }>(undefined)
  const dragged = useRef(false)
  // Find in the tree: every box whose name contains the text is marked; one at a time is brought into view.
  const [query, setQuery] = useState('')
  const [found, setFound] = useState(0)
  const targetKeys = calc.targets.map((t) => `${t.kind}/${t.id}@${t.quality ?? ''}`).join(',')

  const apply = useCallback(() => {
    const { x, y, z } = view.current
    if (canvas.current) canvas.current.style.transform = `translate(${x}px, ${y}px) scale(${z})`
    if (pane.current) {
      // The grid moves and scales with the canvas, so it reads as one endless sheet.
      pane.current.style.backgroundSize = `${28 * z}px ${28 * z}px`
      pane.current.style.backgroundPosition = `${x}px ${y}px`
    }
    setZoom(z)
  }, [])

  // Zoom to `z`, keeping the pane point (px, py) still.
  const zoomAt = useCallback(
    (z: number, px: number, py: number) => {
      const v = view.current
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
      view.current = { x: px - ((px - v.x) / v.z) * next, y: py - ((py - v.y) / v.z) * next, z: next }
      apply()
    },
    [apply],
  )

  useEffect(() => {
    const s = ++seq.current
    setLaying(true)
    const rateText = (rate: number) => `${short(rate * scale)}${unit}`
    const elkGraph: ElkNode = {
      id: 'root',
      layoutOptions: OPTIONS,
      children: graph.nodes.map((n) => ({ id: n.id, ...(n.kind === 'process' ? PROCESS : SOURCE) })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        sources: [e.from],
        targets: [e.to],
        labels: [{ text: rateText(e.item.rate), width: labelWidth(rateText(e.item.rate)), height: LABEL_HEIGHT }],
      })),
    }
    loadElk()
      .then((elk) => elk.layout(elkGraph))
      .then((laid) => {
        if (s !== seq.current) return
        const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
        const edges = new Map(graph.edges.map((e) => [e.id, e]))
        setLayout({
          width: laid.width ?? 0,
          height: laid.height ?? 0,
          boxes: (laid.children ?? []).map((c) => ({ node: nodes.get(c.id)!, x: c.x ?? 0, y: c.y ?? 0, width: c.width ?? 0, height: c.height ?? 0 })),
          lines: (laid.edges ?? []).map((e) => {
            const edge = edges.get(e.id)!
            const points = (e.sections ?? []).flatMap((s) => [s.startPoint, ...(s.bendPoints ?? []), s.endPoint])
            const label = e.labels?.[0]
            return {
              id: e.id,
              kind: edge.item.kind,
              item: edge.item,
              rate: rateText(edge.item.rate),
              path: points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(''),
              label: label && { x: label.x ?? 0, y: label.y ?? 0, width: label.width ?? 0 },
            }
          }),
        })
        setLaying(false)
      })
      .catch(() => s === seq.current && setLaying(false))
  }, [graph, scale, unit])

  // The first layout starts at 100% with the targets' column at the left edge; later ones keep the view.
  useEffect(() => {
    if (!layout || placed.current) return
    placed.current = true
    view.current = { x: 0, y: 0, z: 1 }
    apply()
  }, [layout, apply])

  // Bring a box into view (centred) if it's outside the pane: after following a link in the side
  // panel, or tabbing to it.
  const reveal = useCallback(
    (key: string) => {
      const b = layout?.boxes.find((x) => x.node.id === key)
      const el = pane.current
      if (!b || !el) return
      const { x, y, z } = view.current
      const left = b.x * z + x
      const top = b.y * z + y
      if (left >= 0 && top >= 0 && left + b.width * z <= el.clientWidth && top + b.height * z <= el.clientHeight) return
      view.current = { x: el.clientWidth / 2 - (b.x + b.width / 2) * z, y: el.clientHeight / 2 - (b.y + b.height / 2) * z, z }
      apply()
    },
    [layout, apply],
  )
  useEffect(() => {
    if (selectedKey) reveal(selectedKey)
  }, [selectedKey, reveal])

  // Matches in reading order: column by column from the targets, top to bottom.
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!layout || !needle) return []
    const name = (n: FlowNode) => (n.kind === 'process' ? processName(game, n.process) : amountName(game, n.amount))
    return layout.boxes
      .filter((b) => name(b.node).toLowerCase().includes(needle))
      .sort((a, b) => a.x - b.x || a.y - b.y)
      .map((b) => b.node.id)
  }, [layout, query, game])
  const current = matches.length ? matches[found % matches.length] : undefined
  useEffect(() => {
    if (current) reveal(current)
  }, [current, reveal])
  const onFindKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' && matches.length) setFound((f) => (f + (e.shiftKey ? matches.length - 1 : 1)) % matches.length)
    if (e.key === 'Escape' && query) {
      // Clears the search instead of shrinking the expanded tree.
      e.stopPropagation()
      setQuery('')
    }
  }

  useEffect(() => {
    const el = pane.current
    if (!el) return
    // Not a React handler: React's wheel listeners are passive, and this one stops the page scrolling.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const ui = uiZoom()
      const unitPx = e.deltaMode === 1 ? 16 : 1
      // Pinch (ctrl + wheel) and the mouse wheel zoom; a sideways trackpad swipe pans.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
        view.current = { ...view.current, x: view.current.x - (e.deltaX * unitPx) / ui }
        apply()
        return
      }
      zoomAt(view.current.z * Math.exp(-e.deltaY * unitPx * 0.002), (e.clientX - rect.left) / ui, (e.clientY - rect.top) / ui)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [apply, zoomAt])

  const pan = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return
      dragged.current = false
      drag.current = { x: e.clientX, y: e.clientY, vx: view.current.x, vy: view.current.y, moved: false }
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      const d = drag.current
      if (!d) return
      const dx = (e.clientX - d.x) / uiZoom()
      const dy = (e.clientY - d.y) / uiZoom()
      // A small wobble is still a click.
      if (!d.moved && Math.hypot(dx, dy) < 4) return
      if (!d.moved) {
        d.moved = true
        e.currentTarget.setPointerCapture(e.pointerId)
        e.currentTarget.classList.add(styles.dragging)
      }
      view.current = { ...view.current, x: d.vx + dx, y: d.vy + dy }
      apply()
    },
    onPointerUp: (e: PointerEvent<HTMLDivElement>) => {
      dragged.current = !!drag.current?.moved
      drag.current = undefined
      e.currentTarget.classList.remove(styles.dragging)
    },
    onPointerCancel: (e: PointerEvent<HTMLDivElement>) => {
      drag.current = undefined
      e.currentTarget.classList.remove(styles.dragging)
    },
    // A drag that ends on a box doesn't select it.
    onClickCapture: (e: MouseEvent) => {
      if (!dragged.current) return
      dragged.current = false
      e.stopPropagation()
    },
    // Tabbing to a box off screen pans to it.
    onFocus: (e: FocusEvent) => {
      const key = (e.target as HTMLElement).dataset.node
      if (key) reveal(key)
    },
  }

  // Escape shrinks the expanded tree back into the card.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onExpand(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [expanded, onExpand])

  const centre = () => ({ x: (pane.current?.clientWidth ?? 0) / 2, y: (pane.current?.clientHeight ?? 0) / 2 })
  const fit = () => {
    const el = pane.current
    if (!layout || !el) return
    const z = Math.max(MIN_ZOOM, Math.min(1, el.clientWidth / layout.width, el.clientHeight / layout.height))
    view.current = { x: (el.clientWidth - layout.width * z) / 2, y: (el.clientHeight - layout.height * z) / 2, z }
    apply()
  }
  const step = (by: 1 | -1) => {
    const z = view.current.z
    const next = by > 0 ? ZOOMS.find((x) => x > z + 1e-6) : [...ZOOMS].reverse().find((x) => x < z - 1e-6)
    const c = centre()
    if (next) zoomAt(next, c.x, c.y)
  }

  // The diagram itself only re-renders when the layout or the selection changes, not on pan or zoom.
  const content = useMemo(() => {
    if (!layout) return null
    const marked = new Set(matches)
    const targets = new Set(targetKeys.split(','))
    const box = (b: Box) => {
      const n = b.node
      const style = { left: b.x, top: b.y, width: b.width, height: b.height }
      if (n.kind !== 'process') {
        const label = `${amountName(game, n.amount)}: ${long(n.amount.rate * scale)}${unit}, ${n.kind === 'raw' ? 'raw resource' : 'imported'}`
        return (
          <div key={n.id} className={cx(styles.box, styles.source, marked.has(n.id) && styles.match, n.id === current && styles.current)} style={style} aria-label={label} title={label} role="img">
            <Icon kind={n.amount.kind} id={n.amount.id} size={24} />
            <span className={styles.text}>
              <span className={styles.name}>{amountName(game, n.amount)}</span>
              <span className={styles.meta}>
                {n.kind === 'raw' ? 'Raw' : 'Imported'} · {short(n.amount.rate * scale)}
                {unit}
              </span>
            </span>
          </div>
        )
      }
      const p = n.process
      const name = processName(game, p)
      const machine = game.machines.get(p.machine)
      const target = p.outputs.some((o) => targets.has(`${o.kind}/${o.id}@${o.quality ?? ''}`))
      return (
        <button
          key={n.id}
          type="button"
          data-node={n.id}
          className={cx(styles.box, target && styles.target, n.id === selectedKey && styles.selected, marked.has(n.id) && styles.match, n.id === current && styles.current)}
          style={style}
          aria-pressed={n.id === selectedKey}
          aria-label={`${name}${target ? ' (target)' : ''}: ${long(p.machines)} ${machine?.name ?? p.machine}`}
          onClick={() => onSelect(n.id)}
        >
          <Icon kind={p.kind === 'recipe' ? 'recipe' : p.outputs[0].kind} id={p.kind === 'recipe' ? p.id : p.outputs[0].id} size={32} />
          <span className={styles.text}>
            <span className={styles.name}>{name}</span>
            <span className={styles.meta}>
              <Icon kind="machine" id={p.machine} size={16} />× {long(p.machines)}
            </span>
          </span>
        </button>
      )
    }
    return (
      <>
        <svg className={styles.lines} width={layout.width} height={layout.height} aria-hidden>
          <defs>
            <marker id="flow-arrow-item" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0,0L8,4L0,8z" className={styles.arrowItem} />
            </marker>
            <marker id="flow-arrow-fluid" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M0,0L8,4L0,8z" className={styles.arrowFluid} />
            </marker>
          </defs>
          {layout.lines.map((l) => (
            <path key={l.id} d={l.path} className={l.kind === 'fluid' ? styles.fluid : styles.item} markerEnd={`url(#flow-arrow-${l.kind})`} />
          ))}
        </svg>
        {layout.lines.map(
          (l) =>
            l.label && (
              <span
                key={l.id}
                className={cx(styles.label, l.kind === 'fluid' && styles.fluidLabel)}
                style={{ left: l.label.x, top: l.label.y, width: l.label.width }}
                title={`${amountName(game, l.item)}: ${l.rate}`}
              >
                <Icon kind={l.item.kind} id={l.item.id} size={14} />
                {l.rate}
              </span>
            ),
        )}
        {layout.boxes.map(box)}
      </>
    )
  }, [layout, selectedKey, onSelect, game, scale, unit, targetKeys, matches, current])

  return (
    <div className={styles.flow}>
      <div className={styles.tools}>
        <span className={styles.status} data-visible={laying}>
          Laying out…
        </span>
        <span className={styles.hint}>Drag to move, scroll to zoom</span>
        <TextInput
          type="search"
          className={styles.find}
          placeholder="Find in tree"
          aria-label="Find in tree"
          title="Enter for the next match, Shift+Enter for the one before"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setFound(0)
          }}
          onKeyDown={onFindKey}
        />
        {query.trim() && (
          <span className={styles.found} aria-live="polite">
            {matches.length ? `${(found % matches.length) + 1} of ${matches.length}` : 'None'}
          </span>
        )}
        <Button onClick={() => step(-1)} aria-label="Zoom out" square>
          −
        </Button>
        <span className={styles.zoom}>{Math.round(zoom * 100)}%</span>
        <Button onClick={() => step(1)} aria-label="Zoom in" square>
          +
        </Button>
        <Button onClick={fit}>Fit</Button>
        <Button
          onClick={() => {
            const c = centre()
            zoomAt(1, c.x, c.y)
          }}
        >
          100%
        </Button>
        <Button
          square
          onClick={() => onExpand(!expanded)}
          aria-pressed={expanded}
          aria-label="Fill the tab"
          title={expanded ? 'Back into the page (Esc)' : 'Fill the tab'}
        >
          {/* Corners pointing out to fill the tab, in to go back. */}
          <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden>
            <path d={expanded ? 'M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4' : 'M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4'} />
          </svg>
        </Button>
      </div>
      <div ref={pane} className={styles.pane} role="group" aria-label="Crafting tree" {...pan}>
        <div ref={canvas} className={cx(styles.canvas, laying && styles.stale)} style={layout && { width: layout.width, height: layout.height }}>
          {content}
        </div>
      </div>
    </div>
  )
}
