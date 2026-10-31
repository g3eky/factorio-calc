// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import type { Game } from '../db/GameProvider.tsx'
import { fixtureGame, withGame } from '../test/fixtureGame.tsx'
import { NumberInput } from './Input/Input.tsx'
import { ItemPicker } from './ItemPicker/ItemPicker.tsx'
import { Select } from './Select/Select.tsx'
import { Slot } from './Slot/Slot.tsx'
import { Slider } from './Slider/Slider.tsx'
import { Tabs } from './Tabs/Tabs.tsx'

let game: Game
beforeAll(async () => {
  game = await fixtureGame()
})
afterEach(cleanup)

test('item picker shows a tab per group and a slot per item', () => {
  render(<ItemPicker onPick={() => {}} />, { wrapper: withGame(game) })
  expect(screen.getAllByRole('tab').map((t) => t.title)).toEqual(['Production', 'Intermediate products'])
  fireEvent.click(screen.getByRole('tab', { name: 'Intermediate products' }))
  expect(screen.getByRole('button', { name: 'Iron plate' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Petroleum gas' })).toBeTruthy()
})

test('item picker search filters across groups, and Enter picks the first match', () => {
  const onPick = vi.fn()
  render(<ItemPicker onPick={onPick} />, { wrapper: withGame(game) })
  const search = screen.getByRole('textbox', { name: 'Search items' })
  fireEvent.change(search, { target: { value: 'cable' } })
  expect(screen.getAllByRole('tab')).toHaveLength(1)
  expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Copper cable'])
  fireEvent.keyDown(search, { key: 'Enter' })
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ kind: 'item', id: 'copper-cable' }))

  fireEvent.change(search, { target: { value: 'zzz' } })
  expect(screen.getByText('Nothing matches "zzz".')).toBeTruthy()
})

test('item picker: clicking a slot picks it, typing in the grid jumps to search', () => {
  const onPick = vi.fn()
  render(<ItemPicker onPick={onPick} />, { wrapper: withGame(game) })
  const slot = screen.getByRole('button', { name: 'Speed module' })
  fireEvent.click(slot)
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ kind: 'item', id: 'speed-module' }))
  slot.focus()
  fireEvent.keyDown(slot, { key: 'p' })
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search items' }))
})

test('item picker opens on the selected item\'s group', () => {
  render(<ItemPicker onPick={() => {}} selected={{ kind: 'fluid', id: 'water' }} />, { wrapper: withGame(game) })
  expect(screen.getByRole('tab', { selected: true }).title).toBe('Intermediate products')
  expect(screen.getByRole('button', { name: 'Water' }).getAttribute('aria-pressed')).toBe('true')
})

test('number input only reports valid numbers', () => {
  const onChange = vi.fn()
  render(<NumberInput value={5} min={0} onChange={onChange} aria-label="Rate" />)
  const input = screen.getByRole('textbox', { name: 'Rate' })
  fireEvent.change(input, { target: { value: '-3' } })
  expect(input.getAttribute('aria-invalid')).toBe('true')
  fireEvent.change(input, { target: { value: 'abc' } })
  expect(onChange).not.toHaveBeenCalled()
  fireEvent.blur(input)
  expect((input as HTMLInputElement).value).toBe('5')
  fireEvent.change(input, { target: { value: '12.5' } })
  expect(onChange).toHaveBeenCalledWith(12.5)
})

test('select works by keyboard', () => {
  function Example() {
    const [value, setValue] = useState('b')
    const options = ['a', 'b', 'c'].map((v) => ({ value: v, label: `Option ${v}` }))
    return <Select label="Choice" value={value} options={options} onChange={setValue} />
  }
  render(<Example />)
  const button = screen.getByRole('button', { name: /^Choice/ })
  fireEvent.keyDown(button, { key: 'ArrowDown' })
  expect(screen.getByRole('listbox')).toBeTruthy()
  fireEvent.keyDown(button, { key: 'ArrowDown' })
  fireEvent.keyDown(button, { key: 'Enter' })
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(button.textContent).toBe('ChoiceOption c')
  expect(screen.getByRole('button', { name: 'Choice Option c' })).toBe(button)
  fireEvent.keyDown(button, { key: 'ArrowDown' })
  fireEvent.keyDown(button, { key: 'Escape' })
  expect(screen.queryByRole('listbox')).toBeNull()
})

test('tabs move with arrow keys', () => {
  const onChange = vi.fn()
  render(<Tabs label="Settings" value="a" onChange={onChange} tabs={[{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]} />)
  fireEvent.keyDown(screen.getByRole('tab', { name: 'A' }), { key: 'ArrowRight' })
  expect(onChange).toHaveBeenCalledWith('b')
  fireEvent.keyDown(screen.getByRole('tab', { name: 'A' }), { key: 'ArrowLeft' })
  expect(onChange).toHaveBeenLastCalledWith('b')
})

test('slot tooltip appears after a short hover and goes away on leave', () => {
  vi.useFakeTimers()
  render(<Slot kind="item" id="iron-plate" title="Iron plate" details="Smelted from iron ore." aria-label="Iron plate" />, { wrapper: withGame(game) })
  const slot = screen.getByRole('button', { name: 'Iron plate' })
  fireEvent.pointerEnter(slot, { pointerType: 'mouse', clientX: 10, clientY: 10 })
  expect(screen.queryByRole('tooltip')).toBeNull()
  act(() => vi.advanceTimersByTime(200))
  expect(screen.getByRole('tooltip').textContent).toBe('Iron plateSmelted from iron ore.')
  fireEvent.pointerLeave(slot)
  expect(screen.queryByRole('tooltip')).toBeNull()
  vi.useRealTimers()
})

test('slider moves between its steps and reports the value', () => {
  const onChange = vi.fn()
  render(<Slider label="UI scale" steps={[0.75, 1, 1.5]} value={1} onChange={onChange} />)
  const slider = screen.getByRole('slider', { name: 'UI scale' })
  expect(slider.getAttribute('aria-valuetext')).toBe('1')
  fireEvent.change(slider, { target: { value: '2' } })
  expect(onChange).toHaveBeenCalledWith(1.5)
})
