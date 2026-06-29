/**
 * @module resolve-template-refs.spec
 *
 * Behavior tests for the template ref resolver.
 * Covers $styleRef resolution, $bind resolution, and position constraint
 * validation — all behaviors that moved from h() to resolveTemplateRefs.
 */

import { expect, test } from 'bun:test'
import { h } from 'plaited/client'
import {
  type HtmlRegistry,
  InvalidBindPositionError,
  InvalidStyleRefPositionError,
  MissingRegistryError,
  resolveTemplateRefs,
  UnresolvedBindError,
  UnresolvedStyleRefError,
} from '../resolve-template-refs.ts'

// ── $styleRef resolution ────────────────────────────────────────────────

test('$styleRef resolves from registry and inlines classNames + stylesheets', () => {
  const registry: HtmlRegistry = {
    styles: new Map([['button.base', { classNames: ['btn'], stylesheets: ['.btn { color: blue; }'] }]]),
  }
  const resolved = resolveTemplateRefs({ style: [{ $styleRef: 'button.base' }] }, registry)
  const result = h('button', { ...resolved, children: 'Click' })
  const html = result.html.join('')
  expect(html).toContain('class="btn"')
  expect(result.stylesheets).toContain('.btn { color: blue; }')
})

test('$styleRef - missing registry fires MissingRegistryError', () => {
  expect(() => resolveTemplateRefs({ style: [{ $styleRef: 'button.base' }] }, {} as HtmlRegistry)).toThrow(
    MissingRegistryError,
  )
})

test('$styleRef - unresolvable style fires UnresolvedStyleRefError', () => {
  const registry: HtmlRegistry = { styles: new Map() }
  expect(() => resolveTemplateRefs({ style: [{ $styleRef: 'nonexistent' }] }, registry)).toThrow(
    UnresolvedStyleRefError,
  )
})

test('$styleRef coexists with class/classNames', () => {
  const registry: HtmlRegistry = {
    styles: new Map([['btn.base', { classNames: ['btn'], stylesheets: [] }]]),
  }
  const resolved = resolveTemplateRefs({ class: 'custom-class', style: [{ $styleRef: 'btn.base' }] }, registry)
  const result = h('button', { ...resolved, children: 'Click' })
  const html = result.html.join('')
  expect(html).toContain('class="btn custom-class"')
})

test('$styleRef in attr value throws InvalidStyleRefPositionError', () => {
  const registry: HtmlRegistry = { styles: new Map() }
  expect(() => resolveTemplateRefs({ 'data-x': { $styleRef: 'foo' } }, registry)).toThrow(InvalidStyleRefPositionError)
})

test('$bind in style[] throws InvalidBindPositionError', () => {
  const registry: HtmlRegistry = { data: { foo: 'bar' } }
  expect(() => resolveTemplateRefs({ style: [{ $bind: 'foo' }] }, registry)).toThrow(InvalidBindPositionError)
})

// ── $bind resolution ────────────────────────────────────────────────────

test('$bind in text resolves from registry.data', () => {
  const registry: HtmlRegistry = { data: { customer: { name: 'Alice' } } }
  const resolved = resolveTemplateRefs({ children: { $bind: 'customer.name' } }, registry)
  const result = h('span', resolved)
  const html = result.html.join('')
  expect(html).toContain('Alice')
})

test('$bind in attr value resolves from registry.data', () => {
  const registry: HtmlRegistry = { data: { customer: { id: '42' } } }
  const resolved = resolveTemplateRefs({ 'data-cid': { $bind: 'customer.id' } }, registry)
  const result = h('div', resolved)
  const html = result.html.join('')
  expect(html).toContain('data-cid="42"')
})

test('$bind - no registry data fires MissingRegistryError', () => {
  expect(() => resolveTemplateRefs({ children: { $bind: 'path' } }, {})).toThrow(MissingRegistryError)
})

test('$bind - unresolvable path fires UnresolvedBindError', () => {
  const registry: HtmlRegistry = { data: {} }
  expect(() => resolveTemplateRefs({ children: { $bind: 'missing.path' } }, registry)).toThrow(UnresolvedBindError)
})

test('literal path unchanged (no refs, no registry needed)', () => {
  const resolved = resolveTemplateRefs({ type: 'submit', children: 'Save' }, {} as HtmlRegistry)
  expect(resolved.type).toBe('submit')
  expect(resolved.children).toBe('Save')
})

// ── Inline style passthrough ────────────────────────────────────────────

test('inline CSSProperties style is passed through as-is', () => {
  const resolved = resolveTemplateRefs({ style: { color: 'red' }, children: 'hi' }, {} as HtmlRegistry)
  expect(resolved.style).toEqual({ color: 'red' })
  expect(resolved.styles).toBeUndefined()
})
