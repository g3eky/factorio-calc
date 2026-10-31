// Generates src/theme/game.css from the game's own GUI styles (data.raw["gui-style"].default,
// defined in core/prototypes/style.lua): fonts, font colours, sizes and paddings, as CSS custom
// properties. Components draw themselves with CSS and take these numbers from here.

import type { Proto, Raw } from './convert.ts'

// CSS name -> game style name. Only the styles the site uses.
export const THEME_STYLES: Record<string, string> = {
  label: 'label',
  caption: 'caption_label',
  'frame-title': 'frame_title',
  frame: 'frame',
  subheader: 'subheader_frame',
  'shallow-frame': 'inside_shallow_frame',
  'deep-frame': 'inside_deep_frame',
  button: 'button',
  'green-button': 'green_button',
  'red-button': 'red_button',
  'back-button': 'back_button',
  'confirm-button': 'confirm_button',
  'tool-button': 'tool_button',
  'frame-action-button': 'frame_action_button',
  slot: 'slot_button',
  tab: 'tab',
  'group-tab': 'filter_group_tab',
  textbox: 'textbox',
  dropdown: 'dropdown',
  'list-item': 'list_box_item',
  checkbox: 'checkbox',
  radiobutton: 'radiobutton',
  slider: 'slider',
  'tooltip-label': 'tooltip_label',
  'tooltip-title': 'tooltip_title_label',
}

// A style with its parents' properties filled in. A style's `padding` replaces all four
// paddings it inherits; its own side paddings then apply on top.
export function resolveStyle(styles: Record<string, Proto>, name: string): Proto {
  const chain: Proto[] = []
  for (let style = styles[name]; style; style = style.parent ? styles[style.parent] : undefined) chain.unshift(style)
  const out: Proto = {}
  for (const style of chain) {
    if (style.padding !== undefined) for (const side of ['top', 'right', 'bottom', 'left']) out[`${side}_padding`] = style.padding
    Object.assign(out, style)
  }
  return out
}

// Factorio colours: [r, g, b, a?] or {r, g, b, a}, in 0-1 or 0-255; missing channels are 0, alpha 1.
export function cssColor(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object') return undefined
  const v = value as Record<string | number, number>
  let [r, g, b, a] = Array.isArray(value) ? [v[0], v[1], v[2], v[3]] : [v.r, v.g, v.b, v.a]
  ;[r, g, b] = [r ?? 0, g ?? 0, b ?? 0]
  const scale = Math.max(r, g, b, a ?? 0) > 1 ? 1 : 255
  const channel = (c: number) => Math.round(c * scale)
  const alpha = a === undefined ? 1 : scale === 1 ? a / 255 : a
  return alpha === 1 ? `rgb(${channel(r)} ${channel(g)} ${channel(b)})` : `rgb(${channel(r)} ${channel(g)} ${channel(b)} / ${Number(alpha.toFixed(3))})`
}

// Font weight from the font file name; "semibold" before "bold", which it contains.
const WEIGHTS: [RegExp, number][] = [
  [/semibold/, 600],
  [/bold/, 700],
  [/light/, 300],
]

export function themeCss(raw: Raw): string {
  const styles = raw['gui-style']?.default as Record<string, Proto> | undefined
  if (!styles) throw new Error('No gui-style in the data dump')
  const fonts = raw.font ?? {}
  const px = (n: number) => `${n}px`
  const lines: string[] = []

  for (const [css, game] of Object.entries(THEME_STYLES)) {
    if (!styles[game]) throw new Error(`No game style "${game}"`)
    const s = resolveStyle(styles, game)
    const set = (name: string, value: string | undefined) => {
      if (value !== undefined) lines.push(`  --game-${css}-${name}: ${value};`)
    }
    const font = s.font ? fonts[s.font] : undefined
    if (font) {
      set('font-size', px(font.size))
      set('font-weight', String(WEIGHTS.find(([pattern]) => pattern.test(font.from))?.[1] ?? 400))
    }
    set('color', cssColor(s.font_color ?? s.default_font_color))
    set('hover-color', cssColor(s.hovered_font_color))
    set('pressed-color', cssColor(s.clicked_font_color))
    set('selected-color', cssColor(s.selected_font_color))
    set('disabled-color', cssColor(s.disabled_font_color))
    const size = Array.isArray(s.size) ? s.size : s.size !== undefined ? [s.size, s.size] : undefined
    set('width', size ? px(size[0]) : s.width !== undefined ? px(s.width) : undefined)
    set('height', size ? px(size[1]) : s.height !== undefined ? px(s.height) : undefined)
    if (!size) {
      set('min-width', s.minimal_width !== undefined ? px(s.minimal_width) : undefined)
      set('min-height', s.minimal_height !== undefined ? px(s.minimal_height) : undefined)
    }
    set('max-width', s.maximal_width !== undefined ? px(s.maximal_width) : undefined)
    const sides = ['top', 'right', 'bottom', 'left'].map((side) => s[`${side}_padding`])
    // CSS has no negative padding (the game uses -1 to nudge text); those become 0.
    if (sides.some((p) => p !== undefined)) set('padding', sides.map((p) => px(Math.max(0, p ?? 0))).join(' '))
    set('pressed-offset', s.clicked_vertical_offset !== undefined ? px(s.clicked_vertical_offset) : undefined)
    set('text-gap', s.text_padding !== undefined ? px(s.text_padding) : undefined)
    const spacing = s.vertical_flow_style?.vertical_spacing ?? s.horizontal_flow_style?.horizontal_spacing
    set('spacing', spacing !== undefined ? px(spacing) : undefined)
  }

  return `/* Generated by ./run import from the game's GUI styles (core/prototypes/style.lua). Don't edit. */\n:root {\n${lines.join('\n')}\n}\n`
}
